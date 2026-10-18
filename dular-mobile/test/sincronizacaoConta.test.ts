import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import vm from "node:vm";
import {
  ASSUNTOS,
  INTERVALO_MS,
  aplicarResposta,
  criarMotorDeSincronizacao,
  esperaAposFalha,
  reiniciarSincronizacao,
  sinalizarMudancaLocal,
  useSincronizacao,
  type Assunto,
} from "../src/lib/sincronizacaoConta";

type Versoes = Record<Assunto, string>;
const versoesIniciais = (): Versoes => Object.fromEntries(ASSUNTOS.map((a) => [a, `${a}-1`])) as Versoes;
const revisao = (a: Assunto) => useSincronizacao.getState().revisoes[a];

/** Relógio, temporizadores e backend falsos. O "painel" muda a versão de um assunto quando quiser. */
function cenario(opcoes: { conta?: string | null } = {}) {
  let agora = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const estado = { conta: opcoes.conta === undefined ? "conta-A" : opcoes.conta, ativo: true, online: true, versoes: versoesIniciais(), contaDaResposta: null as string | null, atraso: 0 };
  const chamadas = { consultas: 0, releituras: 0 };
  const respostasPendentes: Array<() => void> = [];
  const motor = criarMotorDeSincronizacao({
    contaAtual: () => estado.conta,
    appAtivo: () => estado.ativo,
    consultar: () => {
      chamadas.consultas++;
      const conta = estado.contaDaResposta ?? estado.conta;
      const versoes = { ...estado.versoes };
      const resposta = { userId: conta, versao: JSON.stringify(versoes), versoes };
      if (!estado.online) return Promise.reject(new Error("Network Error"));
      if (estado.atraso) return new Promise((r) => respostasPendentes.push(() => r(resposta)));
      return Promise.resolve(resposta);
    },
    aoMudar: async () => { chamadas.releituras++; },
    agora: () => agora,
    agendar: (fn, ms) => { const id = ++seq; timers.set(id, { at: agora + ms, fn }); return id; },
    cancelar: (id) => { timers.delete(id as number); },
  });
  const flush = () => new Promise((r) => setImmediate(r));
  return {
    motor, estado, chamadas, respostasPendentes, flush,
    get agora() { return agora; },
    get agendados() { return timers.size; },
    async avancar(ms: number) {
      const alvo = agora + ms;
      for (;;) {
        await flush();
        const prox = [...timers.entries()].filter(([, t]) => t.at <= alvo).sort((a, b) => a[1].at - b[1].at)[0];
        if (!prox) break;
        timers.delete(prox[0]);
        agora = prox[1].at;
        prox[1].fn();
      }
      agora = alvo;
      await flush();
    },
  };
}

test("aprovação no painel com a tela aberta: 'verificacao' sobe em até INTERVALO_MS, sem push; serviços não relêem", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  const antes = revisao("verificacao");
  const servicosAntes = revisao("servicos");
  await c.avancar(3_000);
  c.estado.versoes.verificacao = "verificacao-2"; // aprovado no painel
  const mudouEm = c.agora;
  let detectadoEm: number | null = null;
  for (let s = 0; s < 40 && detectadoEm === null; s++) {
    await c.avancar(1_000);
    if (revisao("verificacao") > antes) detectadoEm = c.agora;
  }
  assert.ok(detectadoEm !== null, "detectou");
  assert.ok(detectadoEm! - mudouEm <= INTERVALO_MS, `levou ${detectadoEm! - mudouEm} ms`);
  assert.equal(c.chamadas.releituras, 1, "relê a conta canônica uma vez");
  assert.equal(revisao("servicos"), servicosAntes, "telas de serviço não relêem");
  c.motor.parar();
});

test("solicitação nova ou mudança de status: só 'servicos' sobe e a conta canônica não é relida", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  const antes = Object.fromEntries(ASSUNTOS.map((a) => [a, revisao(a)])) as Record<Assunto, number>;
  c.estado.versoes.servicos = "servicos-2";
  await c.avancar(INTERVALO_MS);
  assert.equal(revisao("servicos"), antes.servicos + 1);
  for (const a of ASSUNTOS) if (a !== "servicos") assert.equal(revisao(a), antes[a], a);
  assert.equal(c.chamadas.releituras, 0, "/api/me não é relido por mudança de serviço");

  c.estado.versoes.avisos = "avisos-2";
  c.estado.versoes.safescore = "safescore-2";
  await c.avancar(INTERVALO_MS);
  assert.equal(revisao("avisos"), antes.avisos + 1);
  assert.equal(revisao("safescore"), antes.safescore + 1);
  assert.equal(revisao("servicos"), antes.servicos + 1, "serviço não relê de novo");
  c.motor.parar();
});

