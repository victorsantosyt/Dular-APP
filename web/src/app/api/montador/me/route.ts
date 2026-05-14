import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { getFaixa } from "@/lib/safeScore";
import {
  calcularCompletudeMontador,
  cleanStringArray,
  normalizeEspecialidades,
} from "@/lib/montadorProfile";

export const dynamic = "force-dynamic";

const centsSchema = z.number().int().min(0).max(10_000_000).nullable().optional();

const patchSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  telefone: z.string().trim().max(30).nullable().optional(),
  bio: z.string().trim().max(800).nullable().optional(),
  anosExperiencia: z.number().int().min(0).max(80).nullable().optional(),
  especialidades: z
    .array(z.string().trim().min(2).max(80))
    .max(12)
    .refine((values) => values.every((value) => normalizeEspecialidades([value]).length === 1), {
      message: "Especialidades inválidas.",
    })
    .optional(),
  cidade: z.string().trim().max(80).nullable().optional(),
  estado: z.string().trim().min(2).max(2).nullable().optional(),
  bairros: z.array(z.string().trim().min(2).max(80)).max(30).optional(),
  raioAtendimentoKm: z.number().int().min(1).max(200).nullable().optional(),
  atendeTodaCidade: z.boolean().optional(),
  precoBase: centsSchema,
  taxaMinima: centsSchema,
  cobraDeslocamento: z.boolean().optional(),
  observacaoPreco: z.string().trim().max(300).nullable().optional(),
  valorACombinar: z.boolean().optional(),
  ativo: z.boolean().optional(),
  portfolioFotos: z.array(z.string().trim().min(5).max(500)).max(12).optional(),
});

