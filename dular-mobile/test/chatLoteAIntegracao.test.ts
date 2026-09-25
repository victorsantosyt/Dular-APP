import assert from "node:assert/strict";
import test from "node:test";
import { criarCacheCompartilhado } from "../src/lib/cacheCompartilhado";
import { popupDeMensagem, tratarPushRecebido, type SalaResumo } from "../src/lib/pushPrimeiroPlano";
import { criarRegistroPush, RECONCILIAR_MS } from "../src/lib/registroPush";

const tick = () => new Promise((r) => setImmediate(r));
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function adiavel<T = void>() {
  let resolver!: (v: T) => void;
  let rejeitar!: (e: unknown) => void;
  const promessa = new Promise<T>((res, rej) => ((resolver = res), (rejeitar = rej)));
  return { promessa, resolver, rejeitar };
}

// ═══ Fase 1B — popup autenticado ════════════════════════════════════════════

const NEUTRO = {
  tipo: "CHAT_NOVA_MENSAGEM",
  titulo: "Nova mensagem",
  corpo: "Você recebeu uma mensagem no Dular.",
  servicoId: "s1",
  chatRoomId: "r1",
};
const sala = (ultima?: SalaResumo["ultimaMensagem"]): SalaResumo => ({
  servicoId: "s1",
  outroUsuario: { nome: "Josafa" },
  ultimaMensagem: ultima,
});

test("1B: nome e prévia vêm da lista autenticada, não do push", () => {
  const p = popupDeMensagem([sala({ texto: "Chego às 10h", senderId: "B", type: "TEXT" })], NEUTRO, "A");
  assert.equal(p.titulo, "Josafa");
  assert.equal(p.corpo, "Chego às 10h");
  assert.equal(p.servicoId, "s1");
});

test("1B: prévia longa é cortada; foto e localização não despejam conteúdo", () => {
  const longa = "x".repeat(200);
  assert.equal(popupDeMensagem([sala({ texto: longa, senderId: "B", type: "TEXT" })], NEUTRO, "A").corpo.length, 80);
  assert.equal(popupDeMensagem([sala({ texto: "data:image/jpeg;base64,AAA", senderId: "B", type: "IMAGE" })], NEUTRO, "A").corpo, "📷 Foto");
  assert.equal(popupDeMensagem([sala({ texto: '{"lat":1}', senderId: "B", type: "LOCATION" })], NEUTRO, "A").corpo, "📍 Localização");
});

test("1B: sem a conversa na lista, falha, ou última mensagem minha → texto neutro", () => {
  assert.deepEqual(popupDeMensagem(null, NEUTRO, "A"), NEUTRO);
  assert.deepEqual(popupDeMensagem([{ ...sala(), servicoId: "outra" }], NEUTRO, "A"), NEUTRO);
  const minha = popupDeMensagem([sala({ texto: "eu mandei", senderId: "A", type: "TEXT" })], NEUTRO, "A");
  assert.equal(minha.corpo, NEUTRO.corpo);
  assert.equal(minha.titulo, "Josafa");
});

function deps(usuario: { atual: string | null }, salas: () => Promise<readonly SalaResumo[] | null>) {
  const popups: any[] = [];
  return {
    popups,
    d: {
      usuario: () => usuario.atual,
      chatAberto: () => null,
      mostrarPopup: (p: any) => void popups.push(p),
      atualizarSalas: salas,
      invalidarMensagens: () => {},
      invalidarNotificacoes: () => {},
    },
  };
}

const PUSH = {
  title: "Nova mensagem",
  body: "Você recebeu uma mensagem no Dular.",
  data: { type: "CHAT_NOVA_MENSAGEM", servicoId: "s1", chatRoomId: "r1", destinatarioId: "A" },
};

test("1B: push da sessão atual → popup com dados autenticados", async () => {
  const u = { atual: "A" as string | null };
  const e = deps(u, async () => [sala({ texto: "Chego às 10h", senderId: "B", type: "TEXT" })]);
  assert.equal(await tratarPushRecebido(PUSH, e.d), "tratado");
  assert.equal(e.popups[0].titulo, "Josafa");
  assert.equal(e.popups[0].corpo, "Chego às 10h");
});

test("1B: sessão mudou durante a busca → nenhum popup (nem neutro)", async () => {
  const u = { atual: "A" as string | null };
  const busca = adiavel<readonly SalaResumo[] | null>();
  const e = deps(u, () => busca.promessa);
  const r = tratarPushRecebido(PUSH, e.d);
  u.atual = "B"; // logout de A + login de B enquanto buscava
  busca.resolver([sala({ texto: "segredo de A", senderId: "X", type: "TEXT" })]);
  assert.equal(await r, "sessao-mudou");
  assert.deepEqual(e.popups, []);
});

