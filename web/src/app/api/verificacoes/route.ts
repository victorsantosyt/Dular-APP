import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import type formidable from "formidable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { parseMultipart } from "@/lib/parseMultipart";
import { deleteObject, makeKey, putObject } from "@/lib/s3Objects";
import { autoVerificarDiaristaSePossivel } from "@/lib/autoVerificacao";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { detectImageMime, extensionForMime } from "@/lib/imageMagicBytes";
import { fotografarDadosCadastrais } from "@/lib/dadosVerificacao";
import { selfieExigida } from "@/lib/verificacaoSelfie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FORMIDABLE_CLIENT_ERROR_CODES = new Set([1007, 1008, 1009, 1010, 1011, 1012, 1013, 1015, 1016]);

class UploadValidationError extends Error {
  constructor(public readonly publicMessage: string) {
    super("UploadValidationError");
  }
}

function firstFile(value: formidable.File | formidable.File[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type ValidatedDoc = {
  buffer: Buffer;
  mime: "image/jpeg" | "image/png";
  size: number;
};

async function validateDoc(file: formidable.File): Promise<ValidatedDoc> {
  const mime = file.mimetype || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new UploadValidationError("Formato inválido. Envie JPG ou PNG.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadValidationError("Arquivo muito grande. Limite de 10MB.");
  }

  const buffer = await fs.readFile(file.filepath);
  const detectedMime = detectImageMime(buffer);
  if (detectedMime !== mime) {
    throw new UploadValidationError("Arquivo inválido. Envie um JPG ou PNG válido.");
  }

  return { buffer, mime: detectedMime, size: file.size };
}

async function persistDoc(doc: ValidatedDoc, prefix: string) {
  const ext = extensionForMime(doc.mime);
  const key = makeKey(`verificacoes/${prefix}`, ext);
  await putObject(key, doc.buffer, doc.mime);
  return { key, mime: doc.mime, size: doc.size };
}

/**
 * Sobe os três arquivos do envio. Se qualquer um falhar, apaga os que subiram:
 * um envio pela metade nunca fica no bucket. Devolve as chaves na ordem.
 */
async function persistirEnvio(docs: Array<{ doc: ValidatedDoc; prefixo: string }>): Promise<string[]> {
  const resultados = await Promise.allSettled(docs.map(({ doc, prefixo }) => persistDoc(doc, prefixo)));
  const subiram = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value.key] : []));
  if (subiram.length !== docs.length) {
    await removerOrfaos(subiram);
    throw new UploadIncompletoError();
  }
  return subiram;
}

/** Remove arquivos de um envio que não chegou ao banco. Só contagem no log. */
async function removerOrfaos(chaves: string[]) {
  const r = await Promise.allSettled(chaves.map((k) => deleteObject(k)));
  const falharam = r.filter((x) => x.status === "rejected").length;
  if (falharam) console.error(`[api/verificacoes] ${falharam} arquivo(s) órfão(s) não removido(s) do bucket.`);
}

class UploadIncompletoError extends Error {
  constructor() {
    super("UploadIncompletoError");
  }
}

/** Dados exigidos no servidor para uma submissão nova (não basta a tela pedir). */
async function dadosFaltantes(userId: string): Promise<string[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nomeCompleto: true, cpf: true, dataNascimento: true } });
  const faltando: string[] = [];
  if (!u?.nomeCompleto?.trim()) faltando.push("nomeCompleto");
  if (!u?.cpf?.trim()) faltando.push("cpf");
  if (!u?.dataNascimento) faltando.push("dataNascimento");
  return faltando;
}

