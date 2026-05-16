import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import {
  getDiaristaProfileCompleteness,
  SERVICOS_OFERECIDOS_VALIDOS,
} from "@/lib/diaristaProfile";

export const dynamic = "force-dynamic";

const SERVICOS_PERMITIDOS = SERVICOS_OFERECIDOS_VALIDOS as readonly string[];

const ALLOWED_PATCH_FIELDS = [
  "bio",
  "ativo",
  "servicosOferecidos",
  "cidade",
  "estado",
  "atendeTodaCidade",
  "raioAtendimentoKm",
  "anosExperiencia",
  "precoLeve",
  "precoMedio",
  "precoPesada",
  "precoBabaHora",
  "precoCozinheiraBase",
  "taxaMinima",
  "cobraDeslocamento",
  "valorACombinar",
  "observacaoPreco",
] as const;

type AllowedField = (typeof ALLOWED_PATCH_FIELDS)[number];

const STRING_NULLABLE_FIELDS: ReadonlySet<AllowedField> = new Set([
  "bio",
  "cidade",
  "estado",
  "observacaoPreco",
]);

const BOOLEAN_FIELDS: ReadonlySet<AllowedField> = new Set([
  "ativo",
  "atendeTodaCidade",
  "cobraDeslocamento",
  "valorACombinar",
]);

const INT_NULLABLE_FIELDS: ReadonlySet<AllowedField> = new Set([
  "raioAtendimentoKm",
  "anosExperiencia",
]);

const INT_REQUIRED_FIELDS: ReadonlySet<AllowedField> = new Set([
  "precoLeve",
  "precoMedio",
  "precoPesada",
]);

const DECIMAL_NULLABLE_FIELDS: ReadonlySet<AllowedField> = new Set([
  "precoBabaHora",
  "precoCozinheiraBase",
  "taxaMinima",
]);

const MAX_STRING_LEN: Partial<Record<AllowedField, number>> = {
  bio: 1000,
  cidade: 120,
  estado: 64,
  observacaoPreco: 500,
};

function toDecimalString(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return trimmed;
  }
  return null;
}

function validateField(
  field: AllowedField,
  value: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  if (field === "servicosOferecidos") {
    if (!Array.isArray(value)) {
      return { ok: false, error: "servicosOferecidos deve ser array." };
    }
    const invalid = value.filter(
      (v) => typeof v !== "string" || !SERVICOS_PERMITIDOS.includes(v),
    );
    if (invalid.length > 0) {
      return {
        ok: false,
        error: `Valores inválidos em servicosOferecidos: ${invalid.join(", ")}`,
      };
    }
    return { ok: true, value };
  }

  if (STRING_NULLABLE_FIELDS.has(field)) {
    if (value === null) return { ok: true, value: null };
    if (typeof value !== "string") return { ok: false, error: `${field} deve ser string.` };
    const max = MAX_STRING_LEN[field] ?? 500;
    if (value.length > max) return { ok: false, error: `${field} muito longo (máx ${max}).` };
    return { ok: true, value };
  }

  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof value !== "boolean") return { ok: false, error: `${field} deve ser boolean.` };
    return { ok: true, value };
  }

  if (INT_REQUIRED_FIELDS.has(field)) {
    if (!Number.isInteger(value) || (value as number) < 0) {
      return { ok: false, error: `${field} deve ser inteiro >= 0.` };
    }
    return { ok: true, value };
  }

  if (INT_NULLABLE_FIELDS.has(field)) {
    if (value === null) return { ok: true, value: null };
    if (!Number.isInteger(value) || (value as number) < 0) {
      return { ok: false, error: `${field} deve ser inteiro >= 0 ou null.` };
    }
    return { ok: true, value };
  }

  if (DECIMAL_NULLABLE_FIELDS.has(field)) {
    if (value === null) return { ok: true, value: null };
    const asString = toDecimalString(value);
    if (asString === null) {
      return { ok: false, error: `${field} deve ser número > 0 ou null.` };
    }
    const n = Number(asString);
    if (!(n > 0)) {
      return { ok: false, error: `${field} deve ser > 0.` };
    }
    // Prisma aceita string para Decimal e converte internamente.
    return { ok: true, value: new Prisma.Decimal(asString) };
  }

  return { ok: false, error: `Campo ${field} não suportado.` };
}

const PROFILE_SELECT = {
  id: true,
  userId: true,
  verificacao: true,
  ativo: true,
  fotoUrl: true,
  docUrl: true,
  bio: true,
  precoLeve: true,
  precoMedio: true,
  precoPesada: true,
  notaMedia: true,
  totalServicos: true,
  servicosOferecidos: true,
  cidade: true,
  estado: true,
  latitude: true,
  longitude: true,
  cidadeAtual: true,
  estadoAtual: true,
  bairroAtual: true,
  localizacaoPermitida: true,
  localizacaoAtualizadaEm: true,
  atendeTodaCidade: true,
  raioAtendimentoKm: true,
  anosExperiencia: true,
  precoBabaHora: true,
  precoCozinheiraBase: true,
  taxaMinima: true,
  cobraDeslocamento: true,
  valorACombinar: true,
  observacaoPreco: true,
  portfolioFotos: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      nome: true,
      telefone: true,
      status: true,
      avatarUrl: true,
      habilidades: {
        select: {
          id: true,
          tipo: true,
          categoria: true,
        },
        orderBy: [{ tipo: "asc" }, { categoria: "asc" }],
      },
    },
  },
  agenda: {
    select: {
      id: true,
      diaSemana: true,
      turno: true,
      ativo: true,
    },
    orderBy: [{ diaSemana: "asc" }, { turno: "asc" }],
  },
  bairros: {
    select: {
      id: true,
      bairroId: true,
      bairro: {
        select: { id: true, nome: true, cidade: true, uf: true },
      },
    },
  },
} as const satisfies Prisma.DiaristaProfileSelect;