test("rede cai e volta com o app aberto: retoma sozinho (5 s, 10 s, 20 s, depois o intervalo) e detecta a mudança", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  c.estado.online = false;
  await c.avancar(INTERVALO_MS); // falha 1
  const consultasNaQueda = c.chamadas.consultas;
  await c.avancar(5_000); await c.avancar(10_000); // falhas 2 e 3
  assert.equal(c.chamadas.consultas - consultasNaQueda, 2);
  assert.equal(c.agendados, 1, "um só agendamento");
  c.estado.online = true;
  c.estado.versoes.verificacao = "verificacao-2";
  const antes = revisao("verificacao");
  await c.avancar(20_000);
  assert.equal(revisao("verificacao"), antes + 1, "detectou depois da volta da rede");
  c.motor.parar();
});

test("notificação recebida ou volta do segundo plano: consulta na hora; nada em segundo plano", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  const n = c.chamadas.consultas;
  await c.motor.pedir(); await c.flush();
  assert.equal(c.chamadas.consultas, n + 1);
  c.estado.ativo = false; c.motor.aoSegundoPlano();
  await c.avancar(10 * INTERVALO_MS);
  assert.equal(c.chamadas.consultas, n + 1, "nada em segundo plano");
  assert.equal(c.agendados, 0);
  c.estado.versoes.verificacao = "verificacao-2"; // aprovado enquanto o app estava em segundo plano
  const antes = revisao("verificacao");
  c.estado.ativo = true; await c.motor.aoPrimeiroPlano(); await c.flush();
  assert.equal(c.chamadas.consultas, n + 2);
  assert.equal(revisao("verificacao"), antes + 1, "volta do segundo plano já mostra a aprovação");
  c.motor.parar();
});

test("resposta atrasada de outra conta (troca de conta no meio) é descartada", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  c.estado.atraso = 1;
  void c.motor.pedir();
  c.estado.conta = "conta-B";
  c.estado.atraso = 0;
  c.motor.iniciar("conta-B"); await c.flush();
  const { versao: versaoB, revisoes: revisoesB } = useSincronizacao.getState();
  c.estado.contaDaResposta = "conta-A";
  c.estado.versoes.verificacao = "da-conta-A";
  c.respostasPendentes.forEach((r) => r()); await c.flush();
  assert.equal(useSincronizacao.getState().userId, "conta-B");
  assert.equal(useSincronizacao.getState().versao, versaoB, "versão da A não entra na B");
  assert.deepEqual(useSincronizacao.getState().revisoes, revisoesB);
  c.motor.parar();
});

test("sair e entrar de novo na MESMA conta: a primeira resposta da sessão nova só registra", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  c.estado.conta = null; c.motor.iniciar(null); await c.flush();
  c.estado.versoes.verificacao = "verificacao-2";
  c.estado.conta = "conta-A"; c.motor.iniciar("conta-A"); await c.flush();
  assert.equal(revisao("verificacao"), 0, "revisões zeradas e nada relido à toa");
  assert.equal(useSincronizacao.getState().versoes?.verificacao, "verificacao-2");
  c.motor.parar();
});

test("sem sessão (logout, login, bootstrap): não consulta nem agenda", async () => {
  const c = cenario({ conta: null });
  c.motor.iniciar(null); await c.flush();
  await c.avancar(5 * INTERVALO_MS);
  assert.equal(c.chamadas.consultas, 0);
  assert.equal(c.agendados, 0);
});

test("ação local: só as telas do assunto relêem na hora e o backend é consultado", () => {
  reiniciarSincronizacao("conta-A");
  const { revisoes, pedido } = useSincronizacao.getState();
  sinalizarMudancaLocal(["verificacao"]);
  assert.equal(revisao("verificacao"), revisoes.verificacao + 1);
  assert.equal(revisao("servicos"), revisoes.servicos);
  assert.equal(useSincronizacao.getState().pedido, pedido + 1);
});

