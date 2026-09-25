import assert from "node:assert/strict";
import test from "node:test";
import { criarCacheCompartilhado } from "../src/lib/cacheCompartilhado";
import { confirmarEnvio, criarSincronizador, mesclarMensagens } from "../src/lib/sincronizadorChat";
import { criarRegistroPush, ESPERAS_MS } from "../src/lib/registroPush";
import { apresentacaoNoPrimeiroPlano, pertenceASessao, tratarPushRecebido } from "../src/lib/pushPrimeiroPlano";

const tick = () => new Promise((r) => setImmediate(r));

function adiavel<T>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

// ═══ P0 — isolamento do cache entre sessões ════════════════════════════════

function cacheComSessao() {
  let usuario: string | null = "A";
  const pedidos: Array<{ quem: string | null; d: ReturnType<typeof adiavel<string[]>>; signal: AbortSignal }> = [];
  let avisos = 0;
  const cache = criarCacheCompartilhado<string[]>({
    staleMs: 15000,
    vazio: () => [],
    mensagemDeErro: () => "erro",
    chaveSessao: () => usuario,
    buscar: (signal) => {
      const d = adiavel<string[]>();
      pedidos.push({ quem: usuario, d, signal });
      return d.promessa;
    },
  });
  cache.assinar(() => avisos++);
  return {
    cache,
    pedidos,
    entrar: (u: string | null) => (usuario = u),
    get avisos() {
      return avisos;
    },
  };
}

test("P0: A → logout → B → resposta de A NÃO entra no cache de B", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.cache.limpar();
  c.entrar("B");
  const deB = c.cache.obter();
  assert.equal(c.pedidos.length, 2, "B não reaproveita a promessa de A");
  assert.equal(c.pedidos[0].signal.aborted, true, "a busca de A é abortada");
  c.pedidos[0].d.resolver(["sala-de-A"]);
  await deA;
  assert.deepEqual(c.cache.atual().valor, null, "resposta velha descartada");
  c.pedidos[1].d.resolver(["sala-de-B"]);
  assert.deepEqual((await deB).valor, ["sala-de-B"]);
  assert.deepEqual(c.cache.atual().valor, ["sala-de-B"]);
});

test("P0: requisição nova resolve ANTES da antiga — a antiga não sobrescreve", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.cache.limpar();
  c.entrar("B");
  const deB = c.cache.obter();
  c.pedidos[1].d.resolver(["sala-de-B"]);
  await deB;
  c.pedidos[0].d.resolver(["sala-de-A"]);
  await deA;
  await tick();
  assert.deepEqual(c.cache.atual().valor, ["sala-de-B"]);
});

test("P0: rejeição da antiga depois de B entrar não mexe no estado nem na pendência de B", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.cache.limpar();
  c.entrar("B");
  const deB = c.cache.obter();
  c.pedidos[0].d.rejeitar(new Error("rede"));
  await deA;
  assert.equal(c.cache.atual().erro, null, "erro de A não vira erro de B");
  // A pendência de B continua sendo servida (não foi apagada pela de A).
  const deB2 = c.cache.obter();
  assert.equal(c.pedidos.length, 2, "B ainda está em voo e é reaproveitada");
  c.pedidos[1].d.resolver(["sala-de-B"]);
  assert.deepEqual((await deB2).valor, ["sala-de-B"]);
  await deB;
});

test("P0: invalidação durante a busca de A não dispara busca na sessão de B", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.cache.invalidar(); // agenda "buscar de novo" para A
  c.cache.limpar();
  c.entrar("B");
  c.pedidos[0].d.resolver(["sala-de-A"]);
  await deA;
  await tick();
  assert.equal(c.pedidos.length, 1, "nenhuma busca herdada de A");
  assert.deepEqual(c.cache.atual().valor, null);
});

test("P0: busca antiga não avisa os assinantes da sessão nova", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.cache.limpar();
  const antes = c.avisos;
  c.pedidos[0].d.resolver(["sala-de-A"]);
  await deA;
  await tick();
  assert.equal(c.avisos, antes);
});

