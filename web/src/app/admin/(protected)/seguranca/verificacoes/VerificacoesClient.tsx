"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdminCard } from "@/components/admin-ui/AdminCard";
import { BadgeCheck, Clock, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { AdminEmpty } from "@/components/admin-ui/AdminEmpty";
import { MOTIVO_LABEL } from "@/lib/motivosDoPerfil";

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

type Decisao = "APROVADO" | "REPROVADO" | "REENVIO";

type DadosCadastrais = {
  perfil: string | null;
  nomeExibicao: string | null;
  nomeCompleto: string | null;
  cpf: string | null;
  dataNascimento: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
};

type Detail = {
  verification: {
    id: string;
    userId: string;
    docType: string;
    rawDocType?: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    createdAt: string;
    updatedAt: string;
    flowType: "PRIMEIRA_VERIFICACAO" | "RENOVACAO_REENVIO";
    maisRecente: boolean;
    decisao: Decisao | null;
    decididoEm: string | null;
    decididoPor: string | null;
    motivoUsuario: string | null;
  };
  decisoes: Array<{
    id: string;
    decisao: Decisao;
    motivoCategoria: string | null;
    conferencia: Conferencia | null;
    revisao: boolean;
    motivo: string | null;
    admin: string | null;
    createdAt: string;
  }>;
  /** Controle do servidor: conferência manual e categoria do motivo obrigatórias. */
  exigeConferencia: boolean;
  dadosEnviados: (DadosCadastrais & { capturadoEm: string }) | null;
  cadastroAtual: DadosCadastrais | null;
  camposAlterados: Array<keyof DadosCadastrais>;
  user: VerificationItem["user"];
  profileSummary: VerificationItem["profileSummary"];
  profileDetails: ProfileDetails;
  guardian: Guardian;
  documents: {
    frente: { key: string; signedUrl: string } | null;
    verso: { key: string; signedUrl: string } | null;
    selfie: { key: string; signedUrl: string } | null;
    selfieColetada: boolean;
    uploadedAt?: string | null;
    registradoEm: string | null;
    datasDivergentes: boolean;
  };
  history: Array<{
    id: string;
    docType: string;
    status: string;
    decisao: Decisao | null;
    decididoEm: string | null;
    decididoPor: string | null;
    motivoUsuario: string | null;
    atual: boolean;
    uploadedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type Conferencia = { documentoLegivel: boolean; dadosConferem: boolean; selfieCompativel: boolean };
const CONFERENCIA_VAZIA: Conferencia = { documentoLegivel: false, dadosConferem: false, selfieCompativel: false };

const CATEGORIAS: Array<{ chave: string; rotulo: string }> = [
  { chave: "IMAGEM_ILEGIVEL", rotulo: "Imagem ilegível" },
  { chave: "ROSTO_NAO_VISIVEL", rotulo: "Rosto não visível na selfie" },
  { chave: "DADOS_DIVERGENTES", rotulo: "Dados não conferem com o documento" },
  { chave: "CORRESPONDENCIA_NAO_CONFIRMADA", rotulo: "Não foi possível confirmar que a selfie corresponde ao documento" },
  { chave: "OUTRO", rotulo: "Outro motivo" },
];

const decisaoLabel: Record<Decisao, string> = {
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  REENVIO: "Reenvio solicitado",
};

const CAMPOS_CADASTRAIS: Array<{ chave: keyof DadosCadastrais; rotulo: string }> = [
  { chave: "nomeCompleto", rotulo: "Nome completo" },
  { chave: "nomeExibicao", rotulo: "Nome de exibição" },
  { chave: "cpf", rotulo: "CPF" },
  { chave: "dataNascimento", rotulo: "Nascimento" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "endereco", rotulo: "Endereço" },
  { chave: "perfil", rotulo: "Perfil" },
];

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

// Fonte única em lib/motivosDoPerfil.ts: a tela de profissionais por nicho
// mostra os mesmos motivos, e duas cópias divergiriam com o tempo.
const guardianReasonLabel = MOTIVO_LABEL;

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
  // Espelha design-system/ui/priority (verificacaoTone): aprovada=sucesso,
  // reprovada=crítico, pendente=média (fila de KYC a resolver).
  if (status === "APPROVED") return "bg-success-light text-success-dark ring-success/30";
  if (status === "REJECTED") return "bg-error-light text-error-dark ring-error/30";
  return "bg-warning-light text-warning-dark ring-warning/30";
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
  const [conferencia, setConferencia] = useState<Conferencia>(CONFERENCIA_VAZIA);
  const [categoria, setCategoria] = useState("");
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
      setConferencia(CONFERENCIA_VAZIA);
      setCategoria("");
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

  async function review(action: "approve" | "reprove" | "resend", reason?: string, revisao = false) {
    if (!detail) return;
    if (actionInFlightRef.current) return;
    const motivo = reason?.trim() ?? "";
    if (detail.exigeConferencia && action === "approve" && !(conferencia.documentoLegivel && conferencia.dadosConferem && conferencia.selfieCompativel)) {
      setMessage("Para aprovar, marque as três conferências.");
      return;
    }
    if (detail.exigeConferencia && action !== "approve" && !categoria) {
      setMessage("Escolha o motivo da reprovação ou do reenvio.");
      return;
    }
    if (revisao && !motivo) {
      setMessage("Informe o motivo da revisão.");
      return;
    }
    if (revisao) {
      const ok = confirm("Revisar a decisão já concluída?\n\nA decisão anterior fica no histórico, com o motivo informado.");
      if (!ok) return;
    } else if (action === "approve") {
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
        body: JSON.stringify({
          verificationId: detail.verification.id,
          motivo,
          tipo: action === "resend" ? "REENVIO" : action === "reprove" ? "REPROVADO" : undefined,
          revisao,
          esperado: revisao ? detail.verification.decisao : undefined,
          conferencia: action === "approve" ? conferencia : undefined,
          motivoCategoria: action === "approve" ? undefined : categoria || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      // Sucesso só depois da confirmação do servidor; em erro, o painel fica como estava.
      if (!res.ok || !data?.ok) throw new Error(readError(data));
      await Promise.all([loadList(), loadDetail(detail.verification.id)]);
      setMessage(
        data.jaDecidida
          ? "Esta decisão já estava registrada."
          : action === "approve" ? "Verificação aprovada." : action === "resend" ? "Reenvio solicitado." : "Verificação reprovada.",
      );
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
        <button
          onClick={() => setTab("PENDING")}
          className="rounded-xl border border-l-4 border-border border-l-warning bg-surface p-4 text-left transition-colors hover:bg-surface-subtle"
        >
          <div className="flex items-center gap-2"><Clock size={15} strokeWidth={2} className="shrink-0 text-warning" /><span className="text-eyebrow font-bold uppercase text-fg-subtle">Pendentes</span></div>
          <div className="mt-2 text-metric font-bold tabular-nums text-warning-dark">{stats.pending}</div>
        </button>
        <button
          onClick={() => setTab("APPROVED")}
          className="rounded-xl border border-l-4 border-border border-l-success bg-surface p-4 text-left transition-colors hover:bg-surface-subtle"
        >
          <div className="flex items-center gap-2"><CheckCircle2 size={15} strokeWidth={2} className="shrink-0 text-success" /><span className="text-eyebrow font-bold uppercase text-fg-subtle">Aprovadas</span></div>
          <div className="mt-2 text-metric font-bold tabular-nums text-success-dark">{stats.approved}</div>
        </button>
        <button
          onClick={() => setTab("REJECTED")}
          className="rounded-xl border border-l-4 border-border border-l-error bg-surface p-4 text-left transition-colors hover:bg-surface-subtle"
        >
          <div className="flex items-center gap-2"><XCircle size={15} strokeWidth={2} className="shrink-0 text-error" /><span className="text-eyebrow font-bold uppercase text-fg-subtle">Reprovadas</span></div>
          <div className="mt-2 text-metric font-bold tabular-nums text-error-dark">{stats.rejected}</div>
        </button>
        <button
          onClick={() => setTab("RENEWAL")}
          className="rounded-xl border border-l-4 border-border border-l-info bg-surface p-4 text-left transition-colors hover:bg-surface-subtle"
        >
          <div className="flex items-center gap-2"><RefreshCw size={15} strokeWidth={2} className="shrink-0 text-info" /><span className="text-eyebrow font-bold uppercase text-fg-subtle">Renovação/Reenvios</span></div>
          <div className="mt-2 text-metric font-bold tabular-nums text-info-dark">{stats.renewals}</div>
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
                tab === item.key ? "bg-accent text-white ring-accent" : "bg-surface text-fg-muted ring-border hover:bg-surface-subtle",
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
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none ring-1 ring-border"
          >
            {ROLE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, email, telefone ou identificador"
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none ring-1 ring-border"
          />
        </div>
      </AdminCard>

      {message ? (
        <div className="rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3 text-sm font-semibold text-accent-strong">
          {message}
        </div>
      ) : null}

      <AdminCard title="Fila de análise" icon={BadgeCheck}>
        {loading ? (
          <AdminEmpty title="Carregando verificações" hint="Buscando documentos enviados." />
        ) : visibleItems.length === 0 ? (
          <AdminEmpty title={emptyTitle(tab, Boolean(query.trim()))} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-fg-subtle">
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
                  <tr key={item.id} className="border-t border-border align-top">
                    <td className="px-2 py-3 text-sm text-fg">
                      <div className="font-bold">{item.user.nome}</div>
                      <div className="text-xs text-fg-subtle">{item.user.email ?? "sem email"}</div>
                      <div className="text-xs text-fg-subtle">{maskPhone(item.user.telefone)}</div>
                    </td>
                    <td className="px-2 py-3 text-sm text-fg-muted">{roleLabel[item.user.role]}</td>
                    <td className="px-2 py-3 text-sm text-fg-muted">{docTypeText(item.docType)}</td>
                    <td className="px-2 py-3">
                      <span className={["rounded-full px-2 py-1 text-xs font-bold ring-1", pillClass(item.status)].join(" ")}>
                        {statusLabel[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-sm text-fg-muted">{fmtDate(item.createdAt)}</td>
                    <td className="px-2 py-3 text-sm text-fg-muted">
                      <div className="font-semibold">{guardianStatusText(item.guardian.verificationStatus)}</div>
                      <div className="text-xs text-fg-subtle">Score {Math.round(item.guardian.score)} · {tierText(item.guardian.tier)}</div>
                      <div className="text-xs text-fg-subtle">{guardianLine(item.guardian)}</div>
                    </td>
                    <td className="px-2 py-3">
                      <span className="rounded-full bg-surface-subtle px-2 py-1 text-xs font-bold text-fg-muted ring-1 ring-border">
                        {item.flowType === "RENOVACAO_REENVIO" ? "Renovação/Reenvio" : "Primeira verificação"}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={() => loadDetail(item.id)}
                        className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white hover:brightness-95"
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
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-fg/45 p-3 backdrop-blur-sm md:p-6">
          <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-3xl bg-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-fg">Análise documental</h2>
                <p className="text-sm text-fg-subtle">Revise os documentos antes de liberar o perfil.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedId(null);
                  setDetail(null);
                }}
                className="rounded-full bg-surface-subtle px-3 py-2 text-sm font-bold text-fg-muted"
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
                  <div className="rounded-xl border border-accent/30 bg-accent-subtle px-4 py-3 text-sm font-semibold text-accent-strong">
                    {message}
                  </div>
                ) : null}

                <DecisaoAtualBlock detail={detail} />

                <DadosConferenciaBlock detail={detail} />

                <div className="grid gap-3 lg:grid-cols-3">
                  <UserSummaryBlock detail={detail} />
                  <RoleProfileBlock detail={detail} />
                  <GuardianBlock detail={detail} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <DocumentPreview title="Frente do documento" doc={detail.documents.frente} />
                  <DocumentPreview title="Verso do documento" doc={detail.documents.verso} />
                  <DocumentPreview
                    title="Selfie"
                    doc={detail.documents.selfie}
                    ausente={detail.documents.selfieColetada ? "Selfie não disponível" : "Selfie não coletada nesta versão"}
                  />
                </div>
                <div className="space-y-1 text-xs font-semibold text-fg-subtle">
                  <div>Envio registrado em: {fmtDate(detail.documents.registradoEm)}</div>
                  <div>Upload dos arquivos: {detail.documents.uploadedAt ? fmtDate(detail.documents.uploadedAt) : "Não registrado"}</div>
                  {detail.documents.datasDivergentes ? (
                    <div className="rounded-lg bg-warning-light px-3 py-2 text-warning-dark">
                      As datas do upload e do registro deste envio divergem. O registro foi criado depois dos arquivos; confira o histórico antes de decidir.
                    </div>
                  ) : null}
                </div>

                <InfoBlock title="Histórico de envios desta conta">
                  <div className="space-y-2">
                    {detail.history.map((item) => (
                      <div
                        key={item.id}
                        className={[
                          "rounded-xl p-3 text-sm text-fg-muted ring-1",
                          item.atual ? "bg-accent-subtle ring-accent/40" : "bg-surface-secondary ring-border",
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>
                            {docTypeText(item.docType)}
                            {item.atual ? " · envio em análise (imagens acima)" : ""}
                          </b>
                          <span className={["rounded-full px-2 py-1 text-xs font-bold ring-1", pillClass(item.status)].join(" ")}>
                            {item.decisao ? decisaoLabel[item.decisao] : statusLabel[item.status] ?? item.status}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-fg-subtle">
                          Registrado em {fmtDate(item.createdAt)} · upload {item.uploadedAt ? fmtDate(item.uploadedAt) : "não registrado"}
                          {item.decisao
                            ? ` · decisão ${item.decididoEm ? `em ${fmtDate(item.decididoEm)}` : "sem data registrada"}${item.decididoPor ? ` por ${item.decididoPor}` : ""}`
                            : ""}
                          {item.motivoUsuario ? ` · motivo: ${item.motivoUsuario}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </InfoBlock>

                {detail.decisoes.length ? (
                  <InfoBlock title="Decisões sobre este envio">
                    {detail.decisoes.map((d) => (
                      <div key={d.id} className="text-sm text-fg-muted">
                        <b>{decisaoLabel[d.decisao]}</b>
                        {d.revisao ? " (revisão)" : ""} · {fmtDate(d.createdAt)}
                        {d.conferencia ? " · conferência manual: documento legível, dados conferem, selfie compatível" : ""}
                        {d.motivoCategoria ? ` · ${CATEGORIAS.find((c) => c.chave === d.motivoCategoria)?.rotulo ?? d.motivoCategoria}` : ""}
                        {d.admin ? ` · ${d.admin}` : ""}
                        {d.motivo ? ` · ${d.motivo}` : ""}
                      </div>
                    ))}
                  </InfoBlock>
                ) : null}

                <AcoesDeDecisao
                  detail={detail}
                  motivo={reproveReason}
                  setMotivo={setReproveReason}
                  conferencia={conferencia}
                  setConferencia={setConferencia}
                  categoria={categoria}
                  setCategoria={setCategoria}
                  actionLoading={actionLoading}
                  onReview={review}
                />
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
    <section className="rounded-2xl border border-border bg-surface p-4 ring-1 ring-border">
      <h3 className="text-sm font-black text-fg">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="font-semibold text-fg-subtle">{label}</span>
      <span className="min-w-0 break-words font-semibold text-fg">{value}</span>
    </div>
  );
}

function UserSummaryBlock({ detail }: { detail: Detail }) {
  return (
    <InfoBlock title="Usuário">
      <Line label="Nome de exibição" value={detail.user.nome} />
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
    <details className="mt-3 rounded-xl bg-surface-secondary p-3 text-sm ring-1 ring-border">
      <summary className="cursor-pointer text-xs font-bold text-fg-muted">Dados avançados</summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function DocumentPreview({ title, doc, ausente = "Documento não disponível" }: { title: string; doc: { key: string; signedUrl: string } | null; ausente?: string }) {
  const [aberto, setAberto] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [giro, setGiro] = useState(0);
  const botao = "rounded-lg bg-surface px-3 py-1.5 text-xs font-bold text-fg ring-1 ring-border hover:bg-surface-subtle";
  return (
    <section className="rounded-2xl border border-border bg-surface-secondary p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-fg">{title}</h3>
        {doc?.signedUrl ? (
          <button type="button" onClick={() => setAberto(true)} className="text-xs font-bold text-accent-strong underline-offset-2 hover:underline">
            Ampliar / girar
          </button>
        ) : null}
      </div>
      {doc?.signedUrl ? (
        <img
          src={doc.signedUrl}
          alt={`Documento - ${title}`}
          onClick={() => setAberto(true)}
          className="max-h-[420px] w-full cursor-zoom-in rounded-xl object-contain ring-1 ring-border"
        />
      ) : (
        <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border bg-surface text-sm font-semibold text-fg-subtle">
          {ausente}
        </div>
      )}
      {aberto && doc?.signedUrl ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-fg/90 p-3" role="dialog" aria-label={`${title} ampliado`}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="mr-auto text-sm text-white">{title}</b>
            <button type="button" className={botao} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
            <span className="min-w-12 text-center text-xs font-bold text-white">{Math.round(zoom * 100)}%</span>
            <button type="button" className={botao} onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
            <button type="button" className={botao} onClick={() => setGiro((g) => (g + 270) % 360)}>Girar ⟲</button>
            <button type="button" className={botao} onClick={() => setGiro((g) => (g + 90) % 360)}>Girar ⟳</button>
            <button type="button" className={botao} onClick={() => { setZoom(1); setGiro(0); }}>Restaurar</button>
            <button type="button" className={botao} onClick={() => setAberto(false)}>Fechar</button>
          </div>
          <div className="mt-3 flex-1 overflow-auto">
            <div className="flex min-h-full min-w-full items-center justify-center p-6">
              <img
                src={doc.signedUrl}
                alt={`Documento - ${title} ampliado`}
                style={{ transform: `rotate(${giro}deg) scale(${zoom})`, transformOrigin: "center", transition: "transform 120ms" }}
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function valorCadastral(chave: keyof DadosCadastrais, valor: string | null) {
  if (!valor) return "Não informado";
  if (chave === "perfil") return roleLabel[valor as Role] ?? valor;
  if (chave === "cpf") return valor.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (chave === "dataNascimento") {
    const [a, m, d] = valor.split("-");
    return a && m && d ? `${d}/${m}/${a}` : valor;
  }
  if (chave === "telefone") return maskPhone(valor);
  return valor;
}

function DadosConferenciaBlock({ detail }: { detail: Detail }) {
  const enviados = detail.dadosEnviados;
  const atuais = detail.cadastroAtual;
  const alterados = new Set(detail.camposAlterados);
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 ring-1 ring-border">
      <h3 className="text-sm font-black text-fg">Dados para conferência</h3>
      {!enviados ? (
        <p className="mt-1 text-xs font-semibold text-fg-subtle">
          Este envio é anterior ao registro dos dados enviados: só o cadastro atual está disponível. Nada foi reconstruído.
        </p>
      ) : alterados.size ? (
        <p className="mt-1 text-xs font-semibold text-warning-dark">
          {alterados.size === 1 ? "1 campo mudou" : `${alterados.size} campos mudaram`} depois do envio (destacados).
        </p>
      ) : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-subtle">
              <th className="py-1 pr-3 font-bold">Campo</th>
              <th className="py-1 pr-3 font-bold">
                Dados enviados para análise{enviados ? ` (${fmtDate(enviados.capturadoEm)})` : ""}
              </th>
              <th className="py-1 font-bold">Cadastro atual</th>
            </tr>
          </thead>
          <tbody>
            {CAMPOS_CADASTRAIS.map(({ chave, rotulo }) => {
              const mudou = alterados.has(chave);
              return (
                <tr key={chave} className={mudou ? "bg-warning-light" : undefined}>
                  <td className="py-1.5 pr-3 font-semibold text-fg-subtle">{rotulo}</td>
                  <td className="py-1.5 pr-3 font-semibold text-fg">{enviados ? valorCadastral(chave, enviados[chave]) : "Não registrado neste envio"}</td>
                  <td className="py-1.5 font-semibold text-fg">
                    {atuais ? valorCadastral(chave, atuais[chave]) : "Não informado"}
                    {mudou ? <span className="ml-2 text-xs font-bold text-warning-dark">alterado</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DecisaoAtualBlock({ detail }: { detail: Detail }) {
  const v = detail.verification;
  if (!v.decisao) {
    return (
      <div className="rounded-2xl border border-border bg-surface-secondary px-4 py-3 text-sm font-bold text-fg">
        Aguardando análise{v.maisRecente ? "" : " · existe um envio mais recente desta conta"}
      </div>
    );
  }
  const cor = v.decisao === "APROVADO" ? "border-success/40 bg-success-light text-success-dark" : "border-red-300 bg-red-50 text-red-800";
  return (
    <div className={["rounded-2xl border px-4 py-3 text-sm", cor].join(" ")} data-testid="decisao-atual">
      <div className="text-base font-black">{decisaoLabel[v.decisao]}</div>
      <div className="mt-1 font-semibold">
        {v.decididoPor ? `por ${v.decididoPor}` : "responsável não registrado"} ·{" "}
        {v.decididoEm ? fmtDate(v.decididoEm) : "data da decisão não registrada (decisão anterior ao histórico de decisões)"}
      </div>
      {v.motivoUsuario ? <div className="mt-1">Motivo mostrado à pessoa: {v.motivoUsuario}</div> : null}
    </div>
  );
}

function AcoesDeDecisao({
  detail,
  motivo,
  setMotivo,
  conferencia,
  setConferencia,
  categoria,
  setCategoria,
  actionLoading,
  onReview,
}: {
  detail: Detail;
  motivo: string;
  setMotivo: (v: string) => void;
  conferencia: Conferencia;
  setConferencia: (v: Conferencia) => void;
  categoria: string;
  setCategoria: (v: string) => void;
  actionLoading: "approve" | "reprove" | "resend" | null;
  onReview: (action: "approve" | "reprove" | "resend", reason?: string, revisao?: boolean) => void;
}) {
  const v = detail.verification;
  const ocupado = Boolean(actionLoading);
  if (!v.maisRecente) {
    return (
      <div className="rounded-2xl border border-border bg-surface-secondary p-4 text-sm font-semibold text-fg-muted">
        Há um envio mais recente desta conta. Decisões só valem para o envio atual.
      </div>
    );
  }
  const exige = detail.exigeConferencia;
  // Sem a exigência ligada no servidor, vale o fluxo de produção de hoje.
  const conferido = !exige || (conferencia.documentoLegivel && conferencia.dadosConferem && conferencia.selfieCompativel);
  const semSelfie = exige && !detail.documents.selfieColetada;
  const marcacoes = !exige ? null : (
    <fieldset className="space-y-2 rounded-xl border border-border bg-surface p-3" disabled={ocupado}>
      <legend className="px-1 text-xs font-bold text-fg-muted">Conferência manual (obrigatória para aprovar)</legend>
      {(
        [
          ["documentoLegivel", "Documento legível (frente e verso)"],
          ["dadosConferem", "Dados enviados conferem com o documento"],
          ["selfieCompativel", "Selfie compatível com a foto do documento"],
        ] as const
      ).map(([chave, rotulo]) => (
        <label key={chave} className="flex items-center gap-2 text-sm font-semibold text-fg">
          <input
            type="checkbox"
            checked={conferencia[chave]}
            disabled={chave === "selfieCompativel" && semSelfie}
            onChange={(e) => setConferencia({ ...conferencia, [chave]: e.target.checked })}
          />
          {rotulo}
        </label>
      ))}
      <p className="text-xs text-fg-subtle">
        Marcações da sua análise visual. Não há reconhecimento facial automático: a decisão é humana.
      </p>
      {semSelfie ? (
        <p className="text-xs font-semibold text-warning-dark">
          Selfie não coletada nesta versão: o envio não pode ser aprovado. Solicite reenvio.
        </p>
      ) : null}
    </fieldset>
  );
  const seletorDeMotivo = (
    <div className="mt-3">
      <label className="text-xs font-bold text-fg-muted">
        Motivo {exige ? "(obrigatório para reprovar ou pedir reenvio; a pessoa vê no app)" : "(opcional)"}
      </label>
      <select
        value={categoria}
        disabled={ocupado}
        onChange={(e) => setCategoria(e.target.value)}
        className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
      >
        <option value="">Escolha o motivo</option>
        {CATEGORIAS.map((c) => (
          <option key={c.chave} value={c.chave}>{c.rotulo}</option>
        ))}
      </select>
    </div>
  );
  const campoMotivo = (rotulo: string, placeholder: string) => (
    <>
      <label className="text-xs font-bold text-fg-muted">{rotulo}</label>
      <textarea
        value={motivo}
        onChange={(event) => setMotivo(event.target.value)}
        rows={3}
        disabled={ocupado}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none ring-1 ring-border"
      />
    </>
  );

  if (v.status === "PENDING") {
    return (
      <div className="rounded-2xl border border-border bg-surface-secondary p-4">
        {marcacoes}
        {seletorDeMotivo}
        <div className="mt-3">
          {campoMotivo("Detalhe do motivo (a pessoa vê no app)", "Ex.: O verso está desfocado. Fotografe em local iluminado.")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            disabled={ocupado || !conferido || semSelfie}
            onClick={() => onReview("approve")}
            className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white hover:bg-success-dark disabled:opacity-50"
          >
            {actionLoading === "approve" ? "Aprovando..." : "Aprovar"}
          </button>
          <button
            disabled={ocupado}
            onClick={() => onReview("reprove", motivo)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {actionLoading === "reprove" ? "Reprovando..." : "Reprovar"}
          </button>
          <button
            disabled={ocupado}
            onClick={() => onReview("resend", motivo)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-fg disabled:opacity-50"
          >
            {actionLoading === "resend" ? "Solicitando..." : "Solicitar reenvio"}
          </button>
        </div>
      </div>
    );
  }

  // Decisão concluída: os botões comuns somem. Mudar só pela revisão explícita.
  return (
    <details className="rounded-2xl border border-border bg-surface-secondary p-4">
      <summary className="cursor-pointer text-sm font-black text-fg">Revisar decisão</summary>
      <p className="mt-2 text-xs font-semibold text-fg-subtle">
        A decisão atual ({v.decisao ? decisaoLabel[v.decisao] : v.status}) fica no histórico. O motivo é obrigatório.
      </p>
      {marcacoes ? <div className="mt-3">{marcacoes}</div> : null}
      {seletorDeMotivo}
      <div className="mt-3">{campoMotivo("Motivo da revisão", "Ex.: Documento conferido de novo; dados conferem.")}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.decisao !== "APROVADO" ? (
          <button
            disabled={ocupado || !conferido || semSelfie}
            onClick={() => onReview("approve", motivo, true)}
            className="rounded-lg bg-success px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {actionLoading === "approve" ? "Revisando..." : "Revisar para aprovado"}
          </button>
        ) : null}
        {v.decisao !== "REPROVADO" ? (
          <button
            disabled={ocupado}
            onClick={() => onReview("reprove", motivo, true)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {actionLoading === "reprove" ? "Revisando..." : "Revisar para reprovado"}
          </button>
        ) : null}
        {v.decisao !== "REENVIO" ? (
          <button
            disabled={ocupado}
            onClick={() => onReview("resend", motivo, true)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-fg disabled:opacity-50"
          >
            {actionLoading === "resend" ? "Revisando..." : "Revisar para reenvio"}
          </button>
        ) : null}
      </div>
    </details>
  );
}
