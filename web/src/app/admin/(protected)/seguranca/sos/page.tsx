export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin-ui/AdminPage";
import { AdminGrid } from "@/components/admin-ui/AdminGrid";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { AdminTable } from "@/components/admin-ui/AdminTable";
import { AdminKpi } from "@/components/admin-ui/AdminKpi";
import { Badge } from "@/design-system/ui";
import { CheckCircle2, Headset, ShieldAlert, Siren } from "lucide-react";
import {
  SOS_STATUS_ROTULO,
  SOS_STATUS_TOM,
  descricaoDoMotivoGrave,
  linkDoMapa,
  motivoGraveLegivel,
  origemDoSos,
  statusDoSos,
  textoDoMeta,
} from "@/lib/sosPainel";
import { SosStatusControl } from "./SosStatusControl";
import { requireAdminSession } from "@/lib/adminSession";

function fmt(dt: Date) {
  return new Date(dt).toLocaleString("pt-BR");
}

const ORDEM_DO_STATUS = { ACIONADO: 0, EM_ATENDIMENTO: 1, RESOLVIDO: 2 } as const;

export default async function SosPage() {
  // Antes de qualquer leitura: ADMIN ativo no banco (o layout roda em paralelo).
  await requireAdminSession();
  const eventos = await prisma.safetyEvent.findMany({
    where: { type: "SOS_SILENT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      serviceId: true,
      lat: true,
      lng: true,
      meta: true,
      status: true,
      statusAtualizadoEm: true,
      statusAtualizadoPorId: true,
      createdAt: true,
      user: { select: { nome: true, telefone: true } },
    },
  });

  const adminIds = [...new Set(eventos.map((e) => e.statusAtualizadoPorId).filter(Boolean))] as string[];
  const admins = adminIds.length
    ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, nome: true, telefone: true } })
    : [];
  const nomeDoAdmin = new Map(admins.map((a) => [a.id, a.nome || a.telefone || a.id]));

  const rows = eventos
    .map((e) => {
      const status = statusDoSos(e.status);
      const origem = origemDoSos(e.meta);
      return {
        id: e.id,
        status,
        origem,
        descricaoMotivo: descricaoDoMotivoGrave(e.meta),
        usuario: e.user?.nome ?? e.user?.telefone ?? "—",
        servicoId: e.serviceId,
        tipo: (origem === "MOTIVO_GRAVE" ? motivoGraveLegivel(e.meta) : textoDoMeta(e.meta, "tipo")) ?? "—",
        prioridade: textoDoMeta(e.meta, "prioridade") ?? "—",
        mensagem: textoDoMeta(e.meta, "mensagem") ?? textoDoMeta(e.meta, "observacao") ?? "—",
        mapa: linkDoMapa(e.lat, e.lng),
        acionadoEmRaw: e.createdAt,
        acionadoEm: fmt(e.createdAt),
        atualizacao: e.statusAtualizadoEm
          ? `${fmt(e.statusAtualizadoEm)} · ${nomeDoAdmin.get(e.statusAtualizadoPorId ?? "") ?? "admin"}`
          : "—",
      };
    })
    // Em aberto primeiro; dentro de cada status, o mais recente no topo.
    .sort(
      (a, b) =>
        ORDEM_DO_STATUS[a.status] - ORDEM_DO_STATUS[b.status] ||
        b.acionadoEmRaw.getTime() - a.acionadoEmRaw.getTime(),
    );

  const quantos = (status: keyof typeof ORDEM_DO_STATUS) => rows.filter((r) => r.status === status).length;
  const acionados = quantos("ACIONADO");
  const emAtendimento = quantos("EM_ATENDIMENTO");

  return (
    <AdminPage title="SOS" subtitle="Acionamentos de SOS e o andamento de cada atendimento">
      <AdminGrid>
        <div className="md:col-span-4">
          <AdminKpi
            label="Acionados"
            value={String(acionados)}
            hint={acionados > 0 ? "Ninguém assumiu ainda: agir agora" : "Nenhum aguardando"}
            icon={Siren}
            tone={acionados > 0 ? "critical" : "neutral"}
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi
            label="Em atendimento"
            value={String(emAtendimento)}
            icon={Headset}
            tone={emAtendimento > 0 ? "high" : "neutral"}
          />
        </div>
        <div className="md:col-span-4">
          <AdminKpi label="Resolvidos" value={String(quantos("RESOLVIDO"))} hint="Entre os últimos 100 SOS" icon={CheckCircle2} />
        </div>

        <div className="md:col-span-12">
          <AdminCard title="Últimos SOS" icon={Siren}>
            {rows.length === 0 ? (
              <AdminEmpty title="Nenhum SOS registrado" hint="Os SOS acionados no app aparecem aqui." />
            ) : (
              <AdminTable
                columns={[
                  {
                    key: "status",
                    label: "Status",
                    render: (row) => (
                      <div className="flex flex-col items-start gap-2">
                        <Badge tone={SOS_STATUS_TOM[row.status]}>{SOS_STATUS_ROTULO[row.status]}</Badge>
                        <SosStatusControl id={row.id} status={row.status} />
                      </div>
                    ),
                  },
                  {
                    key: "origem",
                    label: "Origem",
                    render: (row) =>
                      row.origem === "MOTIVO_GRAVE" ? (
                        <div className="flex flex-col items-start gap-1">
                          <Badge tone="medium" className="gap-1">
                            <ShieldAlert className="h-3 w-3" aria-hidden />
                            Motivo grave
                          </Badge>
                          {row.descricaoMotivo ? (
                            <span className="text-xs text-fg-muted">{row.descricaoMotivo}</span>
                          ) : null}
                        </div>
                      ) : (
                        <Badge tone="critical" className="gap-1">
                          <Siren className="h-3 w-3" aria-hidden />
                          SOS acionado
                        </Badge>
                      ),
                  },
                  { key: "usuario", label: "Usuário" },
                  {
                    key: "servico",
                    label: "Serviço",
                    render: (row) =>
                      row.servicoId ? (
                        <Link
                          href={`/admin/operacoes/servicos/${row.servicoId}`}
                          className="font-semibold text-fg underline-offset-2 hover:underline"
                        >
                          {row.servicoId.slice(0, 8)}
                        </Link>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "tipo", label: "Tipo" },
                  { key: "prioridade", label: "Prioridade" },
                  {
                    key: "mensagem",
                    label: "Mensagem",
                    render: (row) => <span className="whitespace-pre-wrap break-words">{row.mensagem}</span>,
                  },
                  {
                    key: "localizacao",
                    label: "Localização",
                    render: (row) =>
                      row.mapa ? (
                        <a
                          href={row.mapa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-fg underline-offset-2 hover:underline"
                        >
                          Ver no mapa
                        </a>
                      ) : (
                        "Sem localização"
                      ),
                  },
                  { key: "acionadoEm", label: "Acionado em" },
                  { key: "atualizacao", label: "Última mudança" },
                ]}
                rows={rows}
              />
            )}
          </AdminCard>
        </div>
      </AdminGrid>
    </AdminPage>
  );
}