async function buildMontadorMeResponse(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) return null;

  const perfil = await prisma.montadorPerfil.upsert({
    where: { userId },
    update: {},
    create: { userId, especialidades: [], bairros: [], portfolioFotos: [] },
    select: {
      id: true,
      userId: true,
      bio: true,
      especialidades: true,
      anosExperiencia: true,
      cidade: true,
      estado: true,
      cidadeAtual: true,
      estadoAtual: true,
      bairroAtual: true,
      latitude: true,
      longitude: true,
      localizacaoPermitida: true,
      localizacaoAtualizadaEm: true,
      bairros: true,
      atendeTodaCidade: true,
      raioAtendimentoKm: true,
      fotoPerfil: true,
      portfolioFotos: true,
      precoBase: true,
      taxaMinima: true,
      cobraDeslocamento: true,
      observacaoPreco: true,
      valorACombinar: true,
      documentoFrente: true,
      documentoVerso: true,
      selfieDoc: true,
      verificado: true,
      ativo: true,
      rating: true,
      totalServicos: true,
      updatedAt: true,
    },
  });

  const [safeScoreProfile, legacySafeScore, avaliacoes, totalAvaliacoes] = await Promise.all([
    prisma.safeScoreProfile.findUnique({
      where: { userId },
      select: { currentScore: true, tier: true },
    }),
    prisma.safeScore.findUnique({
      where: { userId },
      select: { score: true },
    }),
    prisma.avaliacao.findMany({
      where: { montadorId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        notaGeral: true,
        pontualidade: true,
        qualidade: true,
        comunicacao: true,
        comentario: true,
        createdAt: true,
      },
    }),
    prisma.avaliacao.count({ where: { montadorId: userId } }),
  ]);

  const score = safeScoreProfile?.currentScore ?? legacySafeScore?.score ?? 500;
  const faixa = getFaixa(score);
  const hasDocs = Boolean(perfil.documentoFrente || perfil.documentoVerso || perfil.selfieDoc);
  const completude = calcularCompletudeMontador({
    nome: user.nome,
    bio: perfil.bio,
    especialidades: perfil.especialidades,
    cidade: perfil.cidade,
    estado: perfil.estado,
    bairros: perfil.bairros,
    atendeTodaCidade: perfil.atendeTodaCidade,
    ativo: perfil.ativo,
    userStatus: user.status,
  });

  return {
    ok: true,
    user: {
      ...user,
      bio: perfil.bio,
      avatarUrl: perfil.fotoPerfil ?? user.avatarUrl ?? null,
      verificado: perfil.verificado,
      docEnviado: hasDocs,
      verificacao: {
        status: perfil.verificado ? "APROVADO" : hasDocs ? "PENDENTE" : "NAO_ENVIADO",
      },
      notaMedia: perfil.rating,
      totalServicos: perfil.totalServicos,
      especialidades: perfil.especialidades,
      cidade: perfil.cidade,
      estado: perfil.estado,
      cidadeAtual: perfil.cidadeAtual,
      estadoAtual: perfil.estadoAtual,
      bairroAtual: perfil.bairroAtual,
      localizacaoPermitida: perfil.localizacaoPermitida,
      localizacaoAtualizadaEm: perfil.localizacaoAtualizadaEm,
      bairros: perfil.bairros,
    },
    perfil: {
      ...perfil,
      documentosEnviados: hasDocs,
      verificacaoStatus: perfil.verificado ? "APROVADO" : hasDocs ? "PENDENTE" : "NAO_ENVIADO",
      completude,
      safeScore: {
        score,
        faixa: faixa.label,
        cor: faixa.cor,
        bloqueado: faixa.bloqueado,
        tier: safeScoreProfile?.tier ?? "BRONZE",
        totalServicos: perfil.totalServicos,
        verificado: perfil.verificado,
      },
      avaliacoes: {
        media: perfil.rating,
        total: totalAvaliacoes,
        itens: avaliacoes,
      },
    },
  };
}

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "MONTADOR") {
      return NextResponse.json({ ok: false, error: "Apenas montador pode acessar este perfil." }, { status: 403 });
    }

    const payload = await buildMontadorMeResponse(auth.userId);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "MONTADOR") {
      return NextResponse.json({ ok: false, error: "Apenas montador pode editar este perfil." }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
    }

    const data = parsed.data;
    const userData: { nome?: string; telefone?: string | null } = {};
    if (data.nome !== undefined) userData.nome = data.nome.trim();
    if (data.telefone !== undefined) userData.telefone = data.telefone?.trim() || null;

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: userData,
      });
    }

    const profileData: Record<string, unknown> = {};
    if (data.bio !== undefined) profileData.bio = data.bio?.trim() || null;
    if (data.anosExperiencia !== undefined) profileData.anosExperiencia = data.anosExperiencia;
    if (data.especialidades !== undefined) profileData.especialidades = normalizeEspecialidades(data.especialidades);
    if (data.cidade !== undefined) profileData.cidade = data.cidade?.trim() || null;
    if (data.estado !== undefined) profileData.estado = data.estado?.trim().toUpperCase() || null;
    if (data.bairros !== undefined) profileData.bairros = cleanStringArray(data.bairros);
    if (data.raioAtendimentoKm !== undefined) profileData.raioAtendimentoKm = data.raioAtendimentoKm;
    if (data.atendeTodaCidade !== undefined) profileData.atendeTodaCidade = data.atendeTodaCidade;
    if (data.precoBase !== undefined) profileData.precoBase = data.precoBase;
    if (data.taxaMinima !== undefined) profileData.taxaMinima = data.taxaMinima;
    if (data.cobraDeslocamento !== undefined) profileData.cobraDeslocamento = data.cobraDeslocamento;
    if (data.observacaoPreco !== undefined) profileData.observacaoPreco = data.observacaoPreco?.trim() || null;
    if (data.valorACombinar !== undefined) profileData.valorACombinar = data.valorACombinar;
    if (data.ativo !== undefined) profileData.ativo = data.ativo;
    if (data.portfolioFotos !== undefined) profileData.portfolioFotos = cleanStringArray(data.portfolioFotos, 12);

    await prisma.montadorPerfil.upsert({
      where: { userId: auth.userId },
      update: profileData,
      create: {
        userId: auth.userId,
        especialidades: [],
        bairros: [],
        portfolioFotos: [],
        ...profileData,
      },
    });

    const payload = await buildMontadorMeResponse(auth.userId);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