test("P0: troca de conta SEM limpar() (defesa em profundidade) também isola", async () => {
  const c = cacheComSessao();
  const deA = c.cache.obter(true);
  c.pedidos[0].d.resolver(["sala-de-A"]);
  await deA;
  c.entrar("B"); // clearSession não rodou
  assert.equal(c.cache.atual().valor, null, "B não lê o valor de A");
  const deB = c.cache.obter();
  assert.equal(c.pedidos.length, 2, "cache de A não conta como fresco para B");
  c.pedidos[1].d.resolver(["sala-de-B"]);
  assert.deepEqual((await deB).valor, ["sala-de-B"]);
});

test("invalidar durante a busca (mesma sessão) ainda busca de novo depois, uma vez", async () => {
  const c = cacheComSessao();
  const p = c.cache.obter(true);
  c.cache.invalidar();
  c.cache.invalidar();
  c.pedidos[0].d.resolver(["v1"]);
  await p;
  await tick();
  assert.equal(c.pedidos.length, 2);
  c.pedidos[1].d.resolver(["v2"]);
  await tick();
  await tick();
  assert.equal(c.pedidos.length, 2);
  assert.deepEqual(c.cache.atual().valor, ["v2"]);
});

// ═══ P1 — eventos simultâneos no chat ══════════════════════════════════════

type Msg = { id: string; criadaEm: string; status?: string };
const msg = (id: string, s: number, status = "enviado"): Msg => ({
  id,
  criadaEm: new Date(2026, 8, 25, 10, 0, s).toISOString(),
  status,
});

/** Simula a tela: o sincronizador chama um GET falso e aplica com mesclar. */
function telaDeChat() {
  let estado: Msg[] = [];
  const gets: Array<ReturnType<typeof adiavel<Msg[]>>> = [];
  const sinc = criarSincronizador(async (signal) => {
    const d = adiavel<Msg[]>();
    gets.push(d);
    const servidor = await d.promessa;
    if (signal.aborted) return;
    estado = mesclarMensagens(servidor, estado);
  });
  return { sinc, gets, get estado() { return estado; } };
}

test("P1: duas mensagens durante um GET — a 2ª não se perde", async () => {
  const t = telaDeChat();
  const evento1 = t.sinc.sincronizar();
  const evento2 = t.sinc.sincronizar(); // chega com o GET em voo
  const evento3 = t.sinc.sincronizar(); // e outra ainda
  assert.equal(t.gets.length, 1, "não dispara GET em paralelo");
  t.gets[0].resolver([msg("m1", 1)]); // GET leu o banco antes da m2
  await evento1;
  await tick();
  assert.equal(t.gets.length, 2, "uma busca extra para os eventos agrupados");
  t.gets[1].resolver([msg("m1", 1), msg("m2", 2)]);
  await Promise.all([evento2, evento3]);
  assert.deepEqual(t.estado.map((m) => m.id), ["m1", "m2"], "ambas, em ordem, sem duplicar");
  await tick();
  assert.equal(t.gets.length, 2, "sem requisição infinita");
});

test("P1: atualizar() só resolve quando a busca que o cobre termina", async () => {
  const t = telaDeChat();
  void t.sinc.sincronizar();
  let resolveu = false;
  const pedido = t.sinc.sincronizar().then(() => (resolveu = true));
  t.gets[0].resolver([msg("m1", 1)]);
  await tick();
  assert.equal(resolveu, false, "ainda falta a busca extra");
  t.gets[1].resolver([msg("m1", 1), msg("m2", 2)]);
  await pedido;
  assert.equal(resolveu, true);
});

test("P1: cleanup durante a requisição — nada é aplicado e nada novo começa", async () => {
  const t = telaDeChat();
  const p = t.sinc.sincronizar();
  void t.sinc.sincronizar();
  t.sinc.parar();
  t.gets[0].resolver([msg("m1", 1)]);
  await p;
  await tick();
  assert.deepEqual(t.estado, [], "resultado depois do parar é descartado");
  assert.equal(t.gets.length, 1, "busca extra não roda depois do parar");
  await t.sinc.sincronizar();
  assert.equal(t.gets.length, 1);
});

