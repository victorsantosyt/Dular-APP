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
const CATEGORIAS = [
  "AGRESSAO_VERBAL",
  "AGRESSAO_FISICA",
  "AGRESSAO_PSICOLOGICA",
  "AGRESSAO_EMOCIONAL",
  "VIOLENCIA_SEXUAL",
  "IMPORTUNACAO_SEXUAL",
  "FURTO",
  "DANO_MATERIAL",
  "AMBIENTE_INSALUBRE",
  "VIOLACAO_PRIVACIDADE",
  "NO_SHOW",
  "OUTRO",
];
const GRAVIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];

function fieldValue(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw.trim() : undefined;
}

function parseBool(value: unknown) {
  if (typeof value === "boolean") return value;
  const raw = fieldValue(value)?.toLowerCase();
  return raw === "true" || raw === "1" || raw === "sim";
}

function categoriaToType(categoria: string) {
  if (categoria === "IMPORTUNACAO_SEXUAL") return "IMPORTUNACAO";
  if (categoria === "VIOLENCIA_SEXUAL" || categoria === "AGRESSAO_FISICA") return "VIOLENCIA";
  if (categoria.startsWith("AGRESSAO_")) return "ASSEDIO";
  return "OUTRO";
}

function gravidadeToSeverity(gravidade: string) {
  return gravidade === "CRITICA" ? "ALTA" : gravidade;
}

function validateFields(fields: Record<string, any>) {
  const reportedUserId = fieldValue(fields.reportedUserId) || undefined;
  const serviceId = fieldValue(fields.serviceId) || undefined;
  const categoria = (fieldValue(fields.categoria)?.toUpperCase() || "OUTRO") as string;
  const subtipo = fieldValue(fields.subtipo) || undefined;
  const gravidade = (fieldValue(fields.gravidade)?.toUpperCase() || fieldValue(fields.severity)?.toUpperCase() || "MEDIA") as string;
  const type = (fieldValue(fields.type)?.toUpperCase() || categoriaToType(categoria)) as string;
  const severity = (fieldValue(fields.severity)?.toUpperCase() || gravidadeToSeverity(gravidade)) as string;
  const descricao = fieldValue(fields.descricao) || fieldValue(fields.description) || "";
  const anonimo = parseBool(fields.anonimo);

  if (!reportedUserId && !serviceId) {
    return { error: "Informe reportedUserId ou serviceId." };
  }
  if (!CATEGORIAS.includes(categoria)) {
    return { error: "Categoria inválida." };
  }
  if (!subtipo && fieldValue(fields.categoria)) {
    return { error: "Subtipo obrigatório." };
  }
  if (!GRAVIDADES.includes(gravidade)) {
    return { error: "Gravidade inválida." };
  }
  if (!INCIDENT_TYPES.includes(type)) {
    return { error: "Tipo inválido." };
  }
  if (!SEVERITIES.includes(severity)) {
    return { error: "Gravidade inválida." };
  }
  const description = descricao || subtipo || categoria;
  return { reportedUserId, serviceId, type, severity, categoria, subtipo, gravidade, description, anonimo };
}

async function resolveReportedUserId(
  reporterId: string,
  reportedUserId: string | undefined,
  serviceId: string | undefined,
): Promise<string | null> {
  if (reportedUserId) return reportedUserId;
  if (!serviceId) return null;
  const svc = await prisma.servico.findUnique({
    where: { id: serviceId },
    select: { clientId: true, diaristaId: true },
  });
  if (!svc) return null;
  return reporterId === svc.clientId ? svc.diaristaId : svc.clientId;
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
      const { reportedUserId, serviceId, type, severity, categoria, subtipo, gravidade, description, anonimo } = valid;

      const resolvedReportedUserId = await resolveReportedUserId(auth.userId, reportedUserId, serviceId);
      if (!resolvedReportedUserId) {
        return NextResponse.json({ ok: false, error: "Não foi possível identificar o usuário do incidente." }, { status: 400 });
      }

      const incident = await prisma.incidentReport.create({
        data: {
          reportedById: auth.userId,
          reportedUserId: resolvedReportedUserId,
          serviceId: serviceId || null,
          type: type as any,
          severity: severity as any,
          categoria: categoria as any,
          subtipo: subtipo || null,
          gravidade: gravidade as any,
          anonimo,
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
    const { reportedUserId, serviceId, type, severity, categoria, subtipo, gravidade, description, anonimo } = valid;

    const flatFiles = Object.values(files).flat().filter(Boolean) as formidable.File[];
    if (flatFiles.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: "Limite de anexos excedido (3)." }, { status: 400 });
    }

    const resolvedReportedUserId = await resolveReportedUserId(auth.userId, reportedUserId, serviceId);
    if (!resolvedReportedUserId) {
      return NextResponse.json({ ok: false, error: "Não foi possível identificar o usuário do incidente." }, { status: 400 });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        reportedById: auth.userId,
        reportedUserId: resolvedReportedUserId,
        serviceId: serviceId || null,
        type: type as any,
        severity: severity as any,
        categoria: categoria as any,
        subtipo: subtipo || null,
        gravidade: gravidade as any,
        anonimo,
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
