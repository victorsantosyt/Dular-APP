import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INTERVALO_MS,
  aplicarResposta,
  criarMotorDeSincronizacao,
  esperaAposFalha,
  reiniciarSincronizacao,
  sinalizarMudancaLocal,
  useSincronizacao,
} from "../src/lib/sincronizacaoConta";

/** Relógio, temporizadores e backend falsos. O "painel" muda a versão quando quiser. */
function cenario(opcoes: { conta?: string | null } = {}) {
  let agora = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const estado = { conta: opcoes.conta === undefined ? "conta-A" : opcoes.conta, ativo: true, online: true, versao: "v1", contaDaResposta: null as string | null, atraso: 0 };
  const chamadas = { consultas: 0, releituras: 0 };
  const respostasPendentes: Array<() => void> = [];
  const motor = criarMotorDeSincronizacao({
    contaAtual: () => estado.conta,
    appAtivo: () => estado.ativo,
    consultar: () => {
      chamadas.consultas++;
      const conta = estado.contaDaResposta ?? estado.conta;
      const versao = estado.versao;
      if (!estado.online) return Promise.reject(new Error("Network Error"));
      if (estado.atraso) return new Promise((r) => respostasPendentes.push(() => r({ userId: conta, versao })));
      return Promise.resolve({ userId: conta, versao });
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

test("aprovação no painel com a tela aberta: revisão sobe em até INTERVALO_MS, sem push", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  const revisaoAntes = useSincronizacao.getState().revisao;
  await c.avancar(3_000);
  c.estado.versao = "v2"; // aprovado no painel
  const mudouEm = c.agora;
  let detectadoEm: number | null = null;
  for (let s = 0; s < 40 && detectadoEm === null; s++) {
    await c.avancar(1_000);
    if (useSincronizacao.getState().revisao > revisaoAntes) detectadoEm = c.agora;
  }
  assert.ok(detectadoEm !== null, "detectou");
  assert.ok(detectadoEm! - mudouEm <= INTERVALO_MS, `levou ${detectadoEm! - mudouEm} ms`);
  assert.equal(c.chamadas.releituras, 1, "relê a conta uma vez");
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
  c.estado.versao = "v2";
  const antes = useSincronizacao.getState().revisao;
  await c.avancar(20_000);
  assert.equal(useSincronizacao.getState().revisao, antes + 1, "detectou depois da volta da rede");
  c.motor.parar();
});

test("notificação recebida ou volta do segundo plano: consulta na hora", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  const n = c.chamadas.consultas;
  await c.motor.pedir(); await c.flush();
  assert.equal(c.chamadas.consultas, n + 1);
  c.estado.ativo = false; c.motor.aoSegundoPlano();
  await c.avancar(10 * INTERVALO_MS);
  assert.equal(c.chamadas.consultas, n + 1, "nada em segundo plano");
  assert.equal(c.agendados, 0);
  c.estado.ativo = true; await c.motor.aoPrimeiroPlano(); await c.flush();
  assert.equal(c.chamadas.consultas, n + 2);
  c.motor.parar();
});

test("resposta atrasada de outra conta (troca de conta no meio) é descartada", async () => {
  const c = cenario();
  c.motor.iniciar("conta-A"); await c.flush();
  c.estado.atraso = 1;
  void c.motor.pedir();
  // troca para a conta B enquanto a consulta da A está pendente
  c.estado.conta = "conta-B";
  c.estado.atraso = 0;
  c.motor.iniciar("conta-B"); await c.flush();
  const versaoB = useSincronizacao.getState().versao;
  const revisaoB = useSincronizacao.getState().revisao;
  c.estado.contaDaResposta = "conta-A";
  c.estado.versao = "v-da-conta-A";
  c.respostasPendentes.forEach((r) => r()); await c.flush();
  assert.equal(useSincronizacao.getState().userId, "conta-B");
  assert.equal(useSincronizacao.getState().versao, versaoB, "versão da A não entra na B");
  assert.equal(useSincronizacao.getState().revisao, revisaoB);
  c.motor.parar();
});

test("sem sessão (logout, login, bootstrap): não consulta nem agenda", async () => {
  const c = cenario({ conta: null });
  c.motor.iniciar(null); await c.flush();
  await c.avancar(5 * INTERVALO_MS);
  assert.equal(c.chamadas.consultas, 0);
  assert.equal(c.agendados, 0);
});

test("ação local: as outras telas relêem na hora e o backend é consultado", () => {
  reiniciarSincronizacao("conta-A");
  const { revisao, pedido } = useSincronizacao.getState();
  sinalizarMudancaLocal();
  assert.equal(useSincronizacao.getState().revisao, revisao + 1);
  assert.equal(useSincronizacao.getState().pedido, pedido + 1);
});

test("aplicarResposta: primeira resposta só registra; outra conta ou formato inválido descartados", () => {
  reiniciarSincronizacao("A");
  assert.equal(aplicarResposta("A", "A", { userId: "A", versao: "1" }, 0), "igual");
  assert.equal(aplicarResposta("A", "A", { userId: "A", versao: "2" }, 0), "mudou");
  assert.equal(aplicarResposta("A", "B", { userId: "A", versao: "3" }, 0), "descartada");
  assert.equal(aplicarResposta("A", "A", { userId: "B", versao: "3" }, 0), "descartada");
  assert.equal(aplicarResposta("A", "A", { userId: "A" }, 0), "descartada");
  assert.equal(esperaAposFalha(1), 5_000);
  assert.equal(esperaAposFalha(9), INTERVALO_MS);
});

test("store da sessão recusa atualização de outra conta ou de depois do logout", () => {
  const fonte = readFileSync(join(import.meta.dirname, "..", "src", "stores", "authStore.ts"), "utf8");
  assert.match(fonte, /if \(resolved && \(!state\.user \|\| resolved\.id !== state\.user\.id\)\) return state;/);
});

test("telas de verificação, perfil e assinatura relêem quando a conta muda", () => {
  const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");
  for (const [arq, padrao] of [
    [["screens", "diarista", "DiaristaPerfil.tsx"], /useAoMudarConta\(\(\) => \{ void loadMe\(\); \}\)/],
    [["screens", "montador", "MontadorPerfil.tsx"], /useAoMudarConta\(\(\) => \{ void loadProfile\("silent"\); \}\)/],
    [["screens", "empregador", "EmpregadorPerfil.tsx"], /useAoMudarConta\(refetch\)/],
    [["screens", "perfil", "VerificacaoDocs.tsx"], /useAoMudarConta\(\(\) => \{ void loadStatus\(\); \}\)/],
    [["hooks", "useAssinaturaPlano.ts"], /useAoMudarConta\(\(\) => \{ void atualizar\(\); \}\)/],
  ] as const) assert.match(ler(...arq), padrao, arq.join("/"));
  assert.match(ler("hooks", "usePushNotifications.ts"), /pedirSincronizacao\(\);/);
  assert.match(readFileSync(join(import.meta.dirname, "..", "App.tsx"), "utf8"), /<SincronizacaoConta \/>/);
});
