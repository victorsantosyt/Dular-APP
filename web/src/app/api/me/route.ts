import { NextResponse } from "next/server";
import { decisaoVigente } from "@/lib/decisaoVerificacao";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { anonimizarUsuario } from "@/lib/lgpd";
import { getMontadorVerificationStatus } from "@/lib/profileVerification";
import { OperacaoEmAndamento, comTravaDoUsuario, consultarLojasDoUsuario } from "@/lib/trocaDePlano";

export const dynamic = "force-dynamic";

const mapVerificacao = (status?: string | null) => {
  if (!status) return "PENDENTE";
  const s = status.toUpperCase();
  if (s === "VERIFICADO") return "APROVADO";
  if (s === "REPROVADO") return "REPROVADO";
  return "PENDENTE";
};

const mapDocumentVerification = (status?: string | null) => {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "APPROVED") return "APROVADO";
  if (s === "REJECTED") return "REPROVADO";
  if (s === "PENDING") return "PENDENTE";
  return null;
};

function parsePositiveCents(value: unknown) {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

function staleSessionResponse() {
  return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = await requireAuthAtivo(req);
    if (isDev) console.log(`[me GET] auth: ${Date.now() - tAuth}ms`);

    // Roda user + perfil em paralelo (eram 2 awaits sequenciais; agora 1 round-trip).
    const userP = prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        nome: true,
        nomeCompleto: true,
        telefone: true,
        cpf: true,
        dataNascimento: true,
        email: true,
        genero: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
    // Decisão do envio mais recente: o app mostra o motivo de reprovação ou
    // reenvio. Campos novos, aditivos — versões anteriores do app os ignoram.
    const decisaoP = prisma.documentVerification
      .findFirst({
        where: { userId: auth.userId },
        orderBy: { createdAt: "desc" },
        select: { status: true, decisao: true, motivoUsuario: true },
      })
      .then((d) => ({
        decisaoVerificacao: d && d.status !== "PENDING" ? decisaoVigente(d.status, d.decisao) : null,
        motivoVerificacao: d?.status === "REJECTED" ? d.motivoUsuario ?? null : null,
      }))
      // Auxiliar: falha aqui não derruba /api/me (e o caminho sem papel nem a espera).
      .catch(() => ({ decisaoVerificacao: null, motivoVerificacao: null }));

    if (auth.role === "DIARISTA") {
      const tQuery = Date.now();
      const [user, profile, decisao] = await Promise.all([
        userP,
        prisma.diaristaProfile.findUnique({
          where: { userId: auth.userId },
          select: {
            bio: true,
            fotoUrl: true,
            verificacao: true,
            docUrl: true,
            servicosOferecidos: true,
            precoLeve: true,
            precoMedio: true,
            precoPesada: true,
          },
        }),
        decisaoP,
      ]);
      if (isDev) console.log(`[me GET DIARISTA] queries: ${Date.now() - tQuery}ms`);

      if (!user) {
        return staleSessionResponse();
      }

      if (isDev) console.log(`[me GET DIARISTA] TOTAL: ${Date.now() - t0}ms`);
      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.fotoUrl ?? user.avatarUrl ?? null,
          verificacao: { status: mapVerificacao(profile?.verificacao) },
          docEnviado: Boolean(profile?.docUrl),
          ...decisao,
          // Sem isto o gate "Quais serviços você oferece" reaparecia a cada login
          // (o app recebia servicosOferecidos vazio e reabria o gate).
          servicosOferecidos: profile?.servicosOferecidos ?? [],
          precoLeve: profile?.precoLeve ?? null,
          precoMedio: profile?.precoMedio ?? null,
          precoPesada: profile?.precoPesada ?? null,
          precoPesado: profile?.precoPesada ?? null,
        },
      });
    }

    if (auth.role === "MONTADOR") {
      const tQuery = Date.now();
      const [user, profile, decisao] = await Promise.all([
        userP,
        prisma.montadorPerfil.findUnique({
          where: { userId: auth.userId },
          select: {
            bio: true,
            fotoPerfil: true,
            documentoFrente: true,
            documentoVerso: true,
            selfieDoc: true,
            verificado: true,
            rating: true,
            totalServicos: true,
            especialidades: true,
            cidade: true,
            estado: true,
            cidadeAtual: true,
            estadoAtual: true,
            bairroAtual: true,
            localizacaoPermitida: true,
            localizacaoAtualizadaEm: true,
          },
        }),
        decisaoP,
      ]);
      if (isDev) console.log(`[me GET MONTADOR] queries: ${Date.now() - tQuery}ms`);

      if (!user) {
        return staleSessionResponse();
      }

      const hasDocs = Boolean(profile?.documentoFrente || profile?.documentoVerso || profile?.selfieDoc);
      const verificationStatus = await getMontadorVerificationStatus(auth.userId);

      if (isDev) console.log(`[me GET MONTADOR] TOTAL: ${Date.now() - t0}ms`);
      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.fotoPerfil ?? user.avatarUrl ?? null,
          verificado: Boolean(profile?.verificado),
          docEnviado: hasDocs,
          verificacao: { status: verificationStatus === "VERIFICADO" ? "APROVADO" : verificationStatus },
          ...decisao,
          notaMedia: profile?.rating ?? 0,
          totalServicos: profile?.totalServicos ?? 0,
          especialidades: profile?.especialidades ?? [],
          cidade: profile?.cidade ?? null,
          estado: profile?.estado ?? null,
          cidadeAtual: profile?.cidadeAtual ?? null,
          estadoAtual: profile?.estadoAtual ?? null,
          bairroAtual: profile?.bairroAtual ?? null,
          localizacaoPermitida: profile?.localizacaoPermitida ?? false,
          localizacaoAtualizadaEm: profile?.localizacaoAtualizadaEm ?? null,
        },
      });
    }

    if (auth.role === "EMPREGADOR") {
      const tQuery = Date.now();
      const [user, profile, documentVerification, decisao] = await Promise.all([
        userP,
        prisma.empregadorPerfil.findUnique({
          where: { userId: auth.userId },
          select: {
            cidade: true,
            estado: true,
            fotoPerfil: true,
            cidadeAtual: true,
            estadoAtual: true,
            bairroAtual: true,
            localizacaoPermitida: true,
            localizacaoAtualizadaEm: true,
          },
        }),
        prisma.documentVerification.findFirst({
          where: { userId: auth.userId },
          orderBy: { updatedAt: "desc" },
          select: {
            docType: true,
            docUrl: true,
            status: true,
            updatedAt: true,
          },
        }),
        decisaoP,
      ]);
      if (isDev) console.log(`[me GET EMPREGADOR] queries: ${Date.now() - tQuery}ms`);

      if (!user) {
        return staleSessionResponse();
      }

      const verificacaoStatus = mapDocumentVerification(documentVerification?.status);
      const estado = profile?.estado ?? profile?.estadoAtual ?? null;

      if (isDev) console.log(`[me GET EMPREGADOR] TOTAL: ${Date.now() - t0}ms`);
      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          cidade: profile?.cidade ?? profile?.cidadeAtual ?? null,
          estado,
          uf: estado,
          bairro: profile?.bairroAtual ?? null,
          cidadeAtual: profile?.cidadeAtual ?? null,
          estadoAtual: profile?.estadoAtual ?? null,
          bairroAtual: profile?.bairroAtual ?? null,
          localizacaoPermitida: profile?.localizacaoPermitida ?? false,
          localizacaoAtualizadaEm: profile?.localizacaoAtualizadaEm ?? null,
          bio: null,
          avatarUrl: profile?.fotoPerfil ?? user.avatarUrl ?? null,
          verificado: verificacaoStatus === "APROVADO",
          docEnviado: Boolean(documentVerification?.docUrl),
          ...decisao,
          verificacao: verificacaoStatus
            ? {
                status: verificacaoStatus,
                docType: documentVerification?.docType ?? null,
                updatedAt: documentVerification?.updatedAt ?? null,
              }
            : null,
          documentos: verificacaoStatus
            ? {
                status: verificacaoStatus,
                docType: documentVerification?.docType ?? null,
                enviado: Boolean(documentVerification?.docUrl),
                updatedAt: documentVerification?.updatedAt ?? null,
              }
            : null,
        },
      });
    }

    // Cliente sem role específica
    const tQueryDefault = Date.now();
    const user = await userP;
    if (isDev) console.log(`[me GET DEFAULT] user query: ${Date.now() - tQueryDefault}ms`);
    if (!user) {
      return staleSessionResponse();
    }

    if (isDev) console.log(`[me GET DEFAULT] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({
      ok: true,
      user: {
        ...user,
        bio: null,
        avatarUrl: user.avatarUrl ?? null,
        verificacao: { status: "PENDENTE" },
      },
    });
  } catch (e: any) {
    if (isDev) console.log(`[me GET] ERROR after ${Date.now() - t0}ms: ${e?.message}`);
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    // Era por aqui que uma conta REMOVIDO reescrevia nome e e-mail depois de a
    // exclusão os ter anulado: respondia 200 e ainda devolvia status REMOVIDO
    // no corpo. Medido contra build de produção antes desta correção.
    const auth = await requireAuthAtivo(req);
    const body = await req.json();

    const { nome, email, telefone, bio, precoLeve, precoMedio, precoPesado, precoPesada, genero } = body as {
      nome?: string;
      email?: string;
      telefone?: string;
      bio?: string;
      precoLeve?: number;
      precoMedio?: number;
      precoPesado?: number;
      precoPesada?: number;
      genero?: "MASCULINO" | "FEMININO";
    };

    // FASE 3 (gate de gênero) — backfill atômico: grava o gênero UMA única vez,
    // quando a conta ainda não tem (genero: null). Nunca troca um gênero já
    // definido (set once). Não afeta os demais campos deste handler.
    if (genero === "MASCULINO" || genero === "FEMININO") {
      await prisma.user.updateMany({
        where: { id: auth.userId, genero: null },
        data: { genero },
      });
    }

    const data: any = {};
    if (typeof nome === "string") data.nome = nome.trim();
    if (typeof email === "string") data.email = email.trim() || null;
    // telefone é String? @unique no schema: normaliza vazio→null para não
    // colidir no índice único e para permitir limpar o campo.
    if (typeof telefone === "string") data.telefone = telefone.trim() || null;

    // Troca de senha removida: nenhuma tela a chamava (nem no app, nem no
    // painel) e o app entra por OAuth. A única conta com senha é a de ADMIN,
    // e ela rotaciona a própria senha por /api/admin/admins/create, que faz
    // upsert pelo telefone.
    //
    // Manter um caminho de ESCRITA de senha que ninguém usa é a mesma
    // superfície que o cadastro público removido: fica aí até alguém religar.

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        genero: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    const profileData: {
      bio?: string | null;
      precoLeve?: number;
      precoMedio?: number;
      precoPesada?: number;
    } = {};

    if (typeof bio === "string") {
      profileData.bio = bio.trim() || null;
    }

    const parsedLeve = parsePositiveCents(precoLeve);
    const parsedPesada = parsePositiveCents(precoPesada ?? precoPesado);
    const parsedMedio = parsePositiveCents(precoMedio);

    if (parsedLeve === null || parsedPesada === null || parsedMedio === null) {
      return NextResponse.json({ ok: false, error: "Preços inválidos." }, { status: 400 });
    }

    if (parsedLeve != null) profileData.precoLeve = parsedLeve;
    if (parsedMedio != null) profileData.precoMedio = parsedMedio;
    if (parsedPesada != null) profileData.precoPesada = parsedPesada;

    let profile: {
      bio: string | null;
      fotoUrl: string | null;
      verificacao: string;
      docUrl: string | null;
      precoLeve: number;
      precoMedio: number;
      precoPesada: number;
    } | null = null;

    if (Object.keys(profileData).length > 0 && auth.role === "DIARISTA") {
      profile = await prisma.diaristaProfile.upsert({
        where: { userId: auth.userId },
        update: profileData,
        create: {
          userId: auth.userId,
          precoLeve: profileData.precoLeve ?? 0,
          precoMedio: profileData.precoMedio ?? 0,
          precoPesada: profileData.precoPesada ?? 0,
          bio: profileData.bio,
        },
        select: {
          bio: true,
          fotoUrl: true,
          verificacao: true,
          docUrl: true,
          precoLeve: true,
          precoMedio: true,
          precoPesada: true,
        },
      });
    } else if (Object.keys(profileData).length > 0 && auth.role === "MONTADOR") {
      const montador = await prisma.montadorPerfil.upsert({
        where: { userId: auth.userId },
        update: {
          ...(profileData.bio !== undefined ? { bio: profileData.bio } : {}),
        },
        create: {
          userId: auth.userId,
          especialidades: [],
          bio: profileData.bio,
        },
        select: {
          bio: true,
          fotoPerfil: true,
          verificado: true,
          documentoFrente: true,
          documentoVerso: true,
          selfieDoc: true,
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          bio: montador.bio,
          avatarUrl: montador.fotoPerfil ?? user.avatarUrl ?? null,
          verificado: montador.verificado,
          docEnviado: Boolean(montador.documentoFrente || montador.documentoVerso || montador.selfieDoc),
          verificacao: {
            status: montador.verificado
              ? "APROVADO"
              : montador.documentoFrente || montador.documentoVerso || montador.selfieDoc
                ? "PENDENTE"
                : "NAO_ENVIADO",
          },
        },
      });
    } else if (auth.role === "DIARISTA") {
      profile = await prisma.diaristaProfile.findUnique({
        where: { userId: auth.userId },
        select: {
          bio: true,
          fotoUrl: true,
          verificacao: true,
          docUrl: true,
          precoLeve: true,
          precoMedio: true,
          precoPesada: true,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        ...user,
        ...(profile
          ? {
              bio: profile.bio,
              avatarUrl: profile.fotoUrl ?? user.avatarUrl ?? null,
              verificacao: { status: mapVerificacao(profile.verificacao) },
              docEnviado: Boolean(profile.docUrl),
              precoLeve: profile.precoLeve,
              precoMedio: profile.precoMedio,
              precoPesada: profile.precoPesada,
              precoPesado: profile.precoPesada,
            }
          : {}),
      },
    });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? (e.meta?.target as string[]) : [];
      const campo = target.includes("telefone")
        ? "telefone"
        : target.includes("email")
          ? "e-mail"
          : "dado";
      return NextResponse.json(
        { ok: false, error: `Este ${campo} já está em uso por outra conta.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

/**
 * DELETE /api/me — exclusão da própria conta (LGPD, art. 18).
 *
 * Não apaga a linha do usuário: anonimiza. O porquê está em `@/lib/lgpd`.
 * Exige confirmação explícita no corpo para não ser disparado por engano por
 * um cliente que faça DELETE sem querer.
 */
const CONFIRMACAO_EXIGIDA = "EXCLUIR MINHA CONTA";

/** Status com obrigação pendente: some no meio deixa a outra parte na mão. */
const STATUS_EM_ABERTO = [
  "SOLICITADO",
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
] as const;

export async function DELETE(req: Request) {
  try {
    const auth = requireAuth(req);
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);

    if (body?.confirmacao !== CONFIRMACAO_EXIGIDA) {
      return NextResponse.json(
        {
          ok: false,
          error: "CONFIRMACAO_INVALIDA",
          message: `Para excluir a conta, envie { "confirmacao": "${CONFIRMACAO_EXIGIDA}" }.`,
        },
        { status: 400 },
      );
    }

    const emAberto = await prisma.servico.count({
      where: {
        status: { in: [...STATUS_EM_ABERTO] },
        OR: [{ clientId: auth.userId }, { diaristaId: auth.userId }, { montadorId: auth.userId }],
      },
    });
    if (emAberto > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "SERVICOS_EM_ABERTO",
          message:
            "Você tem serviço em andamento. Conclua ou cancele antes de excluir a conta.",
          servicosEmAberto: emAberto,
        },
        { status: 409 },
      );
    }

    // Assinatura viva impede a exclusão, no mesmo espírito do serviço em
    // aberto: sair no meio deixa uma obrigação pendurada.
    //
    // Por que BLOQUEAR em vez de cancelar por nós: assinatura comprada pela
    // App Store ou pelo Google Play não pode ser cancelada pelo backend —
    // só o próprio usuário cancela, nas configurações do aparelho. Cancelar
    // pelo Stripe cobriria um caso e falharia em silêncio nos outros dois,
    // e o pior desfecho aqui é a pessoa achar que parou de pagar e continuar
    // sendo cobrada, sem conta para reclamar.
    //
    // `provider` vai na resposta para o app dizer ONDE cancelar. O texto fica
    // no app, não aqui.
    //
    // Tudo sob a trava da pessoa, a mesma do checkout e da compra de loja:
    // nenhuma compra surge entre a conferência e a exclusão (quem esperou pela
    // trava encontra a conta já excluída e não compra).
    let decisao;
    try {
      decisao = await comTravaDoUsuario(auth.userId, async () => {
        const assinatura = await prisma.subscription.findUnique({
          where: { userId: auth.userId },
          select: { plan: true, status: true, provider: true, expiresAt: true },
        });
        const assinaturaViva =
          assinatura != null &&
          (assinatura.status === "ACTIVE" || assinatura.status === "TRIAL") &&
          (!assinatura.expiresAt || assinatura.expiresAt.getTime() > Date.now());
        if (assinaturaViva) {
          return { tipo: "viva" as const, assinatura: { provider: assinatura.provider, plan: assinatura.plan, expiresAt: assinatura.expiresAt } };
        }

        // Compra de loja: a situação ATUAL, consultada agora — o gravado nunca
        // prova que a loja parou de cobrar. Ainda vale ou ainda renova: bloqueia.
        // Sem resposta (ou resposta incompleta): não exclui. Encerrada: segue.
        const lojas = await consultarLojasDoUsuario(auth.userId);
        if (lojas.vigente || lojas.renova) {
          const compra = await prisma.assinaturaLoja.findFirst({
            where: { userId: auth.userId, OR: [{ vigente: true }, { renova: true }] },
            orderBy: { verificadaEm: "desc" },
            select: { plan: true, provider: true, expiraEm: true },
          });
          return { tipo: "viva" as const, assinatura: { provider: compra?.provider ?? null, plan: compra?.plan ?? null, expiresAt: compra?.expiraEm ?? null } };
        }
        if (lojas.desconhecida) return { tipo: "loja_indisponivel" as const };

        return { tipo: "excluida" as const, resumo: await anonimizarUsuario(auth.userId) };
      });
    } catch (err) {
      if (err instanceof OperacaoEmAndamento) {
        return NextResponse.json(
          { ok: false, error: "OPERACAO_EM_ANDAMENTO", message: "Há uma operação da sua conta em andamento. Tente novamente em instantes." },
          { status: 409 },
        );
      }
      throw err;
    }

    if (decisao.tipo === "viva") {
      return NextResponse.json(
        {
          ok: false,
          error: "SUBSCRIPTION_ACTIVE",
          message: "Cancele sua assinatura antes de excluir a conta.",
          assinatura: decisao.assinatura,
        },
        { status: 409 },
      );
    }
    if (decisao.tipo === "loja_indisponivel") {
      return NextResponse.json(
        {
          ok: false,
          error: "LOJA_INDISPONIVEL",
          message: "Não foi possível confirmar sua assinatura na loja agora. Tente novamente mais tarde.",
        },
        { status: 503 },
      );
    }
    const { resumo } = decisao;

    const res = NextResponse.json({
      ok: true,
      message:
        "Conta excluída. Seus dados pessoais foram apagados. Serviços, avaliações e " +
        "incidentes continuam registrados sem vínculo com você, como descrito na " +
        "política de privacidade.",
      resumo,
    });
    // A sessão morre junto — o token continuaria válido por 7 dias.
    res.cookies.set("dular_token", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    if (msg === "USUARIO_NAO_ENCONTRADO") return staleSessionResponse();
    if (msg === "JA_REMOVIDO") {
      return NextResponse.json({ ok: false, error: "Conta já excluída." }, { status: 409 });
    }
    console.error("[api/me] DELETE falhou:", msg);
    return NextResponse.json({ ok: false, error: "Erro ao excluir a conta." }, { status: 500 });
  }
}