export async function GET(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[diarista/me GET] auth: ${Date.now() - tAuth}ms`);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const tQuery = Date.now();
    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId: auth.userId },
      select: PROFILE_SELECT,
    });

    if (isDev) console.log(`[diarista/me GET] profile query: ${Date.now() - tQuery}ms`);

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 404 });
    }

    const completude = getDiaristaProfileCompleteness({
      ativo: profile.ativo,
      bio: profile.bio,
      servicosOferecidos: profile.servicosOferecidos,
      cidade: profile.cidade,
      estado: profile.estado,
      atendeTodaCidade: profile.atendeTodaCidade,
      raioAtendimentoKm: profile.raioAtendimentoKm,
      precoLeve: profile.precoLeve,
      precoMedio: profile.precoMedio,
      precoPesada: profile.precoPesada,
      precoBabaHora: profile.precoBabaHora,
      precoCozinheiraBase: profile.precoCozinheiraBase,
      taxaMinima: profile.taxaMinima,
      valorACombinar: profile.valorACombinar,
      bairros: profile.bairros,
      user: profile.user
        ? { nome: profile.user.nome, status: profile.user.status }
        : null,
    });

    if (isDev) console.log(`[diarista/me GET] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true, profile, completude });
  } catch (error: unknown) {
    if (isDev) {
      const msg = error instanceof Error ? error.message : "unknown";
      console.log(`[diarista/me GET] ERROR after ${Date.now() - t0}ms: ${msg}`);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const t0 = Date.now();
  const isDev = process.env.NODE_ENV === "development";
  try {
    const tAuth = Date.now();
    const auth = requireAuth(req);
    if (isDev) console.log(`[diarista/me PATCH] auth: ${Date.now() - tAuth}ms`);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diarista." }, { status: 403 });
    }

    const tBody = Date.now();
    const body = await req.json();
    if (isDev) console.log(`[diarista/me PATCH] body parse: ${Date.now() - tBody}ms`);

    const tValidate = Date.now();

    // Branch RÁPIDO: body contém APENAS servicosOferecidos → update mínimo
    // (sem carregar o perfil inteiro). Mantém compat com clientes existentes.
    const bodyKeys = Object.keys(body ?? {});
    const onlyServicos =
      bodyKeys.length === 1 && Array.isArray(body.servicosOferecidos);
    if (onlyServicos) {
      const validated = validateField("servicosOferecidos", body.servicosOferecidos);
      if (!validated.ok) {
        if (isDev) console.log(`[diarista/me PATCH] validate: ${Date.now() - tValidate}ms (invalid)`);
        return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
      }
      const tUpdate = Date.now();
      const updated = await prisma.diaristaProfile.update({
        where: { userId: auth.userId },
        data: { servicosOferecidos: validated.value as string[] },
        select: { servicosOferecidos: true },
      });
      if (isDev) console.log(`[diarista/me PATCH] update (fast): ${Date.now() - tUpdate}ms`);
      if (isDev) console.log(`[diarista/me PATCH] TOTAL: ${Date.now() - t0}ms`);
      return NextResponse.json({ ok: true, servicosOferecidos: updated.servicosOferecidos });
    }

    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_PATCH_FIELDS) {
      if (body[field] === undefined) continue;
      const validated = validateField(field, body[field]);
      if (!validated.ok) {
        if (isDev) console.log(`[diarista/me PATCH] validate: ${Date.now() - tValidate}ms (invalid)`);
        return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
      }
      data[field] = validated.value;
    }

    if (Object.keys(data).length === 0) {
      if (isDev) console.log(`[diarista/me PATCH] validate: ${Date.now() - tValidate}ms (empty)`);
      return NextResponse.json({ ok: false, error: "Nenhum campo para atualizar." }, { status: 400 });
    }
    if (isDev) console.log(`[diarista/me PATCH] validate: ${Date.now() - tValidate}ms`);

    const tUpdate = Date.now();
    const profile = await prisma.diaristaProfile.update({
      where: { userId: auth.userId },
      data,
    });
    if (isDev) console.log(`[diarista/me PATCH] update: ${Date.now() - tUpdate}ms`);

    if (isDev) console.log(`[diarista/me PATCH] TOTAL: ${Date.now() - t0}ms`);
    return NextResponse.json({ ok: true, profile });
  } catch (error: unknown) {
    if (isDev) {
      const msg = error instanceof Error ? error.message : "unknown";
      console.log(`[diarista/me PATCH] ERROR after ${Date.now() - t0}ms: ${msg}`);
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