export async function POST(req: Request) {
  try {
    cleanupRateLimit();

    const auth = await requireAuthAtivo(req);
    // T-18.5: endpoint agora aceita EMPREGADOR, DIARISTA e MONTADOR. Cada
    // papel grava em local diferente:
    //  - DIARISTA: DiaristaProfile.verificacao + docUrl (fluxo legado)
    //  - EMPREGADOR: apenas DocumentVerification (sem campo no perfil)
    //  - MONTADOR: apenas DocumentVerification (campos do MontadorPerfil são
    //    populados por outro fluxo de upload — fora do escopo aqui)
    if (auth.role !== "DIARISTA" && auth.role !== "EMPREGADOR" && auth.role !== "MONTADOR") {
      return NextResponse.json({ ok: false, error: "Papel não suportado." }, { status: 403 });
    }

    const ip = getRequestIp(req);
    const rlIp = rateLimit({ key: `verificacoes-ip:${ip}`, limit: 20, windowMs: 60 * 60_000 });
    const rlUser = rateLimit({
      key: `verificacoes-user:${auth.userId}`,
      limit: 4,
      windowMs: 60 * 60_000,
    });
    if (!rlIp.ok || !rlUser.ok) {
      const resetAt = Math.max(!rlIp.ok ? rlIp.resetAt : 0, !rlUser.ok ? rlUser.resetAt : 0);
      return NextResponse.json(
        {
          ok: false,
          error: "RATE_LIMITED",
          message: "Muitas tentativas. Aguarde um pouco e tente novamente.",
          retryAfterMs: rateLimitRetryAfterMs(resetAt),
        },
        { status: 429 },
      );
    }

    if (auth.role === "DIARISTA") {
      const profile = await prisma.diaristaProfile.findUnique({
        where: { userId: auth.userId },
        select: { verificacao: true, docUrl: true },
      });

      if (profile?.verificacao === "VERIFICADO") {
        return NextResponse.json({ ok: false, error: "Verificação já aprovada." }, { status: 409 });
      }
      if (profile?.verificacao === "PENDENTE" && profile.docUrl) {
        return NextResponse.json({ ok: false, error: "Verificação já está pendente." }, { status: 409 });
      }
    } else {
      // EMPREGADOR/MONTADOR: bloquear reenvio quando já existe uma submissão
      // PENDING ou APPROVED ativa em DocumentVerification.
      const ultimo = await prisma.documentVerification.findFirst({
        where: { userId: auth.userId },
        orderBy: { updatedAt: "desc" },
        select: { status: true, docUrl: true },
      });
      if (ultimo?.status === "APPROVED") {
        return NextResponse.json({ ok: false, error: "Verificação já aprovada." }, { status: 409 });
      }
      if (ultimo?.status === "PENDING" && ultimo.docUrl) {
        return NextResponse.json({ ok: false, error: "Verificação já está pendente." }, { status: 409 });
      }
    }

    // Exigência nova só com o controle do servidor ligado (nunca pelo pedido).
    const exigente = selfieExigida();
    // Dados obrigatórios conferidos no servidor antes de receber arquivos.
    const faltando = exigente ? await dadosFaltantes(auth.userId) : [];
    if (faltando.length) {
      return NextResponse.json(
        // Versões anteriores do app não têm o campo de nome completo: a mensagem
        // (exibida por elas como veio) já orienta a atualizar.
        { ok: false, error: "Para enviar seus documentos, atualize o Dular e complete nome completo, CPF e data de nascimento.", codigo: "DADOS_OBRIGATORIOS", faltando },
        { status: 400 },
      );
    }

    const { files } = await parseMultipart(req, { maxFileSize: MAX_FILE_SIZE, maxFiles: 3 });
    const docFrente = firstFile(files.docFrente as formidable.File | formidable.File[] | undefined);
    const docVerso = firstFile(files.docVerso as formidable.File | formidable.File[] | undefined);
    const selfie = firstFile(files.selfie as formidable.File | formidable.File[] | undefined);

    if (!docFrente || !docVerso) {
      return NextResponse.json({ ok: false, error: "Envie frente e verso do documento." }, { status: 400 });
    }
    // Versões anteriores do app não mandam selfie: a exigência é do servidor,
    // então omitir o arquivo não contorna a conferência.
    if (exigente && !selfie) {
      return NextResponse.json(
        { ok: false, error: "Atualize o Dular para enviar seus documentos: agora também pedimos uma selfie.", codigo: "SELFIE_OBRIGATORIA" },
        { status: 400 },
      );
    }

    // Valida OS TRÊS antes de qualquer upload no S3 — evita upload parcial
    // (vazamento do arquivo válido) quando outro arquivo é inválido.
    // Selfie enviada (app novo) é validada e guardada mesmo com a exigência
    // desligada: o envio fica completo para quando ela for ligada.
    const [frenteData, versoData, selfieData] = await Promise.all([
      validateDoc(docFrente),
      validateDoc(docVerso),
      selfie ? validateDoc(selfie) : Promise.resolve(null),
    ]);

    const [frenteKey, versoKey, selfieKey = null] = await persistirEnvio([
      { doc: frenteData, prefixo: `${auth.userId}/frente` },
      { doc: versoData, prefixo: `${auth.userId}/verso` },
      ...(selfieData ? [{ doc: selfieData, prefixo: `${auth.userId}/selfie` }] : []),
    ]);

    // Um instante só para a submissão inteira: data dos arquivos, criação do
    // registro, nota e fotografia dos dados batem entre si.
    const agora = new Date();
    const docUrl = JSON.stringify({
      frente: frenteKey,
      verso: versoKey,
      ...(selfieKey ? { selfie: selfieKey } : {}),
      uploadedAt: agora.toISOString(),
    });

    const docType =
      auth.role === "DIARISTA"
        ? "KYC_DOCS"
        : auth.role === "EMPREGADOR"
          ? "EMPREGADOR_KYC"
          : "MONTADOR_KYC";

    // Banco falhou depois do upload: os três arquivos não pertencem a envio
    // nenhum e são removidos (sem log de chave nem imagem).
    const chavesDoEnvio = [frenteKey, versoKey, ...(selfieKey ? [selfieKey] : [])];
    // Perfil e registro do envio na MESMA transação: antes, uma falha ao criar
    // o registro era engolida e a diarista ficava "pendente" com documentos
    // que o painel nunca mostrava.
    const updatedAt = await prisma.$transaction(async (tx) => {
      let atualizado: Date = agora;
      if (auth.role === "DIARISTA") {
        const updated = await tx.diaristaProfile.upsert({
          where: { userId: auth.userId },
          update: {
            verificacao: "PENDENTE",
            docUrl,
          },
          create: {
            userId: auth.userId,
            precoLeve: 0,
            precoPesada: 0,
            verificacao: "PENDENTE",
            docUrl,
          },
          select: { updatedAt: true },
        });
        atualizado = updated.updatedAt;
      }
      // Fotografia dos dados cadastrais DESTE envio, junto da frente e do verso.
      const dadosEnviados = await fotografarDadosCadastrais(tx, auth.userId, agora);
      await tx.documentVerification.create({
        data: {
          userId: auth.userId,
          docType,
          docUrl,
          createdAt: agora,
          reviewNote: `Submetido em ${agora.toISOString()}`,
          ...(dadosEnviados ? { dadosEnviados } : {}),
        },
      });
      return atualizado;
    }).catch(async (e) => {
      await removerOrfaos(chavesDoEnvio);
      throw e;
    });

    // Auto-verificação lateral (silenciosa). Só roda para DIARISTA — o
    // helper de empregador/montador (auto-aprovação por upload) não existe
    // por design: empregador/montador dependem de aprovação humana via
    // /api/admin/verificacoes/approve (T-18.6). Mesmo o caminho do diarista
    // só promove quando AUTO_VERIFY_PROFILES=true (QA/E2E).
    let statusFinal: "PENDENTE" | "VERIFICADO" | "REPROVADO" = "PENDENTE";
    if (auth.role === "DIARISTA") {
      try {
        statusFinal = await autoVerificarDiaristaSePossivel(auth.userId);
      } catch {
        statusFinal = "PENDENTE";
      }
    }

    // T-18.6: após persistir, recalcula o Guardian para devolver o estado
    // composto (verificação + restrições + score + completude) ao mobile.
    // O mobile usa esse retorno para mostrar exatamente o motivo do bloqueio.
    const guardian = await getGuardianStatusForUser(auth.userId).catch(() => null);

    return NextResponse.json({
      ok: true,
      verificacao: {
        status: statusFinal,
        updatedAt,
      },
      guardian,
    });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    if (e instanceof UploadIncompletoError) {
      console.error("[api/verificacoes] envio não concluído: falha ao subir arquivos.");
      return NextResponse.json({ ok: false, error: "Não foi possível enviar os arquivos. Tente de novo." }, { status: 502 });
    }
    if (e instanceof UploadValidationError) {
      console.warn("[api/verificacoes] upload recusado:", e.publicMessage);
      return NextResponse.json({ ok: false, error: e.publicMessage }, { status: 400 });
    }
    if (FORMIDABLE_CLIENT_ERROR_CODES.has(Number(e?.code))) {
      console.warn("[api/verificacoes] multipart recusado:", e?.code);
      return NextResponse.json({ ok: false, error: "Upload inválido." }, { status: 400 });
    }
    // O framework NÃO registra o erro sozinho: o smoke test de produção de
    // 30/08 bateu num 500 aqui e o log da Vercel veio com `logs: []`, sem
    // nenhuma pista da causa. Nome e mensagem passam a ser registrados em
    // qualquer ambiente (é log de servidor, não vai para o cliente); a stack
    // continua só em DEV para não despejar caminho de arquivo em produção.
    // Erro do Prisma pode repetir os argumentos (CPF da fotografia): só o código.
    // Nos demais, a mensagem vai sem números longos (CPF, telefone) nem chaves
    // ou URLs de arquivo.
    const doBanco = String(e?.name ?? "").startsWith("PrismaClient");
    const semDados = (m: unknown) =>
      String(m ?? "")
        .replace(/https?:\/\/\S+/g, "<url>")
        .replace(/verificacoes\/\S+/g, "<arquivo>")
        .replace(/\d[\d.\-]{5,}\d/g, "<número>");
    console.error("[api/verificacoes] POST falhou:", e?.name, doBanco ? e?.code ?? "" : semDados(e?.message));
    if (process.env.NODE_ENV === "development") {
      console.error(e?.stack);
    }
    return NextResponse.json({ ok: false, error: "Erro ao enviar documentos." }, { status: 500 });
  }
}
