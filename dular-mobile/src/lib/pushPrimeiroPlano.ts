import { CHAT_TYPES } from "./destinoNotificacao";

/**
 * O que fazer quando um push chega com o app aberto.
 *
 * - Mensagem: a lista de conversas e o contador precisam atualizar na hora (o
 *   cache de 15 s os deixava velhos até trocar de tela).
 * - Mensagem da conversa que está aberta: sem popup (a pessoa está lendo). A
 *   conversa é atualizada ANTES da lista — o GET da sala marca como lida, e
 *   atualizar a lista antes mostraria um "não lida" que não existe.
 * - Demais avisos: popup e atualização do sino.
 */
export type AcaoPush = {
  mostrarPopup: boolean;
  atualizarConversaAberta: boolean;
  atualizarMensagens: boolean;
  atualizarNotificacoes: boolean;
};

export function decidirPushPrimeiroPlano(
  dados: { tipo?: unknown; servicoId?: unknown },
  servicoIdAberto: string | null,
): AcaoPush {
  const tipo = typeof dados.tipo === "string" ? dados.tipo : "";
  const servicoId = typeof dados.servicoId === "string" ? dados.servicoId : null;

  if (CHAT_TYPES.has(tipo)) {
    const daConversaAberta = servicoId !== null && servicoId === servicoIdAberto;
    return {
      mostrarPopup: !daConversaAberta,
      atualizarConversaAberta: daConversaAberta,
      atualizarMensagens: true,
      atualizarNotificacoes: false,
    };
  }
  return { mostrarPopup: true, atualizarConversaAberta: false, atualizarMensagens: false, atualizarNotificacoes: true };
}

/**
 * O aviso é da conta que está na tela? O servidor manda `destinatarioId` no
 * `data` de todo push. Aviso de outra conta (token ainda associado a ela, ex.:
 * logout sem rede) não abre popup, não mexe em contador/cache e não navega.
 * Sem sessão, nada passa. Sem `destinatarioId` (backend anterior) passa, por
 * compatibilidade.
 */
export function pertenceASessao(dados: { destinatarioId?: unknown }, usuarioAtual: string | null): boolean {
  if (!usuarioAtual) return false;
  const destino = dados.destinatarioId;
  if (typeof destino === "string" && destino) return destino === usuarioAtual;
  return true;
}

type ConteudoPush = { title?: string | null; body?: string | null; data?: Record<string, unknown> | null };

function tipoDoPush(data: Record<string, unknown>): string {
  // O backend manda `type`; `tipo` fica por compatibilidade.
  const t = data.type ?? data.tipo;
  return typeof t === "string" ? t : "";
}

/** O que o popup precisa de uma conversa (subconjunto de ChatRoom). */
export type SalaResumo = {
  servicoId: string;
  outroUsuario: { nome: string };
  ultimaMensagem?: { texto: string; senderId: string; type: string };
};

export type PopupPush = {
  tipo: string;
  titulo: string;
  corpo: string;
  servicoId: string | null;
  chatRoomId: string | null;
  /** Id da Notification no backend: o toque marca só ela como lida. */
  notificationId?: string | null;
  /** Agrupamento na fila do popup (`chat:<servicoId>`). */
  chave?: string | null;
};

const PREVIA_MAX = 80;

/**
 * Popup de mensagem com nome e prévia vindos da API AUTENTICADA (fase 1B).
 *
 * O push remoto só traz texto neutro (lib/pushPublico no servidor): nome e
 * texto nunca voltam para o payload. Com o app aberto e a sessão conferida, o
 * app busca a lista de conversas desta conta e monta o popup a partir dela.
 * Sem a conversa na lista, ou se a última mensagem é minha, fica o texto
 * neutro do push.
 */
export function popupDeMensagem(
  salas: readonly SalaResumo[] | null,
  base: PopupPush,
  usuario: string,
): PopupPush {
  const sala = salas?.find((s) => s.servicoId === base.servicoId);
  if (!sala) return base;
  const u = sala.ultimaMensagem;
  let corpo = base.corpo;
  if (u && u.senderId !== usuario) {
    if (u.type === "IMAGE") corpo = "📷 Foto";
    else if (u.type === "LOCATION") corpo = "📍 Localização";
    else if (u.texto) corpo = u.texto.length > PREVIA_MAX ? `${u.texto.slice(0, PREVIA_MAX - 1)}…` : u.texto;
  }
  return { ...base, titulo: sala.outroUsuario.nome || base.titulo, corpo };
}

/** Quantas vezes, no máximo, uma preparação rebusca a lista por pushes novos. */
export const MAX_REBUSCAS = 3;

type DepsPreparo = {
  usuario: () => string | null;
  atualizarSalas: () => Promise<readonly SalaResumo[] | null>;
  mostrarPopup: (p: PopupPush) => void;
};

/**
 * Agrupa os popups de mensagem por conversa ENQUANTO são preparados.
 *
 * Sem isto, três pushes rápidos da mesma conversa faziam três buscas e três
 * popups iguais, todos com a última mensagem. Aqui:
 * - um push de uma conversa que já está sendo preparada só marca "busque de
 *   novo" — a preparação em curso rebusca a lista (até `MAX_REBUSCAS`) e
 *   mostra UM popup com a prévia mais recente;
 * - as buscas de uma preparação são sequenciais: resposta antiga nunca
 *   sobrescreve a mais nova;
 * - se ainda chegou push depois da última rebusca permitida, uma nova
 *   preparação começa logo após mostrar (a mensagem não se perde);
 * - conversas diferentes são independentes;
 * - `limpar()` (logout) abre uma geração nova: preparação antiga não mostra
 *   nada, e a sessão também é conferida antes de mostrar.
 * Na fila, avisos da mesma conversa se substituem (notificacaoPopupStore).
 */
