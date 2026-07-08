import type { PaymentStatus, ServicoStatus } from "@prisma/client";

/**
 * Métricas da operação Beta 0, calculadas direto do banco (sem ferramenta
 * externa de analytics). Funções puras: a página admin busca as linhas via
 * Prisma e injeta aqui — todo o cálculo é testável sem banco.
 *
 * Definições (auditoria/13-operacao-beta0.md):
 *  - North Star  = serviços concluídos por semana (dupla confirmação).
 *  - Liquidez    = % dos serviços solicitados que chegaram ao aceite (meta ≥60%).
 *  - Retenção    = % dos profissionais ativos numa semana fechada que voltaram
 *                  a concluir serviço na semana fechada seguinte (meta ≥30%).
 */

/** América/Cuiabá (MT) — UTC-4, sem horário de verão desde 2019. */
export const PILOT_TZ_OFFSET_MIN = -4 * 60;

const DIA_MS = 24 * 60 * 60 * 1000;
const SEMANA_MS = 7 * DIA_MS;

/** Statuses terminais de sucesso. CONCLUIDO = dupla confirmação;
 * FINALIZADO = pós-avaliação; CONFIRMADO = legado. */
const STATUS_CONCLUSAO: readonly ServicoStatus[] = ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"];

/** Statuses que provam que o serviço passou do aceite (fallback para dados
 * antigos sem ServicoEvento de ACEITO). */
const STATUS_APOS_ACEITE: readonly ServicoStatus[] = [
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  ...STATUS_CONCLUSAO,
];

export type ServicoRow = {
  id: string;
  createdAt: Date;
  status: ServicoStatus;
  diaristaId: string | null;
  montadorId: string | null;
  paymentStatus: PaymentStatus;
};

export type EventoRow = {
  servicoId: string;
  toStatus: ServicoStatus;
  createdAt: Date;
};

export type ProfissionalRow = {
  id: string;
  createdAt: Date;
};

export type SemanaConcluidos = {
  /** Segunda-feira 00:00 no fuso do piloto, expressa em UTC. */
  inicio: Date;
  /** "dd/mm" da segunda-feira local. */
  rotulo: string;
  concluidos: number;
};

export type BetaMetrics = {
  /** Serviços com evento de conclusão, desde sempre (fonte única do gráfico/KPI). */
  totalConcluidos: number;
  /** Últimas 8 semanas (mais antiga primeiro; a última é a semana corrente, parcial). */
  semanas: SemanaConcluidos[];
  northStar: {
    semanaAtual: number;
    semanaAnterior: number;
    /** null quando a semana anterior teve 0 (variação indefinida). */
    variacaoPct: number | null;
  };
  /** Janela dos últimos 28 dias; RASCUNHO fora do denominador. */
  liquidez: { solicitados: number; aceitos: number; pct: number | null };
  /** Entre as duas últimas semanas FECHADAS (a corrente é parcial e enviesaria). */
  retencao: { ativosSemanaBase: number; retidos: number; pct: number | null };
  tempoCadastroPrimeiroServico: { medianaDias: number | null; amostra: number };
  /** paymentStatus dos serviços já concluídos. */
  pagamentos: { aguardando: number; informados: number; confirmados: number; contestados: number };
};

/** Segunda-feira 00:00 da semana do instante, no fuso do piloto (retorna o instante UTC). */
export function inicioDaSemana(instante: Date, tzOffsetMin: number = PILOT_TZ_OFFSET_MIN): Date {
  const local = new Date(instante.getTime() + tzOffsetMin * 60_000);
  const diasDesdeSegunda = (local.getUTCDay() + 6) % 7;
  const segundaLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - diasDesdeSegunda,
  );
  return new Date(segundaLocal - tzOffsetMin * 60_000);
}

