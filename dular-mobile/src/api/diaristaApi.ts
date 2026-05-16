import { api } from "@/lib/api";
import type { ServicoOferecido } from "@/types/diarista";

export type HabilidadePayload = { tipo: string; categoria?: string | null };

// ── Habilidades ───────────────────────────────────────────────────────────────

export async function getHabilidades() {
  const res = await api.get("/api/diarista/habilidades");
  return res.data?.habilidades ?? res.data;
}

export async function putHabilidades(habilidades: HabilidadePayload[]) {
  const res = await api.put("/api/diarista/habilidades", { habilidades });
  return res.data?.habilidades ?? res.data;
}

// ── Perfil ────────────────────────────────────────────────────────────────────

export type DiaristaVerificacao = "PENDENTE" | "VERIFICADO" | "REPROVADO";

export type DiaristaBairroItem = {
  id: string;
  bairroId: string;
  bairro: { id: string; nome: string; cidade: string; uf: string };
};

export type DiaristaAgendaItem = {
  id: string;
  diaSemana: number;
  turno: string;
  ativo: boolean;
};

export type DiaristaProfileMe = {
  id: string;
  userId: string;
  verificacao: DiaristaVerificacao;
  ativo: boolean;
  fotoUrl: string | null;
  docUrl: string | null;
  bio: string | null;
  precoLeve: number | null;
  precoMedio: number | null;
  precoPesada: number | null;
  notaMedia: number;
  totalServicos: number;
  servicosOferecidos: ServicoOferecido[];
  bairros: DiaristaBairroItem[];
  agenda: DiaristaAgendaItem[];
  user: { id: string; nome: string; telefone: string; status?: string };
  createdAt?: string;
  updatedAt?: string;
  // T-15: novos campos de localização, experiência e preços multi-nicho
  cidade: string | null;
  estado: string | null;
  atendeTodaCidade: boolean;
  raioAtendimentoKm: number | null;
  anosExperiencia: number | null;
  // Decimais vêm como string do Prisma — aceitamos string | number para robustez
  precoBabaHora: string | number | null;
  precoCozinheiraBase: string | number | null;
  taxaMinima: string | number | null;
  cobraDeslocamento: boolean;
  valorACombinar: boolean;
  observacaoPreco: string | null;
};

export async function getDiaristaPerfilMe(): Promise<DiaristaProfileMe | null> {
  const res = await api.get("/api/diarista/me");
  return res.data?.profile ?? res.data ?? null;
}

/**
 * Atualização parcial via PATCH /api/diarista/me.
 * Aceita os campos legados (`servicosOferecidos`, `bio`, `ativo`, `precoLeve/Medio/Pesada`)
 * e também os novos campos do T-15 (cidade/estado, cobertura, preços multi-nicho).
 * Enviamos APENAS os campos preenchidos — payload mínimo.
 */
export async function patchDiaristaPerfil(payload: {
  servicosOferecidos?: ServicoOferecido[];
  bio?: string | null;
  ativo?: boolean;
  precoLeve?: number;
  precoMedio?: number;
  precoPesada?: number;
  // T-15
  cidade?: string | null;
  estado?: string | null;
  atendeTodaCidade?: boolean;
  raioAtendimentoKm?: number | null;
  anosExperiencia?: number | null;
  precoBabaHora?: string | number | null;
  precoCozinheiraBase?: string | number | null;
  taxaMinima?: string | number | null;
  cobraDeslocamento?: boolean;
  valorACombinar?: boolean;
  observacaoPreco?: string | null;
}) {
  const res = await api.patch("/api/diarista/me", payload);
  return res.data;
}

// ── T-15: helpers específicos por seção ──────────────────────────────────────

export async function updateAreaAtendimento(payload: {
  cidade?: string | null;
  estado?: string | null;
  atendeTodaCidade?: boolean;
  raioAtendimentoKm?: number | null;
}) {
  return patchDiaristaPerfil(payload);
}

export async function updatePrecosCompletos(payload: {
  precoLeve?: number;
  precoMedio?: number;
  precoPesada?: number;
  precoBabaHora?: string | number | null;
  precoCozinheiraBase?: string | number | null;
  taxaMinima?: string | number | null;
  cobraDeslocamento?: boolean;
  valorACombinar?: boolean;
  observacaoPreco?: string | null;
}) {
  return patchDiaristaPerfil(payload);
}

// ── Bairros ───────────────────────────────────────────────────────────────────

export async function updateBairros(payload: {
  cidade: string;
  uf: string;
  bairros: string[];
}) {
  const res = await api.put("/api/diarista/bairros", payload);
  return res.data;
}

// ── Preços ────────────────────────────────────────────────────────────────────

export async function updatePrecos(payload: {
  precoLeve: number;
  precoMedio?: number;
  precoPesada: number;
  bio?: string;
}) {
  const res = await api.put("/api/diarista/precos", payload);
  return res.data;
}

// ── Disponibilidade ───────────────────────────────────────────────────────────

