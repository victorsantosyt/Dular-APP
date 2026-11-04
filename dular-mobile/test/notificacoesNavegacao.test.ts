import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { destinoDaNotificacao } from "../src/lib/destinoNotificacao";
import { criarAbridorDeNotificacao, rotaNoEstado, TENTATIVAS_MAXIMAS } from "../src/lib/abrirNotificacao";
import { faixaDoAviso } from "../src/lib/avisoVerificacao";

const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");
const PAPEIS = ["EMPREGADOR", "DIARISTA", "MONTADOR"] as const;

test("aviso de verificação leva à tela de Verificação nos três perfis, com o id do aviso", () => {
  for (const papel of PAPEIS) {
    for (const tipo of ["VERIFICACAO_APROVADA", "VERIFICACAO_REPROVADA"]) {
      assert.deepEqual(destinoDaNotificacao({ tipo, id: "n1" }, papel), ["VerificacaoDocs", { notificacaoId: "n1" }]);
    }
  }
});

test("destino só pela tabela: campo de rota no payload não leva a lugar nenhum", () => {
  const forjado = { tipo: "SISTEMA", rota: "Paywall", screen: "ExcluirConta" } as never;
  for (const papel of PAPEIS) assert.equal(destinoDaNotificacao(forjado, papel), null);
  assert.equal(destinoDaNotificacao({ tipo: "VERIFICACAO_APROVADA", id: "n1" }, null), null, "sem sessão não há destino");
});

test("serviço e pedido novo do montador: rotas tipadas, a aba aninhada pelo container", () => {
  assert.deepEqual(destinoDaNotificacao({ tipo: "PAGAMENTO_INFORMADO", servicoId: "s1" }, "DIARISTA"), ["DiaristaDetalhe", { servicoId: "s1" }]);
  assert.deepEqual(destinoDaNotificacao({ tipo: "NOVA_SOLICITACAO" }, "MONTADOR"), ["MontadorTabs", { screen: "MontadorSolicitacoes" }]);
});

