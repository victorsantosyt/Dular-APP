import assert from "node:assert/strict";
import test from "node:test";
import {
  criarAgrupadorPopups,
  MAX_REBUSCAS,
  tratarPushRecebido,
  type PopupPush,
  type SalaResumo,
} from "../src/lib/pushPrimeiroPlano";
import { useNotificacaoPopup } from "../src/stores/notificacaoPopupStore";

const tick = () => new Promise((r) => setImmediate(r));
async function ticks(n = 6) {
  for (let i = 0; i < n; i++) await tick();
}

function adiavel<T>() {
  let resolver!: (v: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

const push = (servicoId: string, destinatarioId = "A") => ({
  title: "Nova mensagem",
  body: "Você recebeu uma mensagem no Dular.",
  data: { type: "CHAT_NOVA_MENSAGEM", servicoId, chatRoomId: `r-${servicoId}`, destinatarioId },
});
const sala = (servicoId: string, nome: string, texto: string): SalaResumo => ({
  servicoId,
  outroUsuario: { nome },
  ultimaMensagem: { texto, senderId: "B", type: "TEXT" },
});

/** Cenário controlado: cada busca da lista fica pendente até o teste responder. */
function cenario(opts: { usuario?: string | null; aberto?: string | null } = {}) {
  const u = { atual: opts.usuario === undefined ? "A" : opts.usuario };
  const buscas: Array<ReturnType<typeof adiavel<readonly SalaResumo[] | null>>> = [];
  const popups: PopupPush[] = [];
  const agrupador = criarAgrupadorPopups();
  const log: string[] = [];
  const deps = {
    usuario: () => u.atual,
    chatAberto: () => (opts.aberto ? { servicoId: opts.aberto, atualizar: async () => void log.push("conversa") } : null),
    mostrarPopup: (p: PopupPush) => void popups.push(p),
    atualizarSalas: () => {
      const d = adiavel<readonly SalaResumo[] | null>();
      buscas.push(d);
      return d.promessa;
    },
    invalidarMensagens: () => void log.push("lista"),
    invalidarNotificacoes: () => {},
    agrupador,
  };
  return { u, buscas, popups, agrupador, deps, log, receber: (p: ReturnType<typeof push>) => tratarPushRecebido(p, deps) };
}

test("caso original: 3 pushes rápidos da mesma conversa → 1 popup com a mensagem mais recente", async () => {
  const c = cenario();
  const r = [c.receber(push("s1")), c.receber(push("s1")), c.receber(push("s1"))];
  await tick();
  assert.equal(c.buscas.length, 1, "uma preparação por conversa");
  // A 1ª busca leu o banco antes das mensagens 2 e 3.
  c.buscas[0].resolver([sala("s1", "Josafa", "msg 1")]);
  await ticks();
  assert.equal(c.buscas.length, 2, "rebusca porque chegaram mais pushes");
  c.buscas[1].resolver([sala("s1", "Josafa", "msg 3")]);
  const res = await Promise.all(r);
  await ticks();
  assert.deepEqual(res.sort(), ["agrupado", "agrupado", "tratado"]);
  assert.equal(c.popups.length, 1);
  assert.equal(c.popups[0].corpo, "msg 3");
  assert.equal(c.popups[0].titulo, "Josafa");
  assert.equal(c.popups[0].chave, "chat:s1");
  assert.equal(c.agrupador.emPreparo, 0);
});

test("resposta antiga não sobrescreve a nova (buscas sequenciais na preparação)", async () => {
  const c = cenario();
  const p1 = c.receber(push("s1"));
  await tick();
  void c.receber(push("s1"));
  // A resposta velha chega; como houve push novo, ela NÃO vira popup.
  c.buscas[0].resolver([sala("s1", "Josafa", "velha")]);
  await ticks();
  assert.equal(c.popups.length, 0);
  c.buscas[1].resolver([sala("s1", "Josafa", "nova")]);
  await p1;
  await ticks();
  assert.deepEqual(c.popups.map((p) => p.corpo), ["nova"]);
});

test("duas conversas diferentes → dois popups independentes", async () => {
  const c = cenario();
  const a = c.receber(push("s1"));
  const b = c.receber(push("s2"));
  await tick();
  assert.equal(c.buscas.length, 2);
  // Fora de ordem entre conversas: não misturam.
  c.buscas[1].resolver([sala("s1", "Josafa", "de s1"), sala("s2", "Jacirene", "de s2")]);
  c.buscas[0].resolver([sala("s1", "Josafa", "de s1"), sala("s2", "Jacirene", "de s2")]);
  await Promise.all([a, b]);
  assert.deepEqual(
    c.popups.map((p) => `${p.chave}|${p.titulo}|${p.corpo}`).sort(),
    ["chat:s1|Josafa|de s1", "chat:s2|Jacirene|de s2"],
  );
});

test("logout durante a preparação → nada aparece, e a nova sessão começa limpa", async () => {
  const c = cenario();
  const p = c.receber(push("s1"));
  await tick();
  c.agrupador.limpar();
  c.u.atual = "B";
  c.buscas[0].resolver([sala("s1", "Josafa", "segredo de A")]);
  assert.equal(await p, "sessao-mudou");
  assert.equal(c.popups.length, 0);
  assert.equal(c.agrupador.emPreparo, 0);
  // B recebe um push seu da MESMA conversa-id: não fica "agrupado" no estado de A.
  const pb = c.receber(push("s1", "B"));
  await tick();
  assert.equal(c.buscas.length, 2);
  c.buscas[1].resolver([{ servicoId: "s1", outroUsuario: { nome: "Victor" }, ultimaMensagem: { texto: "de B", senderId: "X", type: "TEXT" } }]);
  assert.equal(await pb, "tratado");
  assert.deepEqual(c.popups.map((x) => x.corpo), ["de B"]);
});

test("mensagem depois do popup já exibido → novo popup (não é descartada)", async () => {
  const c = cenario();
  const p1 = c.receber(push("s1"));
  await tick();
  c.buscas[0].resolver([sala("s1", "Josafa", "msg 1")]);
  await p1;
  const p2 = c.receber(push("s1"));
  await tick();
  assert.equal(c.buscas.length, 2, "nova preparação");
  c.buscas[1].resolver([sala("s1", "Josafa", "msg 2")]);
  await p2;
  assert.deepEqual(c.popups.map((p) => p.corpo), ["msg 1", "msg 2"]);
});

test("fluxo contínuo além do limite de rebuscas → mostra e prepara outro (nada se perde)", async () => {
  const c = cenario();
  const p = c.receber(push("s1"));
  for (let i = 0; i <= MAX_REBUSCAS; i++) {
    await tick();
    void c.receber(push("s1")); // chega push novo durante cada busca
    c.buscas[i].resolver([sala("s1", "Josafa", `msg ${i + 1}`)]);
    await ticks();
  }
  await p;
  assert.equal(c.popups.length, 1, "não segura o popup para sempre");
  assert.equal(c.popups[0].corpo, `msg ${MAX_REBUSCAS + 1}`);
  // O push que chegou depois da última rebusca gera nova preparação.
  await ticks();
  assert.equal(c.buscas.length, MAX_REBUSCAS + 2);
  c.buscas[MAX_REBUSCAS + 1].resolver([sala("s1", "Josafa", "a mais nova")]);
  await ticks();
  assert.deepEqual(c.popups.map((x) => x.corpo), [`msg ${MAX_REBUSCAS + 1}`, "a mais nova"]);
});

test("conversa aberta → sem popup e sem preparação", async () => {
  const c = cenario({ aberto: "s1" });
  await c.receber(push("s1"));
  await c.receber(push("s1"));
  assert.deepEqual(c.popups, []);
  assert.equal(c.buscas.length, 0);
  assert.deepEqual(c.log, ["conversa", "lista", "conversa", "lista"]);
});

test("sem sessão autenticada ou push de outra conta → nada", async () => {
  const c = cenario({ usuario: null });
  assert.equal(await c.receber(push("s1")), "ignorado-outra-sessao");
  const d = cenario();
  assert.equal(await d.receber(push("s1", "OUTRA")), "ignorado-outra-sessao");
  assert.equal(c.buscas.length + d.buscas.length, 0);
  assert.deepEqual([...c.popups, ...d.popups], []);
});

// ── Fila do popup (store real) ─────────────────────────────────────────────

function limparStore() {
  useNotificacaoPopup.getState().limpar();
}

test("fila: aviso da mesma conversa substitui o que ainda espera, no mesmo lugar", () => {
  limparStore();
  const s = useNotificacaoPopup.getState();
  s.mostrar({ tipo: "SERVICO_ACEITO", titulo: "na tela", corpo: "x", chave: null });
  s.mostrar({ tipo: "CHAT_NOVA_MENSAGEM", titulo: "Josafa", corpo: "msg 1", chave: "chat:s1" });
  s.mostrar({ tipo: "CHAT_NOVA_MENSAGEM", titulo: "Jacirene", corpo: "oi", chave: "chat:s2" });
  const idAntes = useNotificacaoPopup.getState().fila[0].id;
  s.mostrar({ tipo: "CHAT_NOVA_MENSAGEM", titulo: "Josafa", corpo: "msg 2", chave: "chat:s1" });
  const { fila } = useNotificacaoPopup.getState();
  assert.deepEqual(fila.map((f) => `${f.chave}|${f.corpo}`), ["chat:s1|msg 2", "chat:s2|oi"]);
  assert.equal(fila[0].id, idAntes, "mesma posição e mesma chave de render");
});

test("fila: a mesma conversa JÁ na tela → o novo espera a vez (não é descartado)", () => {
  limparStore();
  const s = useNotificacaoPopup.getState();
  s.mostrar({ tipo: "CHAT_NOVA_MENSAGEM", titulo: "Josafa", corpo: "msg 1", chave: "chat:s1" });
  s.mostrar({ tipo: "CHAT_NOVA_MENSAGEM", titulo: "Josafa", corpo: "msg 2", chave: "chat:s1" });
  const st = useNotificacaoPopup.getState();
  assert.equal(st.atual?.corpo, "msg 1");
  assert.deepEqual(st.fila.map((f) => f.corpo), ["msg 2"]);
  st.proxima();
  assert.equal(useNotificacaoPopup.getState().atual?.corpo, "msg 2");
});

test("fila: avisos sem chave continuam todos na fila; logout limpa tudo", () => {
  limparStore();
  const s = useNotificacaoPopup.getState();
  s.mostrar({ tipo: "SERVICO_ACEITO", titulo: "1", corpo: "", chave: null });
  s.mostrar({ tipo: "SERVICO_ACEITO", titulo: "2", corpo: "" });
  s.mostrar({ tipo: "SERVICO_CANCELADO", titulo: "3", corpo: "" });
  assert.equal(useNotificacaoPopup.getState().fila.length, 2);
  s.limpar();
  const st = useNotificacaoPopup.getState();
  assert.equal(st.atual, null);
  assert.deepEqual(st.fila, []);
});
