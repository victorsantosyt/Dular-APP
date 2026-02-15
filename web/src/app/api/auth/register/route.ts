import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/schemas/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { nome, telefone, senha, role } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { telefone } });
    if (exists) {
      return NextResponse.json({ error: "Telefone já cadastrado" }, { status: 409 });
    }

    const senhaHash = await hashPassword(senha);

    const user = await prisma.user.create({
      data: {
        nome,
        telefone,
        senhaHash,
        role,
      },
    });

    if (role === "DIARISTA") {
      await prisma.diaristaProfile.create({
        data: {
          userId: user.id,
          precoLeve: 0,
          precoPesada: 0,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
