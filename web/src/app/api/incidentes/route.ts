import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type formidable from "formidable";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { isServiceParticipant } from "@/lib/requireAuth";
import { parseMultipart } from "@/lib/parseMultipart";
import { makeKey, putObject } from "@/lib/s3Objects";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png"]);
const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const INCIDENT_TYPES = ["ASSEDIO", "IMPORTUNACAO", "VIOLENCIA", "AMEACA", "OUTRO"] as const;
const SEVERITIES = ["BAIXA", "MEDIA", "ALTA"] as const;
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
] as const;
const GRAVIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"] as const;

const incidentSchema = z
  .object({
    reportedUserId: z.string().trim().min(1).optional(),
    serviceId: z.string().trim().min(1).optional(),
    categoria: z.enum(CATEGORIAS).default("OUTRO"),
    subtipo: z.string().trim().min(1).optional(),
    gravidade: z.enum(GRAVIDADES).default("MEDIA"),
    type: z.enum(INCIDENT_TYPES).optional(),
    severity: z.enum(SEVERITIES).optional(),
    descricao: z.string().trim().optional(),
    description: z.string().trim().optional(),
    anonimo: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.reportedUserId && !value.serviceId) {
      ctx.addIssue({
        code: "custom",
        path: ["serviceId"],
        message: "Informe serviceId para reportar incidente.",
      });
    }
    if (!value.subtipo && value.categoria !== "OUTRO") {
      ctx.addIssue({
        code: "custom",
        path: ["subtipo"],
        message: "Subtipo obrigatório.",
      });
    }
  });

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

function parseIncidentFields(fields: Record<string, any>) {
  const parsed = incidentSchema.safeParse({
    reportedUserId: fieldValue(fields.reportedUserId) || undefined,
    serviceId: fieldValue(fields.serviceId) || undefined,
    categoria: fieldValue(fields.categoria)?.toUpperCase() || "OUTRO",
    subtipo: fieldValue(fields.subtipo) || undefined,
    gravidade:
      fieldValue(fields.gravidade)?.toUpperCase() ||
      fieldValue(fields.severity)?.toUpperCase() ||
      "MEDIA",
    type: fieldValue(fields.type)?.toUpperCase() || undefined,
    severity: fieldValue(fields.severity)?.toUpperCase() || undefined,
    descricao: fieldValue(fields.descricao) || undefined,
    description: fieldValue(fields.description) || undefined,
    anonimo: parseBool(fields.anonimo),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = parsed.data;
  const type = data.type ?? categoriaToType(data.categoria);
  const severity = data.severity ?? gravidadeToSeverity(data.gravidade);
  const description = data.descricao || data.description || data.subtipo || data.categoria;

  return {
    reportedUserId: data.reportedUserId,
    serviceId: data.serviceId,
    type,
    severity,
    categoria: data.categoria,
    subtipo: data.subtipo,
    gravidade: data.gravidade,
    description,
    anonimo: data.anonimo,
  };
}

async function resolveReportedUserId(
  reporterId: string,
  reportedUserId: string | undefined,
  serviceId: string | undefined,
): Promise<string | null> {
  if (!serviceId) return null;
  const svc = await prisma.servico.findUnique({
    where: { id: serviceId },
    select: { clientId: true, diaristaId: true, montadorId: true },
  });
  if (!svc) return null;
  if (!isServiceParticipant(reporterId, svc)) return null;

  const counterpartIds =
    reporterId === svc.clientId
      ? [svc.diaristaId, svc.montadorId].filter(Boolean)
      : [svc.clientId];

  if (reportedUserId) {
    return counterpartIds.includes(reportedUserId) ? reportedUserId : null;
  }

  return counterpartIds[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    const contentType = req.headers.get("content-type") || "";

    // JSON fallback (sem anexos)
    if (contentType.includes("application/json")) {
      const body = await req.json();
      const valid = parseIncidentFields(body);
      if ("error" in valid) {
        return NextResponse.json({ ok: false, error: valid.error }, { status: 400 });
      }
      const { reportedUserId, serviceId, type, severity, categoria, subtipo, gravidade, description, anonimo } = valid;

      const resolvedReportedUserId = await resolveReportedUserId(auth.userId, reportedUserId, serviceId);
      if (!resolvedReportedUserId) {
        return NextResponse.json({ ok: false, error: "Acesso negado ao serviço informado." }, { status: 403 });
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
    const valid = parseIncidentFields(fields as Record<string, any>);
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
      return NextResponse.json({ ok: false, error: "Acesso negado ao serviço informado." }, { status: 403 });
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
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
