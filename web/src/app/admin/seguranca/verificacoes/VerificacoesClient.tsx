"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";
type StatusTab = "PENDING" | "APPROVED" | "REJECTED" | "RENEWAL" | "ALL";
type RoleFilter = Role | "ALL";

type Guardian = {
  verificationStatus: string;
  canCreateServico: boolean;
  canAppearInSearch: boolean;
  canReceiveServico: boolean;
  canAcceptServico: boolean;
  motivos: string[];
  score: number;
  tier: string;
};

type VerificationItem = {
  id: string;
  userId: string;
  user: {
    id: string;
    nome: string;
    email?: string | null;
    telefone?: string | null;
    role: Role;
    status: string;
    createdAt: string;
  };
  docType: string;
  rawDocType?: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  updatedAt: string;
  flowType: "PRIMEIRA_VERIFICACAO" | "RENOVACAO_REENVIO";
  guardian: Guardian;
  profileSummary: {
    cadastroCompleto: boolean;
    cidade?: string | null;
    estado?: string | null;
    bairro?: string | null;
    servicosOferecidos: string[];
    especialidades: string[];
    ativo: boolean;
  };
};

type ProfileDetails = {
  empregador?: {
    cidade?: string | null;
    estado?: string | null;
    cidadeAtual?: string | null;
    estadoAtual?: string | null;
    bairroAtual?: string | null;
    ativo?: boolean | null;
    localizacaoPermitida?: boolean | null;
  } | null;
  diarista?: {
    verificacao?: string | null;
    ativo?: boolean | null;
    bio?: string | null;
    servicosOferecidos?: string[] | null;
    cidade?: string | null;
    estado?: string | null;
    cidadeAtual?: string | null;
    estadoAtual?: string | null;
    bairroAtual?: string | null;
    atendeTodaCidade?: boolean | null;
    raioAtendimentoKm?: number | null;
    localizacaoPermitida?: boolean | null;
    anosExperiencia?: number | null;
    precoBabaHora?: string | number | null;
    precoCozinheiraBase?: string | number | null;
    taxaMinima?: string | number | null;
    cobraDeslocamento?: boolean | null;
    valorACombinar?: boolean | null;
    observacaoPreco?: string | null;
    bairros?: Array<{ bairro?: { nome?: string | null; cidade?: string | null; uf?: string | null } | null }> | null;
  } | null;
  montador?: {
    verificado?: boolean | null;
    ativo?: boolean | null;
    bio?: string | null;
    especialidades?: string[] | null;
    cidade?: string | null;
    estado?: string | null;
    cidadeAtual?: string | null;
    estadoAtual?: string | null;
    bairroAtual?: string | null;
    atendeTodaCidade?: boolean | null;
    raioAtendimentoKm?: number | null;
    localizacaoPermitida?: boolean | null;
    anosExperiencia?: number | null;
    precoBase?: string | number | null;
    taxaMinima?: string | number | null;
    valorACombinar?: boolean | null;
    cobraDeslocamento?: boolean | null;
    bairros?: string[] | null;
  } | null;
};

