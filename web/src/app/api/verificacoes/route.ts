import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type formidable from "formidable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { parseMultipart } from "@/lib/parseMultipart";
import { makeKey, putObject } from "@/lib/s3Objects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function firstFile(value: formidable.File | formidable.File[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function uploadDoc(file: formidable.File, prefix: string) {
  const mime = file.mimetype || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error("Formato inválido. Envie JPG ou PNG.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Arquivo muito grande. Limite de 10MB.");
  }

  const ext = path.extname(file.originalFilename || "") || (mime === "image/png" ? ".png" : ".jpg");
  const key = makeKey(`verificacoes/${prefix}`, ext);
  const buffer = await fs.readFile(file.filepath);
  await putObject(key, buffer, mime);
  return { key, mime, size: file.size };
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "DIARISTA") {
      return NextResponse.json({ ok: false, error: "Apenas diaristas podem enviar documentos." }, { status: 403 });
    }

    const profile = await prisma.diaristaProfile.findUnique({
      where: { userId: auth.userId },
      select: { verificacao: true, docUrl: true },
    });

    if (profile?.verificacao === "VERIFICADO") {
      return NextResponse.json({ ok: false, error: "Verificação já aprovada." }, { status: 409 });
    }
    if (profile?.verificacao === "PENDENTE" && profile.docUrl) {
      return NextResponse.json({ ok: false, error: "Verificação já está pendente." }, { status: 409 });
    }

    const { files } = await parseMultipart(req, { maxFileSize: MAX_FILE_SIZE, maxFiles: 2 });
    const docFrente = firstFile(files.docFrente as formidable.File | formidable.File[] | undefined);
    const docVerso = firstFile(files.docVerso as formidable.File | formidable.File[] | undefined);

    if (!docFrente || !docVerso) {
      return NextResponse.json({ ok: false, error: "Envie frente e verso do documento." }, { status: 400 });
    }

    const [frente, verso] = await Promise.all([
      uploadDoc(docFrente, `${auth.userId}/frente`),
      uploadDoc(docVerso, `${auth.userId}/verso`),
    ]);

    const docUrl = JSON.stringify({
      frente: frente.key,
      verso: verso.key,
      uploadedAt: new Date().toISOString(),
    });

    const updated = await prisma.diaristaProfile.upsert({
      where: { userId: auth.userId },
      update: {
        verificacao: "PENDENTE",
        docUrl,
      },
      create: {
        userId: auth.userId,
        precoLeve: 0,
        precoPesada: 0,
        verificacao: "PENDENTE",
        docUrl,
      },
      select: { verificacao: true, updatedAt: true },
    });

    await prisma.documentVerification
      .create({
        data: {
          userId: auth.userId,
          docType: "KYC_DOCS",
          docUrl,
          reviewNote: `Submetido em ${new Date().toISOString()}`,
        },
      })
      .catch(() => null);

    return NextResponse.json({
      ok: true,
      verificacao: {
        status: "PENDENTE",
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro ao enviar documentos." }, { status: 500 });
  }
}
