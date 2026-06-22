import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { enderecoSchema } from "@/lib/schemas/enderecos";

export const dynamic = "force-dynamic";

// GET /api/me/enderecos — endereços do usuário autenticado.
export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);
    const enderecos = await prisma.enderecoUsuario.findMany({
      where: { userId: auth.userId },
      orderBy: { tipo: "asc" },
    });
    return NextResponse.json({ ok: true, enderecos });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Erro ao carregar endereços.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST /api/me/enderecos — cria/atualiza (máx. 1 por tipo por usuário).
export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const parsed = enderecoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Endereço inválido." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const payload = {
      tipo: data.tipo,
      cep: data.cep.trim(),
      rua: data.rua.trim(),
      numero: data.numero.trim(),
      complemento: data.complemento?.trim() || null,
      bairro: data.bairro.trim(),
      cidade: data.cidade.trim(),
      uf: data.uf.trim().toUpperCase(),
      pontoReferencia: data.pontoReferencia?.trim() || null,
    };

    // Máx. 1 endereço por tipo por usuário: se já existe, atualiza; senão cria.
    // (Sem unique composto no schema → upsert manual via findFirst.)
    const existente = await prisma.enderecoUsuario.findFirst({
      where: { userId: auth.userId, tipo: data.tipo },
      select: { id: true },
    });

    const endereco = existente
      ? await prisma.enderecoUsuario.update({ where: { id: existente.id }, data: payload })
      : await prisma.enderecoUsuario.create({ data: { ...payload, userId: auth.userId } });

    return NextResponse.json({ ok: true, endereco });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Erro ao salvar endereço.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
