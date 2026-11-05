import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CardNotificacao, PaginaDeCards } from "../src/api/notificacoesApi";
import { criarListaDeCards, datasDoCard, tituloDoCard, type EstadoCards } from "../src/lib/cardsNotificacoes";

const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");

function card(id: string, p: Partial<CardNotificacao> = {}): CardNotificacao {
  return {
    id, tipo: "VERIFICACAO", eventos: 1, naoLidos: 1, verificacaoId: "e1",
    principal: { id: `n-${id}`, type: "VERIFICACAO_REPROVADA", title: "Envie os documentos novamente", body: "b", servicoId: null, createdAt: "2026-11-01T10:00:00.000Z", readAt: null },
    apresentacao: { estado: "ACAO_NECESSARIA", rotulo: "Ação necessária", titulo: "Reenvie seus documentos", motivo: "Imagem ilegível", acao: "REENVIAR", estadoAtualizadoEm: "2026-11-01T10:00:00.000Z" },
    ...p,
  };
}
const pagina = (cards: CardNotificacao[], proximoCursor: string | null = null): PaginaDeCards => ({
  filtro: "todas", cards, proximoCursor, contadores: { naoLidas: cards.length, acoesNecessarias: 1, cards: { todas: cards.length, nao_lidas: cards.length, lidas: 0 } },
});

function montar() {
  let epoca = 1;
  const pendentes: Array<{ p: { filtro: string; cursor: string | null }; resolver: (v: PaginaDeCards) => void; rejeitar: (e: unknown) => void }> = [];
  let ultimo: EstadoCards | null = null;
  const lista = criarListaDeCards({
    buscar: (p) => new Promise((resolver, rejeitar) => pendentes.push({ p, resolver, rejeitar })),
    epoca: () => epoca,
    notificar: (e) => { ultimo = e; },
  });
  return { lista, pendentes, estado: () => ultimo ?? lista.atual(), trocarConta: () => { epoca++; } };
}
const tick = () => new Promise((r) => setImmediate(r));

test("resposta atrasada é descartada: só a última consulta vale", async () => {
  const m = montar();
  const a = m.lista.recarregar();
  const b = m.lista.recarregar();
  m.pendentes[1].resolver(pagina([card("novo", { apresentacao: { ...card("x").apresentacao!, estado: "RESOLVIDO", rotulo: "Resolvido", titulo: "Documentos aprovados", acao: "ACOMPANHAR" } })]));
  m.pendentes[0].resolver(pagina([card("velho")]));
  await Promise.all([a, b]);
  assert.deepEqual(m.estado().cards.map((c) => c.id), ["novo"]);
  assert.equal(m.estado().cards[0].apresentacao!.estado, "RESOLVIDO");
});

test("troca de conta: some tudo da conta anterior, e a resposta dela não entra", async () => {
  const m = montar();
  const p = m.lista.recarregar();
  m.pendentes[0].resolver(pagina([card("a")]));
  await p;
  const atrasada = m.lista.recarregar();
  m.trocarConta();
  m.pendentes[1].resolver(pagina([card("da-conta-anterior")]));
  await atrasada;
  assert.deepEqual(m.estado().cards.map((c) => c.id), ["a"], "resposta pedida antes da troca não entra");
  const nova = m.lista.recarregar();
  assert.deepEqual(m.estado().cards, [], "ao recarregar na conta nova, a lista anterior é limpa antes da resposta");
  m.pendentes[2].resolver(pagina([card("b")]));
  await nova;
  assert.deepEqual(m.estado().cards.map((c) => c.id), ["b"]);
});

test("rede indisponível: mantém o que tinha, sinaliza erro, nada vira 'resolvido'; recupera na próxima consulta", async () => {
  const m = montar();
  const p1 = m.lista.recarregar();
  m.pendentes[0].resolver(pagina([card("pend")]));
  await p1;
  const p2 = m.lista.recarregar();
  m.pendentes[1].rejeitar(new Error("Network Error"));
  await p2;
  assert.equal(m.estado().erro, "Não foi possível atualizar as notificações.");
  assert.equal(m.estado().cards[0].apresentacao!.estado, "ACAO_NECESSARIA", "nada inventado");
  const p3 = m.lista.recarregar();
  m.pendentes[2].resolver(pagina([card("pend", { apresentacao: { ...card("x").apresentacao!, estado: "EM_ANALISE", rotulo: "Reenvio realizado", titulo: "Em análise", acao: "ACOMPANHAR" } })]));
  await p3;
  assert.equal(m.estado().erro, null);
  assert.equal(m.estado().cards[0].apresentacao!.estado, "EM_ANALISE");
});

test("backend sem a rota de cards (404): usa a lista antiga", async () => {
  const m = montar();
  const p = m.lista.recarregar();
  m.pendentes[0].rejeitar({ response: { status: 404 } });
  await p;
  assert.equal(m.estado().semSuporte, true);
});

test("carregar mais junta páginas sem repetir card; trocar filtro recomeça", async () => {
  const m = montar();
  const p1 = m.lista.recarregar();
  m.pendentes[0].resolver(pagina([card("a"), card("b")], "c1"));
  await p1;
  const p2 = m.lista.carregarMais();
  assert.equal(m.pendentes[1].p.cursor, "c1");
  m.pendentes[1].resolver(pagina([card("b"), card("c")], null));
  await p2;
  assert.deepEqual(m.estado().cards.map((c) => c.id), ["a", "b", "c"]);
  await m.lista.carregarMais();
  assert.equal(m.pendentes.length, 2, "sem cursor, não consulta");
  const p3 = m.lista.recarregar("nao_lidas");
  assert.deepEqual([m.estado().filtro, m.estado().cards.length], ["nao_lidas", 0]);
  m.pendentes[2].resolver(pagina([card("z")]));
  await p3;
  assert.equal(m.pendentes[2].p.filtro, "nao_lidas");
});

test("datas: evento e atualização do estado aparecem separados só quando diferem", () => {
  assert.deepEqual(datasDoCard(card("a")), { evento: "2026-11-01T10:00:00.000Z", estadoAtualizadoEm: null });
  const resolvido = card("b", { apresentacao: { ...card("x").apresentacao!, estado: "RESOLVIDO", estadoAtualizadoEm: "2026-11-03T09:00:00.000Z" } });
  assert.equal(datasDoCard(resolvido).estadoAtualizadoEm, "2026-11-03T09:00:00.000Z");
  assert.equal(tituloDoCard(card("a")), "Ação necessária — Reenvie seus documentos");
  assert.equal(tituloDoCard(card("s", { tipo: "SIMPLES", apresentacao: null })), "Envie os documentos novamente");
});

test("integração (complementar, leitura do fonte): a tela usa os cards, o motor de sincronização e não calcula estado", () => {
  const hook = ler("hooks", "useCardsNotificacoes.ts");
  assert.match(hook, /useAoMudarConta\(\["verificacao", "avisos"\]/);
  assert.doesNotMatch(hook, /setInterval/);
  const tela = ler("screens", "shared", "NotificacoesView.tsx");
  assert.match(tela, /useCardsNotificacoes\(activeTab\)/);
  assert.match(tela, /id: card\.principal\.id/);
  const cards = ler("screens", "shared", "NotificacoesCards.tsx");
  assert.doesNotMatch(cards, /estado: "RESOLVIDO"|ACAO_NECESSARIA" \?/, "o app não decide estado");
});