test("P1: troca rápida de conversa — a antiga para, a nova segue sozinha", async () => {
  const antiga = telaDeChat();
  const nova = telaDeChat();
  const pa = antiga.sinc.sincronizar();
  antiga.sinc.parar();
  const pn = nova.sinc.sincronizar();
  antiga.gets[0].resolver([msg("de-A", 1)]);
  nova.gets[0].resolver([msg("de-B", 1)]);
  await Promise.all([pa, pn]);
  assert.deepEqual(antiga.estado, []);
  assert.deepEqual(nova.estado.map((m) => m.id), ["de-B"]);
});

test("mensagem otimista não some quando o GET chega antes do POST", () => {
  const local = [msg("m1", 1), msg("temp-9", 5, "enviando")];
  const aposGet = mesclarMensagens([msg("m1", 1)], local);
  assert.deepEqual(aposGet.map((m) => m.id), ["m1", "temp-9"]);
  // POST responde: troca a temp pela real, sem duplicar se o GET já a trouxe.
  const comReal = mesclarMensagens([msg("m1", 1), msg("m9", 5)], aposGet);
  const final = confirmarEnvio(comReal, "temp-9", msg("m9", 5));
  assert.deepEqual(final.map((m) => m.id), ["m1", "m9"]);
});

// ═══ P1 — registro do token e sessão ═══════════════════════════════════════

function relogio() {
  const tarefas = new Map<number, { fn: () => void; ms: number }>();
  let seq = 0;
  return {
    agendar: (fn: () => void, ms: number) => {
      tarefas.set(++seq, { fn, ms });
      return seq;
    },
    cancelar: (id: unknown) => void tarefas.delete(id as number),
    disparar: () => {
      const [id, t] = [...tarefas.entries()][0] ?? [];
      if (id === undefined) return null;
      tarefas.delete(id);
      t!.fn();
      return t!.ms;
    },
    get pendentes() {
      return tarefas.size;
    },
  };
}

function registroDeTeste(opts: { falhas?: number } = {}) {
  let usuario: string | null = "A";
  let falhas = opts.falhas ?? 0;
  const enviados: Array<{ token: string; usuario: string | null }> = [];
  const r = relogio();
  const reg = criarRegistroPush({
    usuario: () => usuario,
    obterToken: async () => "ExponentPushToken[T]",
    enviar: async (token) => {
      if (falhas > 0) {
        falhas--;
        throw new Error("sem rede");
      }
      enviados.push({ token, usuario });
    },
    agendar: r.agendar,
    cancelar: r.cancelar,
  });
  return { reg, r, enviados, entrar: (u: string | null) => (usuario = u) };
}

test("registro: sem sessão não registra", async () => {
  const t = registroDeTeste();
  t.entrar(null);
  assert.equal(await t.reg.iniciarSessao(), "sem-sessao");
  assert.equal(t.enviados.length, 0);
});

test("registro: falhou → novas tentativas limitadas e espaçadas, sem loop", async () => {
  const t = registroDeTeste({ falhas: 10 });
  assert.equal(await t.reg.iniciarSessao(), "falhou");
  const esperas: number[] = [];
  for (let i = 0; i < 6; i++) {
    const ms = t.r.disparar();
    if (ms === null) break;
    esperas.push(ms);
    await tick();
  }
  assert.deepEqual(esperas, [...ESPERAS_MS], "exatamente 3 novas tentativas");
  assert.equal(t.r.pendentes, 0);
  assert.equal(t.enviados.length, 0);
});

test("registro: recupera na nova tentativa (rede voltou)", async () => {
  const t = registroDeTeste({ falhas: 1 });
  assert.equal(await t.reg.iniciarSessao(), "falhou");
  t.r.disparar();
  await tick();
  await tick();
  assert.deepEqual(t.enviados, [{ token: "ExponentPushToken[T]", usuario: "A" }]);
  assert.equal(t.r.pendentes, 0);
});

test("registro: app de volta ao primeiro plano tenta de novo; já registrado não repete", async () => {
  const t = registroDeTeste({ falhas: 1 });
  await t.reg.iniciarSessao();
  assert.equal(await t.reg.garantir(), "registrado");
  assert.equal(await t.reg.garantir(), "ja-registrado");
  assert.equal(t.enviados.length, 1);
});

