import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { enderecoSchema } from "@/lib/schemas/enderecos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/me/enderecos/[id] — atualiza endereço do usuário autenticado.
export async function PATCH(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const parsed = enderecoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Endereço inválido." },
        { status: 400 },
      );
    }

    // Garante que o endereço pertence ao usuário autenticado.
    const existente = await prisma.enderecoUsuario.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true },
    });
    if (!existente) {
      return NextResponse.json({ ok: false, error: "Endereço não encontrado." }, { status: 404 });
    }

    const data = parsed.data;
    const endereco = await prisma.enderecoUsuario.update({
      where: { id },
      data: {
        tipo: data.tipo,
        cep: data.cep.trim(),
        rua: data.rua.trim(),
        numero: data.numero.trim(),
        complemento: data.complemento?.trim() || null,
        bairro: data.bairro.trim(),
        cidade: data.cidade.trim(),
        uf: data.uf.trim().toUpperCase(),
        pontoReferencia: data.pontoReferencia?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, endereco });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = e instanceof Error ? e.message : "Erro ao atualizar endereço.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