export function criarAgrupadorPopups() {
  let geracao = 0;
  const preparando = new Map<string, { usuario: string; geracao: number; deNovo: boolean }>();

  async function preparar(base: PopupPush, usuario: string, deps: DepsPreparo): Promise<"tratado" | "agrupado" | "sessao-mudou"> {
    const chave = base.servicoId ? `chat:${base.servicoId}` : null;
    const valida = (g: number) => g === geracao && deps.usuario() === usuario;

    if (chave) {
      const em = preparando.get(chave);
      if (em && em.usuario === usuario && em.geracao === geracao) {
        em.deNovo = true;
        return "agrupado";
      }
    }

    const estado = { usuario, geracao, deNovo: false };
    if (chave) preparando.set(chave, estado);
    let restou = false;
    try {
      let salas: readonly SalaResumo[] | null = null;
      let buscas = 0;
      do {
        estado.deNovo = false;
        salas = await deps.atualizarSalas().catch(() => null);
        buscas++;
      } while (estado.deNovo && buscas <= MAX_REBUSCAS && valida(estado.geracao));

      if (!valida(estado.geracao)) return "sessao-mudou";
      deps.mostrarPopup({ ...popupDeMensagem(salas, base, usuario), chave });
      restou = estado.deNovo;
      return "tratado";
    } finally {
      if (chave && preparando.get(chave) === estado) preparando.delete(chave);
      // Push que chegou depois da última rebusca permitida: não se perde.
      if (restou && valida(estado.geracao)) void preparar(base, usuario, deps);
    }
  }

  return {
    preparar,
    /** Logout: nada que estava sendo preparado aparece depois. */
    limpar(): void {
      geracao++;
      preparando.clear();
    },
    /** Para teste: conversas em preparação agora. */
    get emPreparo(): number {
      return preparando.size;
    },
  };
}

/** Instância do app (o authStore limpa no logout). */
export const agrupadorPopups = criarAgrupadorPopups();

export function limparAgrupamentoDePopups(): void {
  agrupadorPopups.limpar();
}

/**
 * Push chegou com o app aberto. Aplica a sessão (`pertenceASessao`) e a
 * decisão (`decidirPushPrimeiroPlano`). Efeitos injetados para testar sem
 * expo-notifications.
 *
 * Mensagem com popup: busca a lista de conversas AGORA (dado posterior ao
 * push, da sessão atual) — isso já atualiza lista e contador — e monta o
 * popup com ela, agrupando pushes da mesma conversa (criarAgrupadorPopups).
 * Se a sessão mudar durante a busca, não mostra nada.
 */
export async function tratarPushRecebido(
  conteudo: ConteudoPush,
  deps: {
    usuario: () => string | null;
    chatAberto: () => { servicoId: string; atualizar: () => Promise<void> } | null;
    mostrarPopup: (p: PopupPush) => void;
    atualizarSalas: () => Promise<readonly SalaResumo[] | null>;
    invalidarMensagens: () => void;
    invalidarNotificacoes: () => void;
    /** Padrão: a instância do app. Testes passam a sua. */
    agrupador?: ReturnType<typeof criarAgrupadorPopups>;
  },
): Promise<"ignorado-outra-sessao" | "sessao-mudou" | "agrupado" | "tratado"> {
  const dados = conteudo.data ?? {};
  const usuario = deps.usuario();
  if (!usuario || !pertenceASessao(dados, usuario)) return "ignorado-outra-sessao";
  const tipo = tipoDoPush(dados);
  const aberto = deps.chatAberto();
  const acao = decidirPushPrimeiroPlano({ tipo, servicoId: dados.servicoId }, aberto?.servicoId ?? null);
  const base: PopupPush = {
    tipo: tipo || "SISTEMA",
    titulo: conteudo.title ?? "Dular",
    corpo: conteudo.body ?? "",
    servicoId: typeof dados.servicoId === "string" ? dados.servicoId : null,
    chatRoomId: typeof dados.chatRoomId === "string" ? dados.chatRoomId : null,
    notificationId: typeof dados.notificationId === "string" ? dados.notificationId : null,
  };

  if (acao.atualizarNotificacoes) deps.invalidarNotificacoes();

  if (acao.atualizarConversaAberta && aberto) {
    // Conversa aberta: sem popup. A conversa primeiro (o GET marca como lida),
    // a lista depois — senão o contador subiria à toa.
    await aberto.atualizar().catch(() => undefined);
    if (acao.atualizarMensagens) deps.invalidarMensagens();
    return "tratado";
  }

  if (acao.mostrarPopup && acao.atualizarMensagens) {
    return (deps.agrupador ?? agrupadorPopups).preparar(base, usuario, deps);
  }

  if (acao.mostrarPopup) deps.mostrarPopup(base);
  else if (acao.atualizarMensagens) deps.invalidarMensagens();
  return "tratado";
}

/** Com o app aberto, o sistema só mostra na bandeja avisos DESTA sessão. */
export function apresentacaoNoPrimeiroPlano(dados: Record<string, unknown> | null | undefined, usuario: string | null) {
  const minha = pertenceASessao(dados ?? {}, usuario);
  return {
    // Banner do SISTEMA desligado com o app em primeiro plano: quem aparece é o
    // popup do próprio app (NotificacaoPopup). Com o app fechado ou em segundo
    // plano o sistema entrega sozinho — este handler só roda em primeiro plano.
    shouldShowBanner: false,
    shouldShowList: minha,
    shouldPlaySound: minha,
    shouldSetBadge: minha,
  };
}
