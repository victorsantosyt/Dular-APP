import { decisaoVigente, type Decisao } from "@/lib/decisaoVerificacao";

/**
 * Cards da tela de Notificações: o EVENTO original (aviso gravado, com texto,
 * data e vínculo) separado da APRESENTAÇÃO ATUAL, calculada aqui a partir do
 * estado vigente no banco. Nada é reescrito: os avisos ficam como nasceram.
 *
 * Notificação acionável é a que tem ciclo de pendência (hoje, só a verificação
 * documental). As demais viram um card simples, um por evento, sem
 * apresentação calculada — mensagens, serviços e avisos informativos têm
 * ciclos próprios e não herdam a regra de documentos.
 *
 * Agrupamento: só eventos com vínculo EXPLÍCITO ao mesmo envio
 * (`verificacaoId`), conferido contra os envios da própria conta. Envios
 * diferentes nunca se juntam. Aviso de verificação sem vínculo confiável fica
 * sozinho, como "Aviso anterior".
 *
 * Leitura (`readAt`) e resolução (`apresentacao.estado`) são independentes.
 */

export const TIPOS_VERIFICACAO = new Set(["VERIFICACAO_APROVADA", "VERIFICACAO_REPROVADA"]);
export const TIPOS_CHAT = new Set(["CHAT_NOVA_MENSAGEM", "MENSAGEM_RECEBIDA"]);

export type Evento = {
  id: string;
  type: string;
  title: string;
  body: string;
  servicoId: string | null;
  chatRoomId: string | null;
  verificacaoId: string | null;
  decisaoVerificacaoId: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export type Envio = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisao: string | null;
  motivoUsuario: string | null;
  createdAt: Date;
  decididoEm: Date | null;
  decisoes: Array<{ id: string; decisao: string; createdAt: Date }>;
};

export type EstadoAcionavel = "ACAO_NECESSARIA" | "EM_ANALISE" | "RESOLVIDO" | "SUPERADO" | "AVISO_ANTERIOR";
/** O que o app pode oferecer. Não é rota: o app escolhe a tela pela tabela dele. */
export type AcaoDoCard = "REENVIAR" | "ACOMPANHAR" | "VER_CONTEXTO";

export type Apresentacao = {
  estado: EstadoAcionavel;
  rotulo: string;
  titulo: string;
  motivo: string | null;
  acao: AcaoDoCard;
  /** Quando o estado mostrado mudou pela última vez (não a data do evento). */
  estadoAtualizadoEm: Date | null;
};

export type Card = {
  id: string;
  tipo: "VERIFICACAO" | "SIMPLES";
  /** Evento mostrado no card (o mais recente do grupo). */
  principal: Evento;
  /** Todos os eventos do card, do mais recente ao mais antigo. */
  eventos: Evento[];
  naoLidos: number;
  apresentacao: Apresentacao | null;
  /** Envio a que o card se refere (só VERIFICACAO com vínculo). */
  verificacaoId: string | null;
};

function maisRecente<T extends { createdAt: Date }>(xs: T[]): T | null {
  return xs.reduce<T | null>((m, x) => (!m || x.createdAt.getTime() > m.createdAt.getTime() ? x : m), null);
}

/** Apresentação do card de um envio, pelo estado do envio MAIS RECENTE da conta. */
export function apresentacaoDoEnvio(envioDoCard: Envio, envios: Envio[]): Apresentacao {
  const atual = maisRecente(envios) ?? envioDoCard;
  const atualizado = atual.decididoEm ?? atual.createdAt;
  const decisao: Decisao | null = atual.status === "PENDING" ? null : decisaoVigente(atual.status, atual.decisao);

  if (envioDoCard.id === atual.id) {
    if (atual.status === "PENDING") {
      return { estado: "EM_ANALISE", rotulo: "Em análise", titulo: "Documentos em análise", motivo: null, acao: "ACOMPANHAR", estadoAtualizadoEm: atualizado };
    }
    if (decisao === "APROVADO") {
      return { estado: "RESOLVIDO", rotulo: "Resolvido", titulo: "Documentos aprovados", motivo: null, acao: "ACOMPANHAR", estadoAtualizadoEm: atualizado };
    }
    // REJECTED. O backend aceita novo envio depois de reprovação e de pedido de
    // reenvio (/api/verificacoes só recusa PENDENTE e APROVADO): as duas pedem
    // ação. Não existe reprovação definitiva nas regras atuais.
    return {
      estado: "ACAO_NECESSARIA",
      rotulo: "Ação necessária",
      titulo: decisao === "REENVIO" ? "Reenvie seus documentos" : "Verificação não aprovada — envie novos documentos",
      motivo: atual.motivoUsuario ?? null,
      acao: "REENVIAR",
      estadoAtualizadoEm: atualizado,
    };
  }

  // Card de um envio anterior: o pedido dele foi atendido por um envio novo.
  if (atual.status === "PENDING") {
    return { estado: "EM_ANALISE", rotulo: "Reenvio realizado", titulo: "Em análise", motivo: null, acao: "ACOMPANHAR", estadoAtualizadoEm: atualizado };
  }
  if (decisao === "APROVADO") {
    return { estado: "RESOLVIDO", rotulo: "Resolvido", titulo: "Documentos aprovados", motivo: null, acao: "ACOMPANHAR", estadoAtualizadoEm: atualizado };
  }
  // O envio novo também foi reprovado: quem cobra a ação é o card dele.
  return { estado: "SUPERADO", rotulo: "Aviso anterior", titulo: "Decisão atualizada", motivo: null, acao: "VER_CONTEXTO", estadoAtualizadoEm: atualizado };
}