function rotuloSemana(inicioUtc: Date, tzOffsetMin: number): string {
  const local = new Date(inicioUtc.getTime() + tzOffsetMin * 60_000);
  const dd = String(local.getUTCDate()).padStart(2, "0");
  const mm = String(local.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export type BetaMetricsInput = {
  servicos: ServicoRow[];
  /** Apenas eventos com toStatus em {ACEITO, CONCLUIDO, CONFIRMADO, FINALIZADO}. */
  eventos: EventoRow[];
  /** Users com role DIARISTA ou MONTADOR. */
  profissionais: ProfissionalRow[];
  agora: Date;
  tzOffsetMin?: number;
};

export function computeBetaMetrics(input: BetaMetricsInput): BetaMetrics {
  const { servicos, eventos, profissionais, agora } = input;
  const tz = input.tzOffsetMin ?? PILOT_TZ_OFFSET_MIN;

  // Primeiro evento de conclusão e de aceite por serviço (eventos podem vir
  // em qualquer ordem — mantém o mínimo).
  const dataConclusao = new Map<string, Date>();
  const dataAceite = new Map<string, Date>();
  for (const ev of eventos) {
    const alvo = STATUS_CONCLUSAO.includes(ev.toStatus)
      ? dataConclusao
      : ev.toStatus === "ACEITO"
        ? dataAceite
        : null;
    if (!alvo) continue;
    const atual = alvo.get(ev.servicoId);
    if (!atual || ev.createdAt < atual) alvo.set(ev.servicoId, ev.createdAt);
  }

  const servicoById = new Map(servicos.map((s) => [s.id, s]));
  const profissionalDoServico = (s: ServicoRow) => s.diaristaId ?? s.montadorId;

  // ── North Star: concluídos por semana (8 semanas) ─────────────────────────
  const semanaCorrente = inicioDaSemana(agora, tz).getTime();
  const semanas: SemanaConcluidos[] = [];
  const indicePorSemana = new Map<number, number>();
  for (let i = 7; i >= 0; i--) {
    const inicio = new Date(semanaCorrente - i * SEMANA_MS);
    indicePorSemana.set(inicio.getTime(), semanas.length);
    semanas.push({ inicio, rotulo: rotuloSemana(inicio, tz), concluidos: 0 });
  }
  // Ativos por semana fechada (para retenção): chave = início da semana.
  const ativosPorSemana = new Map<number, Set<string>>();
  for (const [servicoId, quando] of dataConclusao) {
    const semana = inicioDaSemana(quando, tz).getTime();
    const idx = indicePorSemana.get(semana);
    if (idx !== undefined) semanas[idx].concluidos += 1;
    const servico = servicoById.get(servicoId);
    const prof = servico ? profissionalDoServico(servico) : null;
    if (prof) {
      let set = ativosPorSemana.get(semana);
      if (!set) ativosPorSemana.set(semana, (set = new Set()));
      set.add(prof);
    }
  }

  const semanaAtual = semanas[7].concluidos;
  const semanaAnterior = semanas[6].concluidos;
  const variacaoPct =
    semanaAnterior === 0 ? null : ((semanaAtual - semanaAnterior) / semanaAnterior) * 100;

  // ── Liquidez (28 dias) ─────────────────────────────────────────────────────
  const inicioJanela = agora.getTime() - 28 * DIA_MS;
  let solicitados = 0;
  let aceitos = 0;
  for (const s of servicos) {
    if (s.status === "RASCUNHO" || s.createdAt.getTime() < inicioJanela) continue;
    solicitados += 1;
    if (dataAceite.has(s.id) || STATUS_APOS_ACEITE.includes(s.status)) aceitos += 1;
  }
  const liquidezPct = solicitados === 0 ? null : (aceitos / solicitados) * 100;

  // ── Retenção entre as duas últimas semanas fechadas ────────────────────────
  const semanaFechada1 = semanaCorrente - 2 * SEMANA_MS; // base
  const semanaFechada2 = semanaCorrente - SEMANA_MS; // retorno
  const base = ativosPorSemana.get(semanaFechada1) ?? new Set<string>();
  const retorno = ativosPorSemana.get(semanaFechada2) ?? new Set<string>();
  let retidos = 0;
  for (const prof of base) if (retorno.has(prof)) retidos += 1;
  const retencaoPct = base.size === 0 ? null : (retidos / base.size) * 100;

  // ── Tempo cadastro → 1º serviço concluído (mediana, em dias) ──────────────
  const primeiraConclusaoDoProf = new Map<string, Date>();
  for (const [servicoId, quando] of dataConclusao) {
    const servico = servicoById.get(servicoId);
    const prof = servico ? profissionalDoServico(servico) : null;
    if (!prof) continue;
    const atual = primeiraConclusaoDoProf.get(prof);
    if (!atual || quando < atual) primeiraConclusaoDoProf.set(prof, quando);
  }
  const tempos: number[] = [];
  for (const p of profissionais) {
    const primeira = primeiraConclusaoDoProf.get(p.id);
    if (primeira) tempos.push((primeira.getTime() - p.createdAt.getTime()) / DIA_MS);
  }
  const medianaDias = mediana(tempos);

  // ── Pagamentos dos serviços concluídos ─────────────────────────────────────
  const pagamentos = { aguardando: 0, informados: 0, confirmados: 0, contestados: 0 };
  for (const s of servicos) {
    if (!dataConclusao.has(s.id) && !STATUS_CONCLUSAO.includes(s.status)) continue;
    if (s.paymentStatus === "WAITING_PAYMENT") pagamentos.aguardando += 1;
    else if (s.paymentStatus === "PAYMENT_REPORTED") pagamentos.informados += 1;
    else if (s.paymentStatus === "PAYMENT_CONFIRMED") pagamentos.confirmados += 1;
    else if (s.paymentStatus === "PAYMENT_DISPUTED") pagamentos.contestados += 1;
  }

  return {
    totalConcluidos: dataConclusao.size,
    semanas,
    northStar: { semanaAtual, semanaAnterior, variacaoPct },
    liquidez: { solicitados, aceitos, pct: liquidezPct },
    retencao: { ativosSemanaBase: base.size, retidos, pct: retencaoPct },
    tempoCadastroPrimeiroServico: {
      medianaDias: medianaDias === null ? null : Math.round(medianaDias * 10) / 10,
      amostra: tempos.length,
    },
    pagamentos,
  };
}