test("1B: push de outra conta → nem busca a lista", async () => {
  const u = { atual: "B" as string | null };
  let buscou = false;
  const e = deps(u, async () => ((buscou = true), []));
  assert.equal(await tratarPushRecebido(PUSH, e.d), "ignorado-outra-sessao");
  assert.equal(buscou, false);
  assert.deepEqual(e.popups, []);
});

test("1B: lista falhou → popup neutro, sem inventar dado", async () => {
  const u = { atual: "A" as string | null };
  const e = deps(u, async () => {
    throw new Error("rede");
  });
  await tratarPushRecebido(PUSH, e.d);
  assert.equal(e.popups[0].titulo, "Nova mensagem");
  assert.equal(e.popups[0].corpo, "Você recebeu uma mensagem no Dular.");
});

// obterAtualizado: dado posterior ao push e da mesma sessão.
function cacheControlado() {
  let usuario: string | null = "A";
  const pedidos: Array<ReturnType<typeof adiavel<string[]>>> = [];
  const cache = criarCacheCompartilhado<string[]>({
    staleMs: 15000,
    vazio: () => [],
    mensagemDeErro: () => "erro",
    chaveSessao: () => usuario,
    buscar: () => {
      const d = adiavel<string[]>();
      pedidos.push(d);
      return d.promessa;
    },
  });
  return { cache, pedidos, entrar: (u: string | null) => (usuario = u) };
}

test("1B: busca em voo anterior ao push não serve — espera e busca de novo", async () => {
  const c = cacheControlado();
  void c.cache.obter(true); // busca que saiu ANTES do push
  const atualizado = c.cache.obterAtualizado();
  c.pedidos[0].resolver(["sem-a-mensagem-nova"]);
  await tick();
  assert.equal(c.pedidos.length, 2, "uma busca nova depois da antiga");
  c.pedidos[1].resolver(["com-a-mensagem-nova"]);
  assert.deepEqual((await atualizado)?.valor, ["com-a-mensagem-nova"]);
});

test("1B: cache fresco NÃO é usado (sempre busca)", async () => {
  const c = cacheControlado();
  const p = c.cache.obter(true);
  c.pedidos[0].resolver(["velho"]);
  await p;
  const atualizado = c.cache.obterAtualizado();
  await tick();
  assert.equal(c.pedidos.length, 2);
  c.pedidos[1].resolver(["novo"]);
  assert.deepEqual((await atualizado)?.valor, ["novo"]);
});

test("1B: logout durante a busca → null (nada de A chega à sessão B)", async () => {
  const c = cacheControlado();
  const atualizado = c.cache.obterAtualizado();
  await tick();
  c.cache.limpar();
  c.entrar("B");
  c.pedidos[0].resolver(["salas-de-A"]);
  assert.equal(await atualizado, null);
  assert.equal(c.cache.atual().valor, null);
});

// ═══ Fase 1C — ciclo de vida do token ═══════════════════════════════════════

const T = "ExponentPushToken[aparelho]";

/**
 * Servidor falso com a MESMA regra da rota /api/me/push-token:
 * POST associa a quem chama e tira de qualquer outra conta; DELETE só remove
 * se o token guardado for este. Cada pedido pode ser "segurado" (latência) e
 * pode ser processado mesmo depois de o app ter desistido (timeout).
 */