type Detail = {
  verification: {
    id: string;
    userId: string;
    docType: string;
    rawDocType?: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewedBy?: string | null;
    reviewNote?: string | null;
    createdAt: string;
    updatedAt: string;
    flowType: "PRIMEIRA_VERIFICACAO" | "RENOVACAO_REENVIO";
  };
  user: VerificationItem["user"];
  profileSummary: VerificationItem["profileSummary"];
  profileDetails: ProfileDetails;
  guardian: Guardian;
  documents: {
    frente: { key: string; signedUrl: string } | null;
    verso: { key: string; signedUrl: string } | null;
    uploadedAt?: string | null;
  };
  history: Array<{
    id: string;
    docType: string;
    rawDocType?: string;
    status: string;
    reviewedBy?: string | null;
    reviewNote?: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

const STATUS_TABS: Array<{ key: StatusTab; label: string }> = [
  { key: "PENDING", label: "Pendentes" },
  { key: "APPROVED", label: "Aprovadas" },
  { key: "REJECTED", label: "Reprovadas" },
  { key: "RENEWAL", label: "Renovação/Reenvios" },
  { key: "ALL", label: "Todas" },
];

const ROLE_FILTERS: Array<{ key: RoleFilter; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "EMPREGADOR", label: "Empregador" },
  { key: "DIARISTA", label: "Profissional de Casa" },
  { key: "MONTADOR", label: "Montador" },
];

const roleLabel: Record<Role, string> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Profissional de Casa",
  MONTADOR: "Montador",
};

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
  VERIFICADO: "Verificado",
  PENDENTE: "Pendente",
  REPROVADO: "Reprovado",
  NAO_ENVIADO: "Não enviado",
};

const guardianReasonLabel: Record<string, string> = {
  documento_aguardando_analise: "Documento aguardando análise",
  documento_nao_enviado: "Documento não enviado",
  documento_reprovado: "Documento reprovado",
  safescore_baixo: "SafeScore abaixo do mínimo",
  score_baixo: "SafeScore abaixo do mínimo",
  usuario_bloqueado: "Usuário bloqueado",
  usuario_nao_encontrado: "Usuário não encontrado",
  perfil_incompleto: "Perfil incompleto",
  sem_perfil_diarista: "Perfil de Profissional de Casa não encontrado",
  sem_perfil_montador: "Perfil de Montador não encontrado",
  falta_nome: "Nome não informado",
  falta_bio: "Apresentação não informada",
  falta_especialidades: "Especialidades não informadas",
  falta_area_atendimento: "Área de atendimento incompleta",
  perfil_inativo: "Perfil inativo",
  sem_servicos_oferecidos: "Serviços oferecidos não informados",
  sem_localizacao: "Localização não informada",
  sem_preco_diarista: "Preço de diarista não informado",
  sem_preco_baba: "Preço de babá não informado",
  sem_preco_cozinheira: "Preço de cozinheira não informado",
  nao_oferece_diarista: "Serviço de diarista não oferecido",
  nao_oferece_baba: "Serviço de babá não oferecido",
  nao_oferece_cozinheira: "Serviço de cozinheira não oferecido",
  restricao_ativa_suspend_block: "Restrição ativa de suspensão ou bloqueio",
  restricao_shadow_ban: "Restrição ativa de visibilidade",
  restricao_limit_bookings: "Restrição ativa para solicitações",
};

const tierLabel: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Prata",
  GOLD: "Ouro",
  PLATINUM: "Platina",
  BLOCKED: "Bloqueado",
};

const docTypeLabel: Record<string, string> = {
  EMPREGADOR_KYC: "Documento do Empregador",
  DIARISTA_KYC: "Documento da Profissional de Casa",
  MONTADOR_KYC: "Documento do Montador",
  KYC_DOCS: "Documentos de verificação",
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR");
}

function maskPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (!digits) return "Não informado";
  const visible = digits.slice(-5);
  return `***${visible}`;
}

function cleanReviewNote(value?: string | null) {
  if (!value?.trim()) return "Sem observação";
  const afterSeparator = value.match(/\s-\s(.+)$/)?.[1] ?? value;
  const withoutIso = afterSeparator.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "").trim();
  return withoutIso || "Com observação";
}

function readError(data: unknown) {
  if (!data || typeof data !== "object") return "Falha inesperada.";
  const record = data as { error?: unknown; message?: unknown };
  if (typeof record.error === "string") return record.error;
  if (typeof record.message === "string") return record.message;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as { message?: unknown };
    if (typeof nested.message === "string") return nested.message;
  }
  return "Falha inesperada.";
}

function pillClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-100 text-red-800 ring-red-200";
  return "bg-amber-100 text-amber-800 ring-amber-200";
}

