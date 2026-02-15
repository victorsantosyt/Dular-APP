import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

const mapVerificacao = (status?: string | null) => {
  if (!status) return "PENDENTE";
  const s = status.toUpperCase();
  if (s === "VERIFICADO") return "APROVADO";
  if (s === "REPROVADO") return "REPROVADO";
  return "PENDENTE";
};

export async function GET(req: Request) {
  try {
    const auth = requireAuth(req);

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Usuário não encontrado." }, { status: 404 });
    }

    // Para diarista, traz perfil e verificação
    if (auth.role === "DIARISTA") {
      const profile = await prisma.diaristaProfile.findUnique({
        where: { userId: auth.userId },
        select: {
          bio: true,
          fotoUrl: true,
          verificacao: true,
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.fotoUrl ?? user.avatarUrl ?? null,
          verificacao: { status: mapVerificacao(profile?.verificacao) },
        },
      });
    }

    // Cliente: devolve dados básicos; verificação opcional
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
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = requireAuth(req);
    const body = await req.json();

    const { nome, email, senhaAtual, novaSenha } = body as {
      nome?: string;
      email?: string;
      senhaAtual?: string;
      novaSenha?: string;
    };

    const data: any = {};
    if (typeof nome === "string") data.nome = nome.trim();
    if (typeof email === "string") data.email = email.trim() || null;

    if (novaSenha) {
      if (!senhaAtual) {
        return NextResponse.json({ ok: false, error: "Informe a senha atual." }, { status: 400 });
      }
      const me = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { senhaHash: true },
      });
      if (!me?.senhaHash) {
        return NextResponse.json({ ok: false, error: "Conta sem senha configurada." }, { status: 400 });
      }
      const ok = await bcrypt.compare(senhaAtual, me.senhaHash);
      if (!ok) {
        return NextResponse.json({ ok: false, error: "Senha atual incorreta." }, { status: 400 });
      }
      data.senhaHash = await bcrypt.hash(novaSenha, 10);
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: {
        id: true,
        nome: true,
        telefone: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
