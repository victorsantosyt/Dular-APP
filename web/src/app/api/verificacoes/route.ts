import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import type formidable from "formidable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { parseMultipart } from "@/lib/parseMultipart";
import { makeKey, putObject } from "@/lib/s3Objects";
import { autoVerificarDiaristaSePossivel } from "@/lib/autoVerificacao";
import { getGuardianStatusForUser } from "@/lib/safeScoreGuardian";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";
import { detectImageMime, extensionForMime } from "@/lib/imageMagicBytes";

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

export async function POST(req: Request) {
  try {
    cleanupRateLimit();

    const auth = requireAuth(req);
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

    const { files } = await parseMultipart(req, { maxFileSize: MAX_FILE_SIZE, maxFiles: 2 });
    const docFrente = firstFile(files.docFrente as formidable.File | formidable.File[] | undefined);
    const docVerso = firstFile(files.docVerso as formidable.File | formidable.File[] | undefined);

    if (!docFrente || !docVerso) {
      return NextResponse.json({ ok: false, error: "Envie frente e verso do documento." }, { status: 400 });
    }

    // Valida AMBOS antes de qualquer upload no S3 — evita upload parcial
    // (vazamento do arquivo válido) quando o outro arquivo é inválido.
    const [frenteData, versoData] = await Promise.all([
      validateDoc(docFrente),
      validateDoc(docVerso),
    ]);

    const [frente, verso] = await Promise.all([
      persistDoc(frenteData, `${auth.userId}/frente`),
      persistDoc(versoData, `${auth.userId}/verso`),
    ]);

    const docUrl = JSON.stringify({
      frente: frente.key,
      verso: verso.key,
      uploadedAt: new Date().toISOString(),
    });

    const docType =
      auth.role === "DIARISTA"
        ? "KYC_DOCS"
        : auth.role === "EMPREGADOR"
          ? "EMPREGADOR_KYC"
          : "MONTADOR_KYC";

    let updatedAt: Date = new Date();
    if (auth.role === "DIARISTA") {
      const updated = await prisma.diaristaProfile.upsert({
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
      updatedAt = updated.updatedAt;
    }

    await prisma.documentVerification
      .create({
        data: {
          userId: auth.userId,
          docType,
          docUrl,
          reviewNote: `Submetido em ${new Date().toISOString()}`,
        },
      })
      .catch(() => null);

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
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (e instanceof UploadValidationError) {
      console.warn("[api/verificacoes] upload recusado:", e.publicMessage);
      return NextResponse.json({ ok: false, error: e.publicMessage }, { status: 400 });
    }
    if (FORMIDABLE_CLIENT_ERROR_CODES.has(Number(e?.code))) {
      console.warn("[api/verificacoes] multipart recusado:", e?.code);
      return NextResponse.json({ ok: false, error: "Upload inválido." }, { status: 400 });
    }
    // T-18.6: log explícito para destravar diagnóstico em DEV. Em produção
    // o framework já registra o erro; aqui garantimos que o motivo real
    // aparece no console do `next dev` sem despejar stack em prod.
    if (process.env.NODE_ENV === "development") {
      console.error("[api/verificacoes] POST falhou:", e?.name, e?.message, e?.stack);
    }
    return NextResponse.json({ ok: false, error: "Erro ao enviar documentos." }, { status: 500 });
  }
}
