import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { destinoDaNotificacao } from "../src/lib/destinoNotificacao";
import { decidirPushPrimeiroPlano } from "../src/lib/pushPrimeiroPlano";
import { chatAbertoAtual, definirChatAberto, limparChatAberto } from "../src/lib/chatAberto";
import { criarCacheCompartilhado } from "../src/lib/cacheCompartilhado";
import { canalOperacional, criarFallback } from "../src/lib/fallbackChat";

const SRC = join(import.meta.dirname, "..", "src");
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

// ── Navegação do popup/push ─────────────────────────────────────────────────

test("mensagem abre a conversa pelo ID DO SERVIÇO nos três perfis", () => {
  const n = { tipo: "CHAT_NOVA_MENSAGEM", titulo: "Josafa", servicoId: "svc-1" };
  assert.deepEqual(destinoDaNotificacao(n, "EMPREGADOR"), [
    "ChatAberto",
    { roomId: "svc-1", servicoId: "svc-1", nomeUsuario: "Josafa" },
  ]);
  assert.deepEqual(destinoDaNotificacao(n, "DIARISTA")?.[0], "ChatAberto");
  assert.deepEqual(destinoDaNotificacao(n, "MONTADOR"), [
    "MontadorChat",
    { roomId: "svc-1", servicoId: "svc-1", nomeUsuario: "Josafa" },
  ]);
});

test("chatRoomId nunca vira roomId; sem servicoId não navega", () => {
  const semServico = { tipo: "CHAT_NOVA_MENSAGEM", titulo: "X", servicoId: null, chatRoomId: "room-9" };
  assert.equal(destinoDaNotificacao(semServico as never, "EMPREGADOR"), null);
  const popup = ler("components/ui/NotificacaoPopup.tsx");
  assert.ok(!/roomId:\s*n\.chatRoomId/.test(popup), "o popup voltou a usar chatRoomId como roomId");
});

test("rotas de chat e de detalhe existem com esses nomes nos navegadores", () => {
  assert.match(ler("navigation/EmpregadorNavigator.tsx"), /name="ChatAberto"/);
  assert.match(ler("navigation/DiaristaNavigator.tsx"), /name="ChatAberto"/);
  assert.match(ler("navigation/MontadorNavigator.tsx"), /name="MontadorChat"/);
  assert.deepEqual(destinoDaNotificacao({ tipo: "SERVICO_ACEITO", servicoId: "s" }, "DIARISTA"), [
    "DiaristaDetalhe",
    { servicoId: "s" },
  ]);
  assert.deepEqual(destinoDaNotificacao({ tipo: "SERVICO_ACEITO", servicoId: "s" }, "MONTADOR")?.[0], "MontadorDetalheSolicitacao");
  assert.deepEqual(destinoDaNotificacao({ tipo: "SERVICO_ACEITO", servicoId: "s" }, "EMPREGADOR")?.[0], "EmpregadorDetalhe");
});

test("o push lê `type` (contrato do backend), não só `tipo`", () => {
  const hook = ler("hooks/usePushNotifications.ts");
  assert.match(hook, /data\.type \?\? data\.tipo/);
});

// ── Push em primeiro plano ──────────────────────────────────────────────────

test("mensagem de outra conversa: popup e lista atualizada", () => {
  assert.deepEqual(decidirPushPrimeiroPlano({ tipo: "CHAT_NOVA_MENSAGEM", servicoId: "a" }, "b"), {
    mostrarPopup: true,
    atualizarConversaAberta: false,
    atualizarMensagens: true,
    atualizarNotificacoes: false,
  });
  assert.equal(decidirPushPrimeiroPlano({ tipo: "CHAT_NOVA_MENSAGEM", servicoId: "a" }, null).mostrarPopup, true);
});

test("mensagem da conversa aberta: sem popup, conversa antes da lista", () => {
  assert.deepEqual(decidirPushPrimeiroPlano({ tipo: "CHAT_NOVA_MENSAGEM", servicoId: "a" }, "a"), {
    mostrarPopup: false,
    atualizarConversaAberta: true,
    atualizarMensagens: true,
    atualizarNotificacoes: false,
  });
  // A ordem conversa→lista é testada com efeitos reais em chatLoteABloqueios.
});

test("aviso que não é mensagem: popup e sino", () => {
  const a = decidirPushPrimeiroPlano({ tipo: "SERVICO_ACEITO", servicoId: "a" }, "a");
  assert.equal(a.mostrarPopup, true);
  assert.equal(a.atualizarNotificacoes, true);
  assert.equal(a.atualizarMensagens, false);
});

test("conversa aberta: limpar só a própria (foco novo não é apagado pelo blur velho)", () => {
  definirChatAberto("a", async () => {});
  definirChatAberto("b", async () => {});
  limparChatAberto("a");
  assert.equal(chatAbertoAtual()?.servicoId, "b");
  limparChatAberto("b");
  assert.equal(chatAbertoAtual(), null);
});

// ── Cache compartilhado ─────────────────────────────────────────────────────

function cacheDeTeste() {
  let chamadas = 0;
  const resolvers: Array<(v: number) => void> = [];
  let t = 0;
  const cache = criarCacheCompartilhado<number>({
    staleMs: 15000,
    vazio: () => 0,
    mensagemDeErro: () => "erro",
    agora: () => t,
    buscar: () => {
      chamadas++;
      return new Promise<number>((r) => resolvers.push(r));
    },
  });
  return {
    cache,
    get chamadas() {
      return chamadas;
    },
    responder: (v: number) => resolvers.shift()!(v),
    avancar: (ms: number) => (t += ms),
  };
}