export type DisponibilidadeSlot = { diaSemana: number; turno: string; ativo?: boolean };

export async function updateDisponibilidade(slots: DisponibilidadeSlot[]) {
  const res = await api.put("/api/diarista/disponibilidade", { slots });
  return res.data;
}

// ── /api/me (nome / telefone / bio) ───────────────────────────────────────────

export async function updatePerfilBase(payload: {
  nome?: string;
  telefone?: string;
  bio?: string;
}) {
  const res = await api.put("/api/me", payload);
  return res.data?.user ?? res.data;
}

// ── Servicos (ações no fluxo de serviço) ─────────────────────────────────────

export async function aceitarServicoDiarista(
  servicoId: string,
  enderecoCompleto?: string,
) {
  const body = enderecoCompleto ? { enderecoCompleto } : {};
  const res = await api.post(`/api/servicos/${servicoId}/aceitar`, body);
  return res.data;
}

export async function recusarServicoDiarista(
  servicoId: string,
  motivo: string,
  observacao?: string,
) {
  const body: Record<string, unknown> = { motivo };
  if (observacao) body.observacao = observacao;
  const res = await api.post(`/api/servicos/${servicoId}/recusar`, body);
  return res.data;
}

export async function iniciarServicoDiarista(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/iniciar`);
  return res.data;
}

export async function concluirServicoDiarista(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/concluir`);
  return res.data;
}

export async function confirmarFinalizacaoDiarista(servicoId: string) {
  const res = await api.post(`/api/servicos/${servicoId}/confirmar`);
  return res.data;
}

export async function cancelarServicoDiarista(
  servicoId: string,
  motivo: string,
  observacao?: string,
) {
  const body: Record<string, unknown> = { motivo };
  if (observacao) body.observacao = observacao;
  const res = await api.post(`/api/servicos/${servicoId}/cancelar`, body);
  return res.data;
}

// ── Helpers de domínio ────────────────────────────────────────────────────────

export type DiaristaCompletude = {
  completo: boolean;
  progresso: number;
  motivos: string[];
};

/**
 * Calcula completude do perfil da diarista no client.
 *
 * Critérios:
 *  - Nome (>= 2 chars)
 *  - Bio (>= 20 chars)
 *  - Pelo menos 1 serviço oferecido
 *  - Pelo menos 1 bairro (área de atendimento)
 *  - Preço leve e pesada definidos (> 0)
 */
export function calcularCompletudeDiarista(
  profile: DiaristaProfileMe | null,
  userNome?: string,
): DiaristaCompletude {
  const motivos: string[] = [];
  const checks: Array<{ key: string; ok: boolean }> = [];

  const nome = (profile?.user?.nome || userNome || "").trim();
  checks.push({ key: "nome", ok: nome.length >= 2 });
  if (nome.length < 2) motivos.push("Informe seu nome completo");

  const bioOk = !!profile?.bio && profile.bio.trim().length >= 20;
  checks.push({ key: "bio", ok: bioOk });
  if (!bioOk) motivos.push("Escreva uma apresentação com pelo menos 20 caracteres");

  const servicosOk = Array.isArray(profile?.servicosOferecidos) && profile!.servicosOferecidos.length > 0;
  checks.push({ key: "servicos", ok: servicosOk });
  if (!servicosOk) motivos.push("Selecione pelo menos um serviço oferecido");

  // Área: aceita bairros tradicionais OU cidade+estado preenchidos (T-15)
  const temBairros = Array.isArray(profile?.bairros) && profile!.bairros.length > 0;
  const temCidadeEstado =
    !!(profile?.cidade && profile.cidade.trim()) &&
    !!(profile?.estado && profile.estado.trim());
  const bairrosOk = temBairros || temCidadeEstado;
  checks.push({ key: "bairros", ok: bairrosOk });
  if (!bairrosOk) motivos.push("Cadastre sua área de atendimento (cidade e bairros)");

  // Preços: se valorACombinar=true, completude não exige números preenchidos
  const valorACombinar = profile?.valorACombinar === true;
  const precosOk =
    valorACombinar ||
    (typeof profile?.precoLeve === "number" && profile.precoLeve > 0 &&
      typeof profile?.precoPesada === "number" && profile.precoPesada > 0);
  checks.push({ key: "precos", ok: precosOk });
  if (!precosOk) motivos.push("Configure seus preços de referência");

  const total = checks.length;
  const done = checks.filter((c) => c.ok).length;
  const progresso = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    completo: motivos.length === 0,
    progresso,
    motivos,
  };
}

export function formatCurrencyBRL(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Converte um Decimal vindo da API (string | number | null) para number em
 * unidade de reais. Não retorna 0; valor inválido vira null.
 */
export function decimalToNumber(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Formata um Decimal-string (R$ unidades) como BRL.
 */
export function formatDecimalBRL(
  value: string | number | null | undefined,
): string | null {
  const n = decimalToNumber(value);
  if (n == null) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