function mundo() {
  const banco = new Map<string, string | null>([["A", null], ["B", null], ["C", null]]);
  let sessao: string | null = null;
  let agora = 0;
  const log: string[] = [];
  const segurados: Array<{ op: string; quem: string; solta: () => void }> = [];
  let segurarProximoPost = false;
  let timeoutProximoPost = false;
  const atrasadosNoServidor: Array<() => void> = [];
  let rede = true;

  const processarPost = (quem: string) => {
    for (const [id, tk] of banco) if (id !== quem && tk === T) banco.set(id, null);
    banco.set(quem, T);
    log.push(`POST:${quem}`);
  };
  const processarDelete = (quem: string) => {
    if (banco.get(quem) === T) banco.set(quem, null);
    log.push(`DELETE:${quem}`);
  };

  const reg = criarRegistroPush({
    usuario: () => sessao,
    obterToken: async () => T,
    agora: () => agora,
    agendar: () => 0,
    cancelar: () => {},
    enviar: async () => {
      const quem = sessao!;
      if (!rede) throw new Error("sem rede");
      if (timeoutProximoPost) {
        // O app desiste (timeout do axios); o servidor processa quando quiser.
        timeoutProximoPost = false;
        atrasadosNoServidor.push(() => processarPost(quem));
        throw new Error("timeout");
      }
      if (segurarProximoPost) {
        segurarProximoPost = false;
        const d = adiavel();
        segurados.push({ op: "POST", quem, solta: () => d.resolver() });
        await d.promessa;
      }
      processarPost(quem);
    },
  });

  return {
    banco,
    log,
    reg,
    segurados,
    segurarPost: () => (segurarProximoPost = true),
    postComTimeout: () => (timeoutProximoPost = true),
    /** O servidor processa agora os POSTs que o app já tinha abandonado. */
    servidorProcessaAtrasados: () => atrasadosNoServidor.splice(0).forEach((fn) => fn()),
    semRede: () => (rede = false),
    comRede: () => (rede = true),
    entrar: (u: string | null) => (sessao = u),
    avancar: (ms: number) => (agora += ms),
    /** sair(): desassocia (com prazo curto) e limpa a sessão local. */
    sair: async (prazoMs = 60) => {
      const quem = sessao!;
      const r = await reg.desassociar(async () => {
        if (!rede) throw new Error("sem rede");
        processarDelete(quem);
      }, prazoMs);
      sessao = null;
      reg.esquecer();
      return r;
    },
  };
}

test("1C: POST de A termina dentro da espera (≤ metade do prazo) + logout → DELETE depois dele; token NÃO volta para A", async () => {
  const m = mundo();
  m.entrar("A");
  m.segurarPost();
  const reg = m.reg.iniciarSessao();
  await tick();
  const saida = m.sair(200);
  await tick();
  assert.deepEqual(m.log, [], "o DELETE espera o POST em voo");
  m.segurados[0].solta();
  assert.equal(await saida, "removido");
  await reg;
  assert.deepEqual(m.log, ["POST:A", "DELETE:A"]);
  assert.equal(m.banco.get("A"), null, "corrigido: antes o POST antigo reassociava");
});

test("1C: POST de A estoura o prazo e o servidor processa DEPOIS — limite documentado + reconciliação", async () => {
  const m = mundo();
  m.entrar("A");
  m.postComTimeout();
  assert.equal(await m.reg.iniciarSessao(), "falhou"); // app desistiu do POST
  await m.sair(40); // DELETE de A (nada a remover ainda no servidor)
  m.entrar("B");
  assert.equal(await m.reg.iniciarSessao(), "registrado");
  assert.equal(m.banco.get("B"), T);
  // O servidor finalmente processa o POST antigo de A (fora de ordem).
  m.servidorProcessaAtrasados();
  assert.equal(m.banco.get("A"), T, "LIMITE: o servidor aceita o POST antigo");
  // Primeiro plano antes de 10 min: nada (sem pedido redundante).
  m.avancar(RECONCILIAR_MS - 1);
  assert.equal(await m.reg.garantir(), "ja-registrado");
  assert.equal(m.banco.get("A"), T);
  // Depois de 10 min: reconcilia.
  m.avancar(2);
  assert.equal(await m.reg.garantir(), "registrado");
  assert.equal(m.banco.get("B"), T);
  assert.equal(m.banco.get("A"), null);
});

test("1C: logout sem rede → termina dentro do prazo e o logout local segue", async () => {
  const m = mundo();
  m.entrar("A");
  await m.reg.iniciarSessao();
  m.semRede();
  const inicio = Date.now();
  assert.equal(await m.sair(80), "falhou");
  assert.ok(Date.now() - inicio < 1000, "não fica preso na rede");
  assert.equal(m.banco.get("A"), T, "LIMITE: sem rede o servidor não sabe do logout");
  // Próximo login (rede de volta) move o token.
  m.comRede();
  m.entrar("C");
  await m.reg.iniciarSessao();
  assert.equal(m.banco.get("C"), T);
  assert.equal(m.banco.get("A"), null);
});

test("1C: DELETE sem resposta (pendura) também respeita o prazo", async () => {
  const reg = criarRegistroPush({
    usuario: () => "A",
    obterToken: async () => T,
    enviar: async () => {},
    agendar: () => 0,
    cancelar: () => {},
  });
  await reg.iniciarSessao();
  const inicio = Date.now();
  assert.equal(await reg.desassociar(() => new Promise(() => {}), 50), "falhou");
  assert.ok(Date.now() - inicio < 1000);
});