function guardianLine(guardian: Guardian) {
  const motivos = translatedGuardianReasons(guardian.motivos);
  return motivos.length > 0 ? motivos.slice(0, 2).join(", ") : "Sem bloqueios ativos";
}

function humanizeCode(value: string) {
  const normalized = value.replace(/_/g, " ").trim().toLocaleLowerCase("pt-BR");
  if (!normalized) return "—";
  return normalized.charAt(0).toLocaleUpperCase("pt-BR") + normalized.slice(1);
}

function guardianReasonText(value: string) {
  return guardianReasonLabel[value] ?? humanizeCode(value);
}

function translatedGuardianReasons(motivos: string[]) {
  return motivos.map(guardianReasonText);
}

function guardianStatusText(value: string) {
  return statusLabel[value] ?? humanizeCode(value);
}

function tierText(value: string) {
  return tierLabel[value] ?? humanizeCode(value);
}

function docTypeText(value: string) {
  return docTypeLabel[value] ?? humanizeCode(value);
}

function boolLabel(value?: boolean | null) {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "—";
}

function listLabel(value?: string[] | null) {
  return value?.filter(Boolean).join(", ") || "—";
}

function moneyLabel(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function joinLocation(cidade?: string | null, estado?: string | null) {
  return [cidade, estado].filter(Boolean).join(" / ") || "—";
}

function locationSentence(cidade?: string | null, estado?: string | null, bairro?: string | null) {
  const cidadeUf = [cidade, estado].filter(Boolean).join(", ");
  if (cidadeUf && bairro) return `${cidadeUf} · Bairro ${bairro}`;
  if (cidadeUf) return cidadeUf;
  if (bairro) return `Bairro ${bairro}`;
  return "Localização não informada";
}

function emptyTitle(tab: StatusTab, hasSearch: boolean) {
  if (hasSearch) return "Nenhum resultado encontrado";
  if (tab === "RENEWAL") return "Nenhuma renovação aguardando análise";
  if (tab === "PENDING") return "Nenhuma verificação pendente";
  if (tab === "APPROVED") return "Nenhuma verificação aprovada";
  if (tab === "REJECTED") return "Nenhuma verificação reprovada";
  return "Nenhuma verificação encontrada";
}

export default function VerificacoesClient() {
  const [tab, setTab] = useState<StatusTab>("PENDING");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, renewals: 0 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reproveReason, setReproveReason] = useState("");
  const [actionLoading, setActionLoading] = useState<"approve" | "reprove" | "resend" | null>(null);
  const actionInFlightRef = useRef(false);

  const apiStatus = tab === "RENEWAL" ? "PENDING" : tab;

  const visibleItems = useMemo(() => {
    if (tab !== "RENEWAL") return items;
    return items.filter((item) => item.flowType === "RENOVACAO_REENVIO");
  }, [items, tab]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({
        status: apiStatus,
        role,
        page: "1",
        limit: tab === "RENEWAL" ? "100" : "50",
      });
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/verificacoes?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(readError(data));
      setItems(data.items ?? []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao carregar verificações.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiStatus, query, role, tab]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/verificacoes/${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(readError(data));
      setDetail(data as Detail);
      setReproveReason("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao carregar detalhe.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadList();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadList]);

  async function review(action: "approve" | "reprove" | "resend", reason?: string) {
    if (!detail) return;
    if (actionInFlightRef.current) return;
    const motivo = reason?.trim() ?? "";
    if (action === "approve") {
      const ok = confirm(
        "Aprovar verificação?\n\nEsta ação libera as permissões do usuário conforme as regras do SafeScore Guardian.",
      );
      if (!ok) return;
    } else {
      if (!motivo) {
        setMessage("Informe o motivo da reprovação.");
        return;
      }
      const ok = confirm(
        action === "resend"
          ? "Solicitar reenvio?\n\nO usuário precisará reenviar documentos válidos."
          : "Reprovar documentos?\n\nO usuário precisará reenviar documentos válidos.",
      );
      if (!ok) return;
    }

    actionInFlightRef.current = true;
    setActionLoading(action);
    setMessage("");
    try {
      const endpointAction = action === "approve" ? "approve" : "reprove";
      const res = await fetch(`/api/admin/verificacoes/${endpointAction}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId: detail.verification.id, motivo }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(readError(data));
      await loadList();
      await loadDetail(detail.verification.id);
      setMessage(action === "approve" ? "Verificação aprovada." : action === "resend" ? "Reenvio solicitado." : "Verificação reprovada.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao revisar documentos.");
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <button onClick={() => setTab("PENDING")} className="rounded-2xl border border-white/50 bg-white/75 p-4 text-left ring-1 ring-slate-900/5">
          <div className="text-xs font-semibold text-slate-500">Pendentes</div>
          <div className="mt-2 text-2xl font-bold text-slate-900">{stats.pending}</div>
        </button>
        <button onClick={() => setTab("APPROVED")} className="rounded-2xl border border-white/50 bg-white/75 p-4 text-left ring-1 ring-slate-900/5">
          <div className="text-xs font-semibold text-slate-500">Aprovadas</div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{stats.approved}</div>
        </button>
        <button onClick={() => setTab("REJECTED")} className="rounded-2xl border border-white/50 bg-white/75 p-4 text-left ring-1 ring-slate-900/5">
          <div className="text-xs font-semibold text-slate-500">Reprovadas</div>
          <div className="mt-2 text-2xl font-bold text-red-700">{stats.rejected}</div>
        </button>
        <button onClick={() => setTab("RENEWAL")} className="rounded-2xl border border-white/50 bg-white/75 p-4 text-left ring-1 ring-slate-900/5">
          <div className="text-xs font-semibold text-slate-500">Renovação/Reenvios</div>
          <div className="mt-2 text-2xl font-bold text-violet-700">{stats.renewals}</div>
        </button>
      </div>

      <AdminCard>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={[
                "rounded-full px-3 py-2 text-xs font-bold ring-1",
                tab === item.key ? "bg-violet-700 text-white ring-violet-700" : "bg-white/70 text-slate-700 ring-slate-200",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as RoleFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5"
          >
            {ROLE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, email, telefone ou identificador"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-slate-900/5"
          />
        </div>
      </AdminCard>

      {message ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
          {message}
        </div>
      ) : null}

      <AdminCard title="Fila de análise">
        {loading ? (
          <AdminEmpty title="Carregando verificações" hint="Buscando documentos enviados." />
        ) : visibleItems.length === 0 ? (
          <AdminEmpty title={emptyTitle(tab, Boolean(query.trim()))} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-2 py-2 font-semibold">Usuário</th>
                  <th className="px-2 py-2 font-semibold">Perfil</th>
                  <th className="px-2 py-2 font-semibold">Documento</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Envio</th>
                  <th className="px-2 py-2 font-semibold">Guardian</th>
                  <th className="px-2 py-2 font-semibold">Fluxo</th>
                  <th className="px-2 py-2 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200/70 align-top">
                    <td className="px-2 py-3 text-sm text-slate-800">
                      <div className="font-bold">{item.user.nome}</div>
                      <div className="text-xs text-slate-500">{item.user.email ?? "sem email"}</div>
                      <div className="text-xs text-slate-500">{maskPhone(item.user.telefone)}</div>
                    </td>
                    <td className="px-2 py-3 text-sm text-slate-700">{roleLabel[item.user.role]}</td>
                    <td className="px-2 py-3 text-sm text-slate-700">{docTypeText(item.docType)}</td>
                    <td className="px-2 py-3">
                      <span className={["rounded-full px-2 py-1 text-xs font-bold ring-1", pillClass(item.status)].join(" ")}>
                        {statusLabel[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-sm text-slate-600">{fmtDate(item.createdAt)}</td>
                    <td className="px-2 py-3 text-sm text-slate-700">
                      <div className="font-semibold">{guardianStatusText(item.guardian.verificationStatus)}</div>
                      <div className="text-xs text-slate-500">Score {Math.round(item.guardian.score)} · {tierText(item.guardian.tier)}</div>
                      <div className="text-xs text-slate-500">{guardianLine(item.guardian)}</div>
                    </td>
                    <td className="px-2 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                        {item.flowType === "RENOVACAO_REENVIO" ? "Renovação/Reenvio" : "Primeira verificação"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => loadDetail(item.id)}
                        className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:brightness-95"
                      >
                        Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {selectedId ? (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/45 p-3 backdrop-blur-sm md:p-6">
          <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Análise documental</h2>
                <p className="text-sm text-slate-500">Revise os documentos antes de liberar o perfil.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700"
              >
                Fechar
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="mt-5">
                <AdminEmpty title="Carregando detalhe" />
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                {message ? (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
                    {message}
                  </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-3">
                  <UserSummaryBlock detail={detail} />
                  <RoleProfileBlock detail={detail} />
                  <GuardianBlock detail={detail} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DocumentPreview title="Frente do documento" doc={detail.documents.frente} />
                  <DocumentPreview title="Verso do documento" doc={detail.documents.verso} />
                </div>
                <div className="text-xs font-semibold text-slate-500">
                  Upload: {fmtDate(detail.documents.uploadedAt ?? detail.verification.createdAt)}
                </div>

                <InfoBlock title="Histórico de verificações">
                  <div className="space-y-2">
                    {detail.history.map((item) => (
                      <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>{docTypeText(item.docType)}</b>
                          <span className={["rounded-full px-2 py-1 text-xs font-bold ring-1", pillClass(item.status)].join(" ")}>
                            {statusLabel[item.status] ?? item.status}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{fmtDate(item.createdAt)} · {cleanReviewNote(item.reviewNote)}</div>
                      </div>
                    ))}
                  </div>
                </InfoBlock>

                <TechnicalDetails detail={detail} />

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="text-xs font-bold text-slate-600">Motivo da reprovação</label>
                  <textarea
                    value={reproveReason}
                    onChange={(event) => setReproveReason(event.target.value)}
                    rows={3}
                    placeholder="Ex.: Documento ilegível. Envie novamente."
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-1 ring-slate-900/5"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      disabled={Boolean(actionLoading)}
                      onClick={() => review("approve")}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {actionLoading === "approve" ? "Aprovando..." : "Aprovar"}
                    </button>
                    <button
                      disabled={Boolean(actionLoading)}
                      onClick={() => review("reprove", reproveReason)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {actionLoading === "reprove" ? "Reprovando..." : "Reprovar"}
                    </button>
                    <button
                      disabled={Boolean(actionLoading)}
                      onClick={() => review("resend", reproveReason)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 disabled:opacity-50"
                    >
                      {actionLoading === "resend" ? "Solicitando..." : "Solicitar reenvio"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 ring-1 ring-slate-900/5">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="min-w-0 break-words font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function UserSummaryBlock({ detail }: { detail: Detail }) {
  return (
    <InfoBlock title="Usuário">
      <Line label="Nome" value={detail.user.nome} />
      <Line label="Email" value={detail.user.email ?? "Não informado"} />
      <Line label="Telefone" value={maskPhone(detail.user.telefone)} />
      <Line label="Perfil" value={roleLabel[detail.user.role]} />
      <Line label="Conta" value={detail.user.status === "ATIVO" ? "Ativa" : humanizeCode(detail.user.status)} />
      <Line label="Criado em" value={fmtDate(detail.user.createdAt)} />
    </InfoBlock>
  );
}

function RoleProfileBlock({ detail }: { detail: Detail }) {
  const location = locationSentence(detail.profileSummary.cidade, detail.profileSummary.estado, detail.profileSummary.bairro);

  if (detail.user.role === "EMPREGADOR") {
    const profile = detail.profileDetails.empregador;
    return (
      <InfoBlock title="Resumo do perfil">
        <Line label="Cadastro" value={detail.profileSummary.cadastroCompleto ? "Completo" : "Incompleto"} />
        <Line label="Localização" value={location} />
        <Line label="Conta ativa" value={boolLabel(profile?.ativo ?? detail.profileSummary.ativo)} />
        <AdvancedProfileDetails>
          <Line label="Permissão loc." value={boolLabel(profile?.localizacaoPermitida)} />
          <Line label="Cidade base" value={joinLocation(profile?.cidade, profile?.estado)} />
          <Line label="Cidade atual" value={joinLocation(profile?.cidadeAtual, profile?.estadoAtual)} />
          <Line label="Bairro atual" value={profile?.bairroAtual ?? "—"} />
        </AdvancedProfileDetails>
      </InfoBlock>
    );
  }

  if (detail.user.role === "DIARISTA") {
    const profile = detail.profileDetails.diarista;
    const bairros = profile?.bairros
      ?.map((item) => joinLocation(item.bairro?.nome, [item.bairro?.cidade, item.bairro?.uf].filter(Boolean).join(" / ")))
      .filter((item) => item !== "—")
      .join(", ");
    return (
      <InfoBlock title="Resumo do perfil">
        <Line label="Serviços" value={listLabel(profile?.servicosOferecidos) === "—" ? "Não informado" : listLabel(profile?.servicosOferecidos)} />
        <Line label="Localização" value={location} />
        <Line label="Perfil ativo" value={boolLabel(profile?.ativo ?? detail.profileSummary.ativo)} />
        <AdvancedProfileDetails>
          <Line label="Verificação" value={guardianStatusText(profile?.verificacao ?? "")} />
          <Line label="Permissão loc." value={boolLabel(profile?.localizacaoPermitida)} />
          <Line label="Cidade base" value={joinLocation(profile?.cidade, profile?.estado)} />
          <Line label="Cidade atual" value={joinLocation(profile?.cidadeAtual, profile?.estadoAtual)} />
          <Line label="Bairro atual" value={profile?.bairroAtual ?? "—"} />
          <Line label="Toda cidade" value={boolLabel(profile?.atendeTodaCidade)} />
          <Line label="Raio" value={profile?.raioAtendimentoKm ? `${profile.raioAtendimentoKm} km` : "—"} />
          <Line label="Bairros" value={bairros || "—"} />
          <Line label="Babá/hora" value={moneyLabel(profile?.precoBabaHora)} />
          <Line label="Cozinha" value={moneyLabel(profile?.precoCozinheiraBase)} />
          <Line label="Taxa mínima" value={moneyLabel(profile?.taxaMinima)} />
          <Line label="Deslocamento" value={boolLabel(profile?.cobraDeslocamento)} />
          <Line label="A combinar" value={boolLabel(profile?.valorACombinar)} />
        </AdvancedProfileDetails>
      </InfoBlock>
    );
  }

  const profile = detail.profileDetails.montador;
  return (
    <InfoBlock title="Resumo do perfil">
      <Line label="Especialidades" value={listLabel(profile?.especialidades) === "—" ? "Não informado" : listLabel(profile?.especialidades)} />
      <Line label="Localização" value={location} />
      <Line label="Perfil ativo" value={boolLabel(profile?.ativo ?? detail.profileSummary.ativo)} />
      <AdvancedProfileDetails>
        <Line label="Verificado" value={boolLabel(profile?.verificado)} />
        <Line label="Permissão loc." value={boolLabel(profile?.localizacaoPermitida)} />
        <Line label="Cidade base" value={joinLocation(profile?.cidade, profile?.estado)} />
        <Line label="Cidade atual" value={joinLocation(profile?.cidadeAtual, profile?.estadoAtual)} />
        <Line label="Bairro atual" value={profile?.bairroAtual ?? "—"} />
        <Line label="Toda cidade" value={boolLabel(profile?.atendeTodaCidade)} />
        <Line label="Raio" value={profile?.raioAtendimentoKm ? `${profile.raioAtendimentoKm} km` : "—"} />
        <Line label="Bairros" value={listLabel(profile?.bairros)} />
        <Line label="Preço base" value={moneyLabel(profile?.precoBase)} />
        <Line label="Taxa mínima" value={moneyLabel(profile?.taxaMinima)} />
        <Line label="Deslocamento" value={boolLabel(profile?.cobraDeslocamento)} />
        <Line label="A combinar" value={boolLabel(profile?.valorACombinar)} />
      </AdvancedProfileDetails>
    </InfoBlock>
  );
}

function GuardianBlock({ detail }: { detail: Detail }) {
  const motivos = translatedGuardianReasons(detail.guardian.motivos).join(", ") || "Sem bloqueios ativos";

  if (detail.user.role === "EMPREGADOR") {
    return (
      <InfoBlock title="Guardian/SafeScore">
        <Line label="Status" value={guardianStatusText(detail.guardian.verificationStatus)} />
        <Line label="Score/Tier" value={`${Math.round(detail.guardian.score)} / ${tierText(detail.guardian.tier)}`} />
        <Line label="Pode solicitar" value={boolLabel(detail.guardian.canCreateServico)} />
        <Line label="Motivos" value={motivos} />
      </InfoBlock>
    );
  }

  return (
    <InfoBlock title="Guardian/SafeScore">
      <Line label="Status" value={guardianStatusText(detail.guardian.verificationStatus)} />
      <Line label="Score/Tier" value={`${Math.round(detail.guardian.score)} / ${tierText(detail.guardian.tier)}`} />
      <Line label="Busca" value={boolLabel(detail.guardian.canAppearInSearch)} />
      <Line label="Receber" value={boolLabel(detail.guardian.canReceiveServico)} />
      <Line label="Aceitar" value={boolLabel(detail.guardian.canAcceptServico)} />
      <Line label="Motivos" value={motivos} />
    </InfoBlock>
  );
}

function AdvancedProfileDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-3 rounded-xl bg-slate-50 p-3 text-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer text-xs font-bold text-slate-600">Dados avançados</summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function TechnicalDetails({ detail }: { detail: Detail }) {
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4 ring-1 ring-slate-900/5">
      <summary className="cursor-pointer text-sm font-black text-slate-900">Detalhes técnicos</summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Line label="Verificação ID" value={detail.verification.id} />
          <Line label="Usuário ID" value={detail.user.id} />
          <Line label="Telefone" value={detail.user.telefone ?? "Não informado"} />
          <Line label="Doc bruto" value={detail.verification.rawDocType ?? detail.verification.docType} />
          <Line label="Status bruto" value={detail.verification.status} />
        </div>
        <div className="space-y-2">
          <Line label="Criado ISO" value={detail.verification.createdAt} />
          <Line label="Atualizado ISO" value={detail.verification.updatedAt} />
          <Line label="Revisado por" value={detail.verification.reviewedBy ?? "—"} />
          <Line label="Observação" value={detail.verification.reviewNote ?? "—"} />
        </div>
      </div>
    </details>
  );
}

function DocumentPreview({ title, doc }: { title: string; doc: { key: string; signedUrl: string } | null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {doc?.signedUrl ? (
          <a href={doc.signedUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-violet-700 underline-offset-2 hover:underline">
            Abrir
          </a>
        ) : null}
      </div>
      {doc?.signedUrl ? (
        <img
          src={doc.signedUrl}
          alt={`Documento - ${title}`}
          className="max-h-[420px] w-full rounded-xl object-contain ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-500">
          Documento não disponível
        </div>
      )}
    </section>
  );
}
