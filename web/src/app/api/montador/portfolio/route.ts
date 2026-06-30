import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { makeKey, putObject, deleteObject, signKeysForDisplay } from "@/lib/s3Objects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FOTOS = 12;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB por imagem

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = (contentType.split("/")[1] || "jpg").toLowerCase().replace("jpeg", "jpg").replace("+xml", "");
  return { buffer, contentType, ext };
}

/** Adiciona uma foto ao portfólio: sobe para o S3 e guarda a key no perfil. */
export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "MONTADOR") {
      return NextResponse.json({ ok: false, error: "Apenas montador pode editar o portfólio." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Imagem inválida. Envie uma foto JPG/PNG." }, { status: 400 });
    }
    if (parsed.buffer.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Imagem muito grande (limite 5MB)." }, { status: 400 });
    }

    const perfil = await prisma.montadorPerfil.upsert({
      where: { userId: auth.userId },
      update: {},
      create: { userId: auth.userId, especialidades: [], bairros: [], portfolioFotos: [] },
      select: { portfolioFotos: true },
    });
    const atual = Array.isArray(perfil.portfolioFotos) ? perfil.portfolioFotos : [];
    if (atual.length >= MAX_FOTOS) {
      return NextResponse.json({ ok: false, error: `Limite de ${MAX_FOTOS} fotos atingido.` }, { status: 400 });
    }

    const key = makeKey(`portfolio/${auth.userId}`, parsed.ext);
    await putObject(key, parsed.buffer, parsed.contentType);

    const novas = [...atual, key];
    await prisma.montadorPerfil.update({
      where: { userId: auth.userId },
      data: { portfolioFotos: novas },
    });

    const portfolioFotos = await signKeysForDisplay(novas);
    return NextResponse.json({ ok: true, portfolioFotos });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro ao enviar foto." }, { status: 500 });
  }
}

/** Remove a foto na posição `index` (query param) do portfólio. */
export async function DELETE(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "MONTADOR") {
      return NextResponse.json({ ok: false, error: "Apenas montador pode editar o portfólio." }, { status: 403 });
    }

    const index = Number(new URL(req.url).searchParams.get("index"));
    if (!Number.isInteger(index) || index < 0) {
      return NextResponse.json({ ok: false, error: "Índice inválido." }, { status: 400 });
    }

    const perfil = await prisma.montadorPerfil.findUnique({
      where: { userId: auth.userId },
      select: { portfolioFotos: true },
    });
    const atual = Array.isArray(perfil?.portfolioFotos) ? [...perfil!.portfolioFotos] : [];
    if (index >= atual.length) {
      return NextResponse.json({ ok: false, error: "Foto não encontrada." }, { status: 404 });
    }

    const [removida] = atual.splice(index, 1);
    await prisma.montadorPerfil.update({
      where: { userId: auth.userId },
      data: { portfolioFotos: atual },
    });

    // Best-effort: apaga o objeto no S3 sem derrubar a request se falhar.
    if (removida && !/^https?:\/\//i.test(removida) && !removida.startsWith("data:")) {
      try {
        await deleteObject(removida);
      } catch {
        // silencioso
      }
    }

    const portfolioFotos = await signKeysForDisplay(atual);
    return NextResponse.json({ ok: true, portfolioFotos });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro ao remover foto." }, { status: 500 });
  }
}