test("1C: login de B durante a saída de A → POST de B só depois do DELETE de A", async () => {
  const m = mundo();
  m.entrar("A");
  await m.reg.iniciarSessao();
  const d = adiavel();
  const saida = m.reg.desassociar(async () => {
    await d.promessa;
    m.log.push("DELETE:A");
  }, 500);
  m.entrar("B");
  const regB = m.reg.iniciarSessao();
  await tick();
  assert.deepEqual(m.log, ["POST:A"], "B espera a saída terminar");
  d.resolver();
  await saida;
  await regB;
  assert.deepEqual(m.log, ["POST:A", "DELETE:A", "POST:B"]);
  assert.equal(m.banco.get("B"), T);
});

test("1C: saída chamada duas vezes → um DELETE só", async () => {
  const m = mundo();
  m.entrar("A");
  await m.reg.iniciarSessao();
  let deletes = 0;
  const remover = async () => void deletes++;
  const [r1, r2] = await Promise.all([m.reg.desassociar(remover, 100), m.reg.desassociar(remover, 100)]);
  assert.equal(deletes, 1);
  assert.equal(r1, "removido");
  assert.equal(r2, "removido");
});

test("1C: depois do logout, nenhuma tentativa agendada registra de novo", async () => {
  const agendados: Array<() => void> = [];
  let sessao: string | null = "A";
  let posts = 0;
  const reg = criarRegistroPush({
    usuario: () => sessao,
    obterToken: async () => T,
    enviar: async () => {
      posts++;
      throw new Error("sem rede");
    },
    agendar: (fn) => (agendados.push(fn), agendados.length),
    cancelar: (id) => void (agendados[(id as number) - 1] = () => {}),
  });
  await reg.iniciarSessao(); // falha → agenda nova tentativa
  assert.equal(agendados.length, 1);
  await reg.desassociar(async () => {}, 50);
  sessao = null;
  agendados.forEach((fn) => fn());
  await tick();
  assert.equal(posts, 1, "a tentativa agendada foi cancelada");
});

test("1C: primeiro plano repetido em menos de 10 min não gera pedido", async () => {
  const m = mundo();
  m.entrar("A");
  await m.reg.iniciarSessao();
  for (let i = 0; i < 5; i++) {
    m.avancar(60_000);
    assert.equal(await m.reg.garantir(), "ja-registrado");
  }
  assert.deepEqual(m.log, ["POST:A"]);
  m.avancar(RECONCILIAR_MS);
  await m.reg.garantir();
  assert.deepEqual(m.log, ["POST:A", "POST:A"]);
});

test("1C: troca rápida A→B→C com POSTs segurados termina com C", async () => {
  const m = mundo();
  m.entrar("A");
  m.segurarPost();
  const ra = m.reg.iniciarSessao();
  await tick();
  const sa = m.sair(300);
  await tick();
  m.segurados[0].solta();
  await sa;
  await ra;
  m.entrar("B");
  await m.reg.iniciarSessao();
  await m.sair(300);
  m.entrar("C");
  await m.reg.iniciarSessao();
  await dormir(5);
  assert.equal(m.banco.get("C"), T);
  assert.equal(m.banco.get("A"), null);
  assert.equal(m.banco.get("B"), null);
});

test("1C: POST de A lento (além do prazo) + login de B → quando o POST de A volta, o app registra B", async () => {
  const m = mundo();
  m.entrar("A");
  m.segurarPost();
  const ra = m.reg.iniciarSessao();
  await tick();
  await m.sair(40); // não espera o POST para sempre
  m.entrar("B");
  assert.equal(await m.reg.iniciarSessao(), "em-andamento", "uma operação por vez");
  m.segurados[0].solta(); // servidor processa o POST de A e responde
  await ra;
  await dormir(5);
  assert.equal(m.banco.get("B"), T, "corrigido pelo próprio app ao ver a conta trocada");
  assert.equal(m.banco.get("A"), null);
});

test("1C LIMITE: POST de A além da espera e processado pelo servidor DEPOIS do DELETE → token volta para A", async () => {
  // Documenta o limite de 2,5 s (metade do prazo padrão de 5 s): só o
  // gerenciamento de dispositivos resolve. Com a fase 1A, o que vaza é
  // metadado (aviso neutro), não conteúdo.
  const m = mundo();
  m.entrar("A");
  m.segurarPost();
  const ra = m.reg.iniciarSessao();
  await tick();
  // "removido" = o servidor confirmou o DELETE (ResultadoSaida). Não garante
  // que o token siga desassociado.
  assert.equal(await m.sair(40), "removido");
  m.segurados[0].solta(); // servidor processa o POST de A agora
  await ra;
  await tick();
  assert.equal(m.banco.get("A"), T, "LIMITE: A fica com o token sem ninguém logado");
});
