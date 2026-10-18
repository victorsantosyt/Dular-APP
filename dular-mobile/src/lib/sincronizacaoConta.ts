import { create } from "zustand";

/**
 * Sincronização dos dados compartilhados da conta entre backend e telas.
 *
 * Perfil, verificação documental, SafeScore, assinatura e restrições mudam por
 * fora do app (aprovação no painel, renovação na loja, decisão de suporte). O
 * app pergunta ao backend, barato, se algo mudou (`/api/me/sincronizacao`) e,
 * quando a versão muda, relê a conta e avisa as telas abertas pela `revisao`.
 *
 * Quando pergunta: a cada INTERVALO_MS com o app aberto, já ao voltar do
 * segundo plano, ao receber uma notificação e logo depois de uma ação local.
 * Sem resposta (rede, servidor), tenta de novo em 5 s, 10 s, 20 s e depois a
 * cada INTERVALO_MS — recupera sozinho quando a conexão volta.
 *
 * Prazo: uma mudança feita fora do app aparece em no máximo
 * INTERVALO_MS + tempo da consulta com a tela aberta (sem push e sem reabrir).
 */
export const INTERVALO_MS = 15_000;
export const ESPERAS_APOS_FALHA_MS = [5_000, 10_000, 20_000] as const;

export function esperaAposFalha(falhasSeguidas: number): number {
  return ESPERAS_APOS_FALHA_MS[falhasSeguidas - 1] ?? INTERVALO_MS;
}

/** Assuntos com versão própria no backend (/api/me/sincronizacao). A tela relê só o seu. */
export const ASSUNTOS = ["conta", "verificacao", "perfil", "safescore", "assinatura", "restricoes", "servicos", "avisos"] as const;
export type Assunto = (typeof ASSUNTOS)[number];
/** Assuntos que mudam a conta canônica (/api/me): Home, avisos de cadastro, selo. */
export const ASSUNTOS_DA_CONTA: readonly Assunto[] = ["conta", "verificacao", "perfil", "restricoes"];

const revisoesZeradas = (): Record<Assunto, number> => Object.fromEntries(ASSUNTOS.map((a) => [a, 0])) as Record<Assunto, number>;

type Estado = {
  /** Conta a que as versões e revisões se referem. Outra conta zera tudo. */
  userId: string | null;
  versao: string | null;
  versoes: Partial<Record<Assunto, string>> | null;
  /** Aumenta a cada mudança confirmada (externa ou local), por assunto. As telas relêem quando o seu muda. */
  revisoes: Record<Assunto, number>;
  /** Última consulta bem-sucedida (ms). */
  confirmadoEm: number | null;
  /** Pedido de consulta imediata (notificação, volta do segundo plano, ação local). */
  pedido: number;
};

export const useSincronizacao = create<Estado>(() => ({ userId: null, versao: null, versoes: null, revisoes: revisoesZeradas(), confirmadoEm: null, pedido: 0 }));

/** Troca de conta ou logout: nada da conta anterior vale para a seguinte. */
export function reiniciarSincronizacao(userId: string | null): void {
  useSincronizacao.setState({ userId, versao: null, versoes: null, revisoes: revisoesZeradas(), confirmadoEm: null, pedido: 0 });
}

/** Pede uma consulta já (notificação recebida, app de volta ao primeiro plano). */
export function pedirSincronizacao(): void {
  useSincronizacao.setState((s) => ({ pedido: s.pedido + 1 }));
}

/**
 * Ação local concluída (salvou perfil, enviou documento, comprou plano): as
 * outras telas relêem já, e o backend é consultado para confirmar.
 */
export function sinalizarMudancaLocal(assuntos: readonly Assunto[]): void {
  useSincronizacao.setState((s) => ({ revisoes: somar(s.revisoes, assuntos), pedido: s.pedido + 1 }));
}

export function somar(revisoes: Record<Assunto, number>, assuntos: readonly Assunto[]): Record<Assunto, number> {
  const novo = { ...revisoes };
  for (const a of assuntos) novo[a] = (novo[a] ?? 0) + 1;
  return novo;
}