const tick = () => new Promise((r) => setImmediate(r));

test("sem invalidar, o cache de 15 s segura a lista velha", async () => {
  const c = cacheDeTeste();
  const p = c.cache.obter();
  c.responder(1);
  await p;
  await c.cache.obter();
  assert.equal(c.chamadas, 1);
});

test("invalidar busca na hora, mesmo com cache fresco", async () => {
  const c = cacheDeTeste();
  const p = c.cache.obter();
  c.responder(1);
  await p;
  c.cache.invalidar();
  assert.equal(c.chamadas, 2);
  c.responder(2);
  await tick();
  assert.equal(c.cache.atual().valor, 2);
});

test("invalidar com busca em voo agenda UMA busca depois (sem loop)", async () => {
  const c = cacheDeTeste();
  const p = c.cache.obter(true);
  c.cache.invalidar();
  c.cache.invalidar();
  c.cache.invalidar();
  assert.equal(c.chamadas, 1, "não dispara em paralelo");
  c.responder(1);
  await p;
  await tick();
  assert.equal(c.chamadas, 2, "três invalidações viram uma busca");
  c.responder(2);
  await tick();
  await tick();
  assert.equal(c.chamadas, 2, "e não entra em loop");
  assert.equal(c.cache.atual().valor, 2);
});

test("limpar (troca de conta) apaga o que a conta anterior via", async () => {
  const c = cacheDeTeste();
  const p = c.cache.obter();
  c.responder(7);
  await p;
  c.cache.limpar();
  assert.equal(c.cache.atual().valor, null);
});

// ── Fallback da conversa aberta ─────────────────────────────────────────────

function relogio() {
  const ativos = new Map<number, () => void>();
  let seq = 0;
  return {
    agendar: (fn: () => void) => {
      ativos.set(++seq, fn);
      return seq;
    },
    cancelar: (id: unknown) => {
      ativos.delete(id as number);
    },
    tick: () => [...ativos.values()].forEach((fn) => fn()),
    get quantos() {
      return ativos.size;
    },
  };
}

test("canal operacional exige conexão, canal anexado E assinatura", () => {
  assert.equal(canalOperacional({ conexao: "connected", canal: "attached", assinado: true }), true);
  assert.equal(canalOperacional({ conexao: "connected", canal: "failed", assinado: false }), false);
  assert.equal(canalOperacional({ conexao: "connected", canal: "attached", assinado: false }), false);
  assert.equal(canalOperacional({ conexao: "disconnected", canal: "attached", assinado: true }), false);
});

test("canal falho com conexão viva: consulta a API (antes congelava)", () => {
  const r = relogio();
  let buscas = 0;
  const f = criarFallback({ intervaloMs: 8000, buscar: () => buscas++, agendar: r.agendar, cancelar: r.cancelar });
  f.atualizar(canalOperacional({ conexao: "connected", canal: "failed", assinado: false }));
  assert.equal(f.consultando, true);
  assert.equal(buscas, 1, "busca na hora ao cair");
  r.tick();
  assert.equal(buscas, 2);
});

test("um intervalo só, e desliga quando o canal volta (com busca de recuperação)", () => {
  const r = relogio();
  let buscas = 0;
  const f = criarFallback({ intervaloMs: 8000, buscar: () => buscas++, agendar: r.agendar, cancelar: r.cancelar });
  f.atualizar(false);
  f.atualizar(false);
  f.atualizar(false);
  assert.equal(r.quantos, 1, "nunca dois intervalos");
  f.atualizar(true);
  assert.equal(r.quantos, 0);
  assert.equal(buscas, 2, "1 ao cair + 1 ao voltar");
  f.atualizar(true);
  assert.equal(buscas, 2, "sem transição, sem busca");
});

test("parar (blur/desmontagem) cancela e não busca mais", () => {
  const r = relogio();
  let buscas = 0;
  const f = criarFallback({ intervaloMs: 8000, buscar: () => buscas++, agendar: r.agendar, cancelar: r.cancelar });
  f.atualizar(false);
  f.parar();
  f.atualizar(false);
  r.tick();
  assert.equal(r.quantos, 0);
  assert.equal(buscas, 1);
});

test("useChat usa o estado do canal, não só o da conexão", () => {
  const hook = ler("hooks/useChat.ts");
  assert.match(hook, /channel\.on\(onChannelState\)/);
  assert.match(hook, /channel\.off\(onChannelState\)/);
  assert.ok(!hook.includes("realtimeConnectedRef"), "o gate antigo por conexão voltou");
});

// ── Token de push no logout ─────────────────────────────────────────────────

// Desassociação no logout: testada com o coordenador em chatLoteAIntegracao.test.ts.

test("logout pedido usa sair(); limpeza de sessão zera os caches de módulo", () => {
  const store = ler("stores/authStore.ts");
  assert.match(store, /async sair\(\)[\s\S]*encerrarPushDaSessao\(\)[\s\S]*clearSession\(\)/);
  assert.match(store, /async clearSession\(\) \{[\s\S]*limparCacheMensagens\(\);[\s\S]*limparCacheNotificacoes\(\);/);
  for (const f of ["navigation/EmpregadorNavigator.tsx", "navigation/DiaristaNavigator.tsx", "screens/montador/MontadorPerfil.tsx"]) {
    assert.ok(!/void clearSession\(\)/.test(ler(f)), `${f} ainda sai sem desassociar o push`);
  }
});