test("registro: nova sessão da MESMA conta registra de novo (logout pode ter removido)", async () => {
  const t = registroDeTeste();
  await t.reg.iniciarSessao();
  t.reg.esquecer();
  assert.equal(await t.reg.iniciarSessao(), "registrado");
  assert.equal(t.enviados.length, 2);
});

test("registro: troca de conta durante o POST registra para a conta nova", async () => {
  let usuario: string | null = "A";
  const enviados: string[] = [];
  const d = adiavel<void>();
  let primeira = true;
  const reg = criarRegistroPush({
    usuario: () => usuario,
    obterToken: async () => "ExponentPushToken[T]",
    enviar: async () => {
      enviados.push(usuario ?? "-");
      if (primeira) {
        primeira = false;
        await d.promessa;
      }
    },
  });
  const p = reg.iniciarSessao();
  await tick();
  usuario = "B"; // logout de A + login de B com o POST de A em voo
  d.resolver();
  assert.equal(await p, "registrado");
  assert.deepEqual(enviados, ["A", "B"], "o token volta para B");
});

// ═══ P1 — push de outra conta ══════════════════════════════════════════════

function efeitos(usuario: string | null, aberto: string | null = null) {
  const log: string[] = [];
  const popups: any[] = [];
  const deps = {
    usuario: () => usuario,
    chatAberto: () => (aberto ? { servicoId: aberto, atualizar: async () => void log.push("conversa") } : null),
    mostrarPopup: (p: any) => void (log.push("popup"), popups.push(p)),
    atualizarSalas: async () => (log.push("lista-atualizada"), []),
    invalidarMensagens: () => void log.push("mensagens"),
    invalidarNotificacoes: () => void log.push("sino"),
  };
  return { log, deps, popups };
}

test("push de OUTRA conta: sem popup, sem cache, sem contador", async () => {
  const e = efeitos("B");
  const r = await tratarPushRecebido(
    { title: "Josafa", body: "prévia privada", data: { type: "CHAT_NOVA_MENSAGEM", servicoId: "s", destinatarioId: "A" } },
    e.deps,
  );
  assert.equal(r, "ignorado-outra-sessao");
  assert.deepEqual(e.log, []);
});

test("push sem sessão autenticada: ignorado", async () => {
  const e = efeitos(null);
  await tratarPushRecebido({ data: { type: "SERVICO_ACEITO", destinatarioId: "A" } }, e.deps);
  assert.deepEqual(e.log, []);
});

test("push desta conta: lista atualizada + popup (mensagem) ou sino + popup (aviso)", async () => {
  const e = efeitos("A");
  await tratarPushRecebido({ title: "J", data: { type: "CHAT_NOVA_MENSAGEM", servicoId: "s", destinatarioId: "A" } }, e.deps);
  await tratarPushRecebido({ title: "X", data: { type: "SERVICO_ACEITO", servicoId: "s", destinatarioId: "A" } }, e.deps);
  assert.deepEqual(e.log, ["lista-atualizada", "popup", "sino", "popup"]);
});

test("push da conversa aberta: sem popup, conversa ANTES da lista", async () => {
  const e = efeitos("A", "s");
  await tratarPushRecebido({ data: { type: "CHAT_NOVA_MENSAGEM", servicoId: "s", destinatarioId: "A" } }, e.deps);
  assert.deepEqual(e.log, ["conversa", "mensagens"]);
});

test("backend antigo (sem destinatarioId) continua funcionando; `tipo` antigo aceito", async () => {
  assert.equal(pertenceASessao({}, "A"), true);
  const e = efeitos("A");
  await tratarPushRecebido({ data: { tipo: "CHAT_NOVA_MENSAGEM", servicoId: "s" } }, e.deps);
  assert.deepEqual(e.log, ["lista-atualizada", "popup"]);
});

test("com o app aberto, aviso de outra conta não vai para a bandeja nem toca", () => {
  assert.deepEqual(apresentacaoNoPrimeiroPlano({ destinatarioId: "A" }, "B"), {
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  });
  assert.equal(apresentacaoNoPrimeiroPlano({ destinatarioId: "A" }, "A").shouldShowList, true);
  assert.equal(apresentacaoNoPrimeiroPlano({ destinatarioId: "A" }, null).shouldShowList, false);
});