const AVISO_ANTERIOR: Apresentacao = {
  estado: "AVISO_ANTERIOR",
  rotulo: "Aviso anterior",
  titulo: "Pode não representar uma pendência atual",
  motivo: null,
  acao: "VER_CONTEXTO",
  estadoAtualizadoEm: null,
};

/** Monta os cards a partir dos eventos e dos envios da MESMA conta. Puro. */
export function montarCards(eventos: Evento[], envios: Envio[]): Card[] {
  const enviosPorId = new Map(envios.map((e) => [e.id, e]));
  const grupos = new Map<string, Evento[]>();
  const cards: Card[] = [];

  for (const ev of eventos) {
    if (TIPOS_CHAT.has(ev.type)) continue;
    if (TIPOS_VERIFICACAO.has(ev.type)) {
      const envio = ev.verificacaoId ? enviosPorId.get(ev.verificacaoId) : undefined;
      const vinculoValido = Boolean(envio && ev.decisaoVerificacaoId && envio.decisoes.some((d) => d.id === ev.decisaoVerificacaoId));
      if (vinculoValido) {
        const lista = grupos.get(envio!.id) ?? [];
        lista.push(ev);
        grupos.set(envio!.id, lista);
        continue;
      }
      cards.push({ id: `evento:${ev.id}`, tipo: "VERIFICACAO", principal: ev, eventos: [ev], naoLidos: ev.readAt ? 0 : 1, apresentacao: AVISO_ANTERIOR, verificacaoId: null });
      continue;
    }
    cards.push({ id: `evento:${ev.id}`, tipo: "SIMPLES", principal: ev, eventos: [ev], naoLidos: ev.readAt ? 0 : 1, apresentacao: null, verificacaoId: null });
  }

  for (const [envioId, lista] of grupos) {
    const ordenados = [...lista].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1));
    cards.push({
      id: `verificacao:${envioId}`,
      tipo: "VERIFICACAO",
      principal: ordenados[0],
      eventos: ordenados,
      naoLidos: ordenados.filter((e) => !e.readAt).length,
      apresentacao: apresentacaoDoEnvio(enviosPorId.get(envioId)!, envios),
      verificacaoId: envioId,
    });
  }

  // Ordem pelo evento principal (data do EVENTO, não da atualização do estado):
  // um aviso antigo não sobe como se fosse novo.
  return cards.sort(compararCards);
}

export function compararCards(a: Card, b: Card): number {
  const d = b.principal.createdAt.getTime() - a.principal.createdAt.getTime();
  if (d !== 0) return d;
  return a.principal.id < b.principal.id ? 1 : a.principal.id > b.principal.id ? -1 : 0;
}

export type Filtro = "todas" | "nao_lidas" | "lidas";

/**
 * Filtros sobre CARDS: "não lidas" = card com algum evento não lido (inclusive
 * no histórico); "lidas" = card sem nenhum evento não lido.
 */
export function filtrar(cards: Card[], filtro: Filtro): Card[] {
  if (filtro === "nao_lidas") return cards.filter((c) => c.naoLidos > 0);
  if (filtro === "lidas") return cards.filter((c) => c.naoLidos === 0);
  return cards;
}

/** Cursor estável: data e id do evento principal do último card da página. */
export function cursorDe(card: Card): string {
  return `${card.principal.createdAt.toISOString()}|${card.principal.id}`;
}

export function paginar(cards: Card[], cursor: string | null, limite: number): { pagina: Card[]; proximoCursor: string | null } {
  let inicio = 0;
  if (cursor) {
    const [iso, id] = cursor.split("|");
    const t = Date.parse(iso);
    if (Number.isFinite(t) && id) {
      const marco = { principal: { createdAt: new Date(t), id } } as Card;
      inicio = cards.findIndex((c) => compararCards(marco, c) < 0);
      if (inicio < 0) inicio = cards.length;
    }
  }
  const pagina = cards.slice(inicio, inicio + limite);
  const temMais = inicio + limite < cards.length;
  return { pagina, proximoCursor: temMais && pagina.length ? cursorDe(pagina[pagina.length - 1]) : null };
}

/** Campos lidos do banco — sempre filtrados pelo `userId` de quem pediu. */
export const SELECT_EVENTO = {
  id: true, type: true, title: true, body: true, servicoId: true, chatRoomId: true,
  verificacaoId: true, decisaoVerificacaoId: true, readAt: true, createdAt: true,
} as const;

export const SELECT_ENVIO = {
  id: true, status: true, decisao: true, motivoUsuario: true, createdAt: true, decididoEm: true,
  decisoes: { select: { id: true, decisao: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
} as const;

/** O que vai para o app. Nada de campo interno; datas em ISO. */
export function cardPublico(c: Card) {
  return {
    id: c.id,
    tipo: c.tipo,
    principal: {
      id: c.principal.id,
      type: c.principal.type,
      title: c.principal.title,
      body: c.principal.body,
      servicoId: c.principal.servicoId,
      createdAt: c.principal.createdAt.toISOString(),
      readAt: c.principal.readAt ? c.principal.readAt.toISOString() : null,
    },
    eventos: c.eventos.length,
    naoLidos: c.naoLidos,
    verificacaoId: c.verificacaoId,
    apresentacao: c.apresentacao
      ? { ...c.apresentacao, estadoAtualizadoEm: c.apresentacao.estadoAtualizadoEm ? c.apresentacao.estadoAtualizadoEm.toISOString() : null }
      : null,
  };
}