function montar(opcoes: { sessao?: string | null; papel?: string; rotaPronta?: () => boolean } = {}) {
  let sessao: string | null = opcoes.sessao === undefined ? "u1" : opcoes.sessao;
  let epoca = 1;
  const lidas: string[] = [];
  const navegacoes: unknown[] = [];
  const fila: Array<() => void> = [];
  let agora = 1_000;
  const abrir = criarAbridorDeNotificacao({
    sessao: () => sessao,
    epoca: () => epoca,
    papel: () => opcoes.papel ?? "DIARISTA",
    marcarComoLida: (id) => lidas.push(id),
    rotaDisponivel: opcoes.rotaPronta ?? (() => true),
    navegar: (d) => navegacoes.push(d),
    agendar: (fn) => fila.push(fn),
    agora: () => agora,
  });
  return {
    abrir,
    lidas,
    navegacoes,
    fila,
    trocarConta: (id: string | null) => {
      sessao = id;
      epoca++;
    },
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

test("toque marca só a notificação tocada e navega", () => {
  const m = montar();
  assert.equal(m.abrir({ tipo: "VERIFICACAO_REPROVADA", id: "n-antiga" }), "navegando");
  assert.deepEqual(m.lidas, ["n-antiga"]);
  assert.deepEqual(m.navegacoes, [["VerificacaoDocs", { notificacaoId: "n-antiga" }]]);
});

test("push de outra conta: não marca nem navega", () => {
  const m = montar();
  assert.equal(m.abrir({ tipo: "VERIFICACAO_APROVADA", id: "n1", destinatarioId: "u-outra" }), "outra-sessao");
  assert.deepEqual(m.lidas, []);
  assert.deepEqual(m.navegacoes, []);
});

test("sem sessão (expirada): nada acontece", () => {
  const m = montar({ sessao: null });
  assert.equal(m.abrir({ tipo: "VERIFICACAO_APROVADA", id: "n1" }), "sem-sessao");
  assert.deepEqual(m.navegacoes, []);
});

test("toques repetidos no mesmo aviso contam uma vez; depois da janela, de novo", () => {
  const m = montar();
  m.abrir({ tipo: "SERVICO_ACEITO", servicoId: "s1", id: "n1" });
  assert.equal(m.abrir({ tipo: "SERVICO_ACEITO", servicoId: "s1", id: "n1" }), "repetido");
  assert.equal(m.navegacoes.length, 1);
  m.avancar(2_000);
  m.abrir({ tipo: "SERVICO_ACEITO", servicoId: "s1", id: "n1" });
  assert.equal(m.navegacoes.length, 2);
});

test("app iniciado pelo toque: espera a pilha do perfil e só então navega", () => {
  let pronta = false;
  const m = montar({ rotaPronta: () => pronta });
  m.abrir({ tipo: "VERIFICACAO_APROVADA", id: "n1" });
  assert.equal(m.navegacoes.length, 0);
  m.fila.shift()!();
  assert.equal(m.navegacoes.length, 0);
  pronta = true;
  m.fila.shift()!();
  assert.equal(m.navegacoes.length, 1);
});

test("conta trocada enquanto esperava: a navegação pendente é descartada", () => {
  let pronta = false;
  const m = montar({ rotaPronta: () => pronta });
  m.abrir({ tipo: "VERIFICACAO_APROVADA", id: "n1" });
  m.trocarConta("u2");
  pronta = true;
  m.fila.shift()!();
  assert.deepEqual(m.navegacoes, []);
});

test("rota que nunca fica disponível: desiste depois do limite de tentativas", () => {
  const m = montar({ rotaPronta: () => false });
  m.abrir({ tipo: "VERIFICACAO_APROVADA", id: "n1" });
  let rodadas = 0;
  while (m.fila.length && rodadas < TENTATIVAS_MAXIMAS + 5) {
    m.fila.shift()!();
    rodadas++;
  }
  assert.equal(rodadas, TENTATIVAS_MAXIMAS);
  assert.deepEqual(m.navegacoes, []);
});

test("aviso informativo: marca como lido e devolve 'informativo' (a lista abre a própria apresentação)", () => {
  const m = montar();
  assert.equal(m.abrir({ tipo: "SISTEMA", id: "n9" }), "informativo");
  assert.deepEqual(m.lidas, ["n9"]);
  assert.deepEqual(m.navegacoes, []);
});

test("rotaNoEstado encontra rota em navegador aninhado", () => {
  const estado = { routeNames: ["Login"], routes: [{ state: { routeNames: ["DiaristaTabs", "VerificacaoDocs"] } }] };
  assert.equal(rotaNoEstado(estado, "VerificacaoDocs"), true);
  assert.equal(rotaNoEstado(estado, "MontadorChat"), false);
  assert.equal(rotaNoEstado(undefined, "VerificacaoDocs"), false);
});

test("faixa de aviso histórico nunca instrui reenvio; decisão vigente não tem faixa", () => {
  for (const r of ["ENVIO_ANTERIOR", "SUPERADA", "INDETERMINADA"] as const) {
    const t = faixaDoAviso(r)!;
    assert.ok(t.includes("situação abaixo"), r);
    assert.doesNotMatch(t, /envie|reenvi|novo envio/i);
  }
  assert.equal(faixaDoAviso("VIGENTE"), null);
  assert.equal(faixaDoAviso(null), null);
});

test("lista, aviso do app e push usam o mesmo caminho; lista não abre alerta genérico", () => {
  const lista = ler("screens", "shared", "NotificacoesView.tsx");
  assert.doesNotMatch(lista, /Alert\.alert/);
  assert.match(lista, /abrirNotificacao\(/);
  assert.doesNotMatch(lista, /marcarTodasComoLidas\(\)[^\n]*\n[^\n]*openNotification/);
  const push = ler("hooks", "usePushNotifications.ts");
  assert.match(push, /addNotificationResponseReceivedListener\(tratarToque\)/);
  assert.match(push, /getLastNotificationResponseAsync\(\)/);
  assert.match(push, /respostasTratadas/);
  assert.match(ler("components", "ui", "NotificacaoPopup.tsx"), /abrirNotificacao\(toque\)/);
});

test("tela de Verificação: nenhuma ação antes da leitura do backend e resposta de outra conta descartada", () => {
  const tela = ler("screens", "perfil", "VerificacaoDocs.tsx");
  assert.match(tela, /useState<"carregando" \| "ok" \| "falhou">\("carregando"\)/);
  assert.ok(tela.indexOf('estadoLido === "carregando"') < tela.indexOf('verificacao === "APROVADO" ? ('), "carregando antes dos estados com ação");
  assert.match(tela, /useAuth\.getState\(\)\.user\?\.id !== conta\) return;\n\s*setRelacaoDoAviso/);
});
