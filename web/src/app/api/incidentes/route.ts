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
const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const INCIDENT_TYPES = ["ASSEDIO", "IMPORTUNACAO", "VIOLENCIA", "AMEACA", "OUTRO"];
const SEVERITIES = ["BAIXA", "MEDIA", "ALTA"];

function validateFields(fields: Record<string, any>) {
  const reportedUserId = (fields.reportedUserId as string | undefined)?.trim();
  const serviceId = (fields.serviceId as string | undefined)?.trim() || undefined;
  const type = (fields.type as string | undefined)?.toUpperCase() || "OUTRO";
  const severity = (fields.severity as string | undefined)?.toUpperCase() || "MEDIA";
  const description = (fields.description as string | undefined)?.trim() || "";

  if (!reportedUserId) {
    return { error: "reportedUserId é obrigatório." };
  }
  if (!INCIDENT_TYPES.includes(type)) {
    return { error: "Tipo inválido." };
  }
  if (!SEVERITIES.includes(severity)) {
    return { error: "Gravidade inválida." };
  }
  if (description.length < 4) {
    return { error: "Descrição muito curta." };
  }
  return { reportedUserId, serviceId, type, severity, description };
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const contentType = req.headers.get("content-type") || "";

    // JSON fallback (sem anexos)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const valid = validateFields(body);
      if ("error" in valid) {
        return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });
      }
      const { reportedUserId, serviceId, type, severity, description } = valid;

      const incident = await prisma.incidentReport.create({
        data: {
          reportedById: auth.userId,
          reportedUserId,
          serviceId: serviceId || null,
          type: type as any,
          severity: severity as any,
          description,
          status: "ABERTO",
        },
      });

      return NextResponse.json({ ok: true, incidentId: incident.id, status: incident.status });
    }

    // Multipart (com anexos)
    const { fields, files } = await parseMultipart(req, { maxFileSize: MAX_FILE_SIZE, maxFiles: MAX_FILES });
    const valid = validateFields(fields as Record<string, any>);
    if ("error" in valid) {
      return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });
    }
    const { reportedUserId, serviceId, type, severity, description } = valid;

    const flatFiles = Object.values(files).flat().filter(Boolean) as formidable.File[];
    if (flatFiles.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: "Limite de anexos excedido (3)." }, { status: 400 });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        reportedById: auth.userId,
        reportedUserId,
        serviceId: serviceId || null,
        type: type as any,
        severity: severity as any,
        description,
        status: "ABERTO",
      },
    });

    for (const file of flatFiles) {
      const mime = file.mimetype || "application/octet-stream";
      if (!ALLOWED_MIME.has(mime)) {
        continue;
      }
      if (file.size > MAX_FILE_SIZE) continue;

      const ext = path.extname(file.originalFilename || "") || ".bin";
      const key = makeKey(`incidents/${incident.id}`, ext);
      const buffer = await fs.readFile(file.filepath);
      await putObject(key, buffer, mime);

      await prisma.incidentAttachment.create({
        data: {
          incidentId: incident.id,
          key,
          mime,
          size: file.size,
        },
      });
    }

    return NextResponse.json({ ok: true, incidentId: incident.id, status: incident.status });
  } catch (e: any) {
    if (e?.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro" }, { status: 500 });
  }
}