test("aplicarResposta: primeira resposta só registra; devolve os assuntos que mudaram; outra conta ou formato inválido descartados", () => {
  reiniciarSincronizacao("A");
  const v1 = versoesIniciais();
  assert.deepEqual(aplicarResposta("A", "A", { userId: "A", versao: "1", versoes: v1 }, 0), []);
  assert.deepEqual(aplicarResposta("A", "A", { userId: "A", versao: "2", versoes: { ...v1, servicos: "x", avisos: "y" } }, 0), ["servicos", "avisos"]);
  assert.equal(aplicarResposta("A", "B", { userId: "A", versao: "3" }, 0), "descartada");
  assert.equal(aplicarResposta("A", "A", { userId: "B", versao: "3" }, 0), "descartada");
  assert.equal(aplicarResposta("A", "A", { userId: "A" }, 0), "descartada");
  assert.equal(esperaAposFalha(1), 5_000);
  assert.equal(esperaAposFalha(9), INTERVALO_MS);
});

/** sharedFetcher com api, sessão e sincronização falsas. */
function fetcherIsolado() {
  const require = createRequire(import.meta.url);
  const ts = require("typescript");
  const code = ts.transpileModule(readFileSync(join(import.meta.dirname, "..", "src", "api", "sharedFetcher.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sessao = { epoca: 1 };
  const sinc = { revisoes: { servicos: 0 } };
  const pendentes: Array<{ url: string; responder: (data: unknown) => void }> = [];
  let chamadas = 0;
  const mocks: Record<string, unknown> = {
    "@/lib/api": { api: { get: (url: string) => { chamadas++; return new Promise((r) => pendentes.push({ url, responder: (data) => r({ data }) })); } } },
    "@/lib/sessaoAtual": { epocaSessao: () => sessao.epoca },
    "@/lib/sincronizacaoConta": { useSincronizacao: { getState: () => sinc } },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, Date, Map, Promise, Error });
  return { f: module.exports, sessao, sinc, pendentes, get chamadas() { return chamadas; } };
}

test("cache de serviços: resposta pedida antes de sair e entrar de novo (mesma conta) não é servida nem guardada", async () => {
  const x = fetcherIsolado();
  const velha = x.f.fetchServicosMinhas();
  x.sessao.epoca += 2; // logout + login na mesma conta
  const nova = x.f.fetchServicosMinhas();
  assert.equal(x.chamadas, 2, "a sessão nova não reaproveita a busca em voo da anterior");
  x.pendentes[0].responder({ servicos: ["da-sessao-velha"] });
  await assert.rejects(velha, { name: "SessaoTrocadaError" });
  x.pendentes[1].responder({ servicos: ["da-sessao-nova"] });
  assert.deepEqual(await nova, { servicos: ["da-sessao-nova"] });
  assert.deepEqual(await x.f.fetchServicosMinhas(), { servicos: ["da-sessao-nova"] }, "cache só tem o da sessão nova");
  assert.equal(x.chamadas, 2);
});

test("cache de serviços: mudança confirmada pela sincronização faz a próxima leitura buscar de novo", async () => {
  const x = fetcherIsolado();
  const p = x.f.fetchServicosMinhas();
  x.pendentes[0].responder({ servicos: ["SOLICITADO"] });
  await p;
  assert.deepEqual(await x.f.fetchServicosMinhas(), { servicos: ["SOLICITADO"] });
  assert.equal(x.chamadas, 1, "dentro da janela, cache");
  x.sinc.revisoes.servicos++; // backend confirmou mudança
  const depois = x.f.fetchServicosMinhas();
  assert.equal(x.chamadas, 2, "não serve o cache de antes da mudança");
  x.pendentes[1].responder({ servicos: ["ACEITO"] });
  assert.deepEqual(await depois, { servicos: ["ACEITO"] });
});

test("cache de serviços: busca que saiu antes da mudança não é guardada", async () => {
  const x = fetcherIsolado();
  const antiga = x.f.fetchServicosMinhas();
  x.sinc.revisoes.servicos++;
  const nova = x.f.fetchServicosMinhas();
  assert.equal(x.chamadas, 2);
  x.pendentes[1].responder({ servicos: ["ACEITO"] });
  await nova;
  x.pendentes[0].responder({ servicos: ["SOLICITADO"] });
  await antiga;
  assert.deepEqual(await x.f.fetchServicosMinhas(), { servicos: ["ACEITO"] }, "a resposta velha não sobrescreve");
  assert.equal(x.chamadas, 2);
});

test("cache de score: troca de sessão não serve score em voo nem guardado da anterior", async () => {
  const x = fetcherIsolado();
  const velho = x.f.fetchUserScore("u1");
  x.sessao.epoca++;
  const novo = x.f.fetchUserScore("u1");
  assert.equal(x.chamadas, 2);
  x.pendentes[0].responder({ faixa: "velha" });
  await assert.rejects(velho, { name: "SessaoTrocadaError" });
  x.pendentes[1].responder({ faixa: "nova" });
  assert.deepEqual(await novo, { faixa: "nova" });
  assert.deepEqual(await x.f.fetchUserScore("u1"), { faixa: "nova" });
  assert.equal(x.chamadas, 2);
});

test("época da sessão muda em sair e entrar de novo na mesma conta", async () => {
  const s = await import("../src/lib/sessaoAtual");
  s.definirSessaoAtual("A");
  const e0 = s.epocaSessao();
  s.definirSessaoAtual("A");
  assert.equal(s.epocaSessao(), e0, "mesma sessão, mesma época");
  s.definirSessaoAtual(null);
  s.definirSessaoAtual("A");
  assert.equal(s.epocaSessao(), e0 + 2);
});

test("store da sessão recusa atualização de outra conta ou de depois do logout; logout limpa os caches", () => {
  const fonte = readFileSync(join(import.meta.dirname, "..", "src", "stores", "authStore.ts"), "utf8");
  assert.match(fonte, /if \(resolved && \(!state\.user \|\| resolved\.id !== state\.user\.id\)\) return state;/);
  const limpeza = fonte.slice(fonte.indexOf("async clearSession()"));
  assert.match(limpeza.slice(0, 600), /limparCachesCompartilhados\(\);/);
});

test("cada tela relê só o seu assunto", () => {
  const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");
  for (const [arq, padrao] of [
    [["screens", "diarista", "DiaristaPerfil.tsx"], /useAoMudarConta\(\["conta", "verificacao", "perfil", "restricoes"\], \(\) => \{ void loadMe\(\); \}\)/],
    [["screens", "montador", "MontadorPerfil.tsx"], /useAoMudarConta\(\["conta", "verificacao", "perfil", "restricoes", "safescore"\], \(\) => \{ void loadProfile\("silent"\); \}\)/],
    [["screens", "empregador", "EmpregadorPerfil.tsx"], /useAoMudarConta\(\["conta", "verificacao", "perfil", "restricoes"\], refetch\)/],
    [["screens", "perfil", "VerificacaoDocs.tsx"], /useAoMudarConta\(\["verificacao"\], \(\) => \{ void loadStatus\(\); \}\)/],
    [["hooks", "useAssinaturaPlano.ts"], /useAoMudarConta\(\["assinatura", "servicos"\], \(\) => \{ void atualizar\(\); \}\)/],
    [["hooks", "useAgendamentosDiarista.ts"], /useAoMudarConta\(\["servicos"\], \(\) => \{ void fetchAgendamentos\(true\); \}\)/],
    [["hooks", "useMontadorServicos.ts"], /useAoMudarConta\(\["servicos"\], \(\) => \{ void load\("silent"\); \}\)/],
    [["screens", "diarista", "DiaristaCarteira.tsx"], /useAoMudarConta\(\["servicos"\]/],
    [["screens", "diarista", "DiaristaDetalhe.tsx"], /useAoMudarConta\(\["servicos"\]/],
    [["screens", "empregador", "AgendamentosEmpregadorScreen.tsx"], /useAoMudarConta\(\["servicos"\]/],
    [["screens", "empregador", "HistoricoEmpregadorScreen.tsx"], /useAoMudarConta\(\["servicos"\]/],
    [["screens", "empregador", "EmpregadorDetalhe.tsx"], /useAoMudarConta\(\["servicos"\]/],
    [["hooks", "useSincronizacaoConta.ts"], /useAoMudarConta\(\["avisos"\], invalidarNotificacoes\)/],
    [["screens", "perfil", "SafeScoreScreen.tsx"], /useSafeScoreResource\(getSafeScoreOverview, ASSUNTOS_OVERVIEW\)/],
    [["screens", "empregador", "DiaristaProfileScreen.tsx"], /useAtualizacaoPeriodica\(/],
    [["screens", "empregador", "MontadorPublicProfile.tsx"], /useAtualizacaoPeriodica\(/],
  ] as const) assert.match(ler(...arq), padrao, arq.join("/"));
  assert.match(ler("hooks", "usePushNotifications.ts"), /pedirSincronizacao\(\);/);
  assert.match(readFileSync(join(import.meta.dirname, "..", "App.tsx"), "utf8"), /<SincronizacaoConta \/>/);
});
