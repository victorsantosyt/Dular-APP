import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const body = await req.json();
    const { avatarDataUrl, dataUrl } = body as { avatarDataUrl?: string; dataUrl?: string };
    const finalDataUrl = avatarDataUrl || dataUrl;

    if (!finalDataUrl || !finalDataUrl.startsWith("data:image/")) {
      return NextResponse.json({ ok: false, error: "Avatar inválido." }, { status: 400 });
    }

    // limita ~1MB após recorte/compressão
    if (finalDataUrl.length > 1_000_000) {
      return NextResponse.json(
        { ok: false, error: "Imagem muito grande (limite ~1MB após recorte)." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: { avatarUrl: finalDataUrl },
      select: { id: true, avatarUrl: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = requireAuth(req);
    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: { avatarUrl: null },
      select: { id: true, avatarUrl: true },
    });
    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
