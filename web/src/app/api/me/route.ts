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

function parsePositiveCents(value: unknown) {
  if (value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}

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
          docUrl: true,
          precoLeve: true,
          precoMedio: true,
          precoPesada: true,
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          ...user,
          bio: profile?.bio ?? null,
          avatarUrl: profile?.fotoUrl ?? user.avatarUrl ?? null,
          verificacao: { status: mapVerificacao(profile?.verificacao) },
          docEnviado: Boolean(profile?.docUrl),
          precoLeve: profile?.precoLeve ?? null,
          precoMedio: profile?.precoMedio ?? null,
          precoPesada: profile?.precoPesada ?? null,
          precoPesado: profile?.precoPesada ?? null,
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

    const { nome, email, senhaAtual, novaSenha, bio, precoLeve, precoMedio, precoPesado, precoPesada } = body as {
      nome?: string;
      email?: string;
      senhaAtual?: string;
      novaSenha?: string;
      bio?: string;
      precoLeve?: number;
      precoMedio?: number;
      precoPesado?: number;
      precoPesada?: number;
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

    if (typeof bio === "string" && auth.role !== "DIARISTA") {
      await prisma.diaristaProfile.updateMany({
        where: { userId: auth.userId },
        data: { bio: bio.trim() || null },
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
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