export type RespostaSincronizacao = { userId?: unknown; versao?: unknown; versoes?: unknown };

/**
 * Aplica a resposta da consulta. Devolve se a versão mudou (quem chama relê a
 * conta e avisa as telas). Resposta de outra conta, ou que chegou depois da
 * troca de conta, é descartada.
 */
export function aplicarResposta(contaDaConsulta: string, contaAtual: string | null, resposta: RespostaSincronizacao, agora: number): Assunto[] | "descartada" {
  if (!contaAtual || contaDaConsulta !== contaAtual || resposta.userId !== contaAtual || typeof resposta.versao !== "string") return "descartada";
  const s = useSincronizacao.getState();
  if (s.userId !== contaAtual) return "descartada";
  const versoes = (typeof resposta.versoes === "object" && resposta.versoes !== null ? resposta.versoes : {}) as Partial<Record<Assunto, string>>;
  // Primeira resposta da sessão só registra; depois, mudam os assuntos cuja versão mudou.
  const anteriores = s.versoes;
  const mudaram = anteriores === null ? [] : ASSUNTOS.filter((a) => versoes[a] !== anteriores[a]);
  useSincronizacao.setState({ versao: resposta.versao, versoes, confirmadoEm: agora });
  return mudaram;
}

export type DependenciasDoMotor = {
  /** Conta da sessão pronta agora (null: sem sessão, login ou bootstrap). */
  contaAtual: () => string | null;
  appAtivo: () => boolean;
  consultar: () => Promise<RespostaSincronizacao>;
  /** Relê a conta canônica depois de uma mudança; só aplica se a conta ainda for `conta`. */
  aoMudar: (conta: string) => Promise<void>;
  agora: () => number;
  agendar: (fn: () => void, ms: number) => unknown;
  cancelar: (id: unknown) => void;
};

/**
 * Ciclo de consultas, sem React: um único agendamento por vez, uma consulta em
 * andamento por vez (pedido no meio repete logo depois), espera crescente
 * depois de falha e nada em segundo plano ou sem sessão.
 */
export function criarMotorDeSincronizacao(d: DependenciasDoMotor) {
  let timer: unknown = null;
  let emAndamento = false;
  let repetir = false;
  let falhas = 0;
  let parado = false;

  const limpar = () => { if (timer !== null) d.cancelar(timer); timer = null; };
  const agendar = (ms: number) => { limpar(); timer = d.agendar(() => { timer = null; void consultar(); }, ms); };

  async function consultar(): Promise<void> {
    const conta = d.contaAtual();
    if (parado || !conta || !d.appAtivo()) return;
    if (emAndamento) { repetir = true; return; }
    emAndamento = true;
    let ok = false;
    try {
      const r = aplicarResposta(conta, d.contaAtual(), await d.consultar(), d.agora());
      ok = r !== "descartada";
      if (r !== "descartada" && r.length) {
        // Conta canônica primeiro (Home, avisos, selo), só se mudou algo dela;
        // depois relêem só as telas dos assuntos que mudaram.
        try {
          if (r.some((a) => ASSUNTOS_DA_CONTA.includes(a))) await d.aoMudar(conta);
        } finally {
          if (d.contaAtual() === conta) useSincronizacao.setState((s) => ({ revisoes: somar(s.revisoes, r) }));
        }
      }
    } catch {
      ok = false;
    } finally {
      emAndamento = false;
    }
    if (parado) return;
    falhas = ok ? 0 : falhas + 1;
    if (repetir) { repetir = false; return consultar(); }
    if (d.appAtivo() && d.contaAtual() === conta) agendar(ok ? INTERVALO_MS : esperaAposFalha(falhas));
  }

  return {
    /** Sessão pronta (ou trocou de conta): zera e consulta já. */
    iniciar(conta: string | null) {
      parado = false;
      limpar();
      falhas = 0;
      repetir = false;
      reiniciarSincronizacao(conta);
      if (conta) void consultar();
    },
    pedir: () => consultar(),
    aoPrimeiroPlano: () => consultar(),
    aoSegundoPlano: () => limpar(),
    parar() { parado = true; limpar(); },
    get agendado() { return timer !== null; },
  };
}
