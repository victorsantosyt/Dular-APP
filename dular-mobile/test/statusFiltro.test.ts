import assert from "node:assert/strict";
import test from "node:test";
import { STATUS_FILTER_RAW, statusMatchesFilter } from "../src/screens/empregador/agendamentos/statusFiltro";
import type { CategoriaFiltro, StatusFiltro } from "../src/screens/empregador/agendamentos/components";

/**
 * Filtro de status da tela Empregador → Solicitações.
 *
 * O defeito que isto trava: "Todos" repetia o balde de "Aguardando", então os
 * dois chips eram o mesmo filtro e quem só tinha serviços aceitos abria a tela
 * e lia "Nenhum agendamento neste filtro". Reproduzido no aparelho no APK v21.
 */

/** Os dez valores de `enum ServicoStatus` (web/prisma/schema.prisma:147). */
const STATUS_REAIS = [
  "RASCUNHO",
  "SOLICITADO",
  "ACEITO",
  "RECUSADO",
  "CANCELADO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
  "CONCLUIDO",
  "CONFIRMADO",
  "FINALIZADO",
] as const;

for (const statusRaw of STATUS_REAIS) {
  test(`"Todos" aceita ${statusRaw}`, () => {
    assert.equal(statusMatchesFilter({ statusRaw }, "todas"), true);
  });
}

test('"Todos" é ausência de filtro, não uma lista escrita à mão', () => {
  // Um valor que o enum ainda não tem precisa passar. Se alguém trocar o
  // `return true` por uma união manual, este teste cai — que é o ponto.
  assert.equal(statusMatchesFilter({ statusRaw: "STATUS_QUE_AINDA_NAO_EXISTE" }, "todas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "" }, "todas"), true);
});

test("Aguardando: pendentes entram, aceito não", () => {
  assert.equal(statusMatchesFilter({ statusRaw: "RASCUNHO" }, "aguardando"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "SOLICITADO" }, "aguardando"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "ACEITO" }, "aguardando"), false);
});

test("Aceitas: ativos entram, concluído não", () => {
  assert.equal(statusMatchesFilter({ statusRaw: "ACEITO" }, "aceitas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "EM_ANDAMENTO" }, "aceitas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "AGUARDANDO_FINALIZACAO" }, "aceitas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "CONCLUIDO" }, "aceitas"), false);
});

test("Concluídas: CONCLUIDO, CONFIRMADO e FINALIZADO", () => {
  assert.equal(statusMatchesFilter({ statusRaw: "CONCLUIDO" }, "concluidas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "CONFIRMADO" }, "concluidas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "FINALIZADO" }, "concluidas"), true);
});

test("Canceladas: CANCELADO e RECUSADO", () => {
  assert.equal(statusMatchesFilter({ statusRaw: "CANCELADO" }, "canceladas"), true);
  assert.equal(statusMatchesFilter({ statusRaw: "RECUSADO" }, "canceladas"), true);
});

test("os quatro baldes particionam o enum: sem lacuna e sem sobreposição", () => {
  const baldes: Exclude<StatusFiltro, "todas">[] = ["aguardando", "aceitas", "concluidas", "canceladas"];
  for (const statusRaw of STATUS_REAIS) {
    const casados = baldes.filter((b) => statusMatchesFilter({ statusRaw }, b));
    assert.equal(casados.length, 1, `${statusRaw} casou em ${casados.length} baldes: ${casados.join(", ")}`);
  }
  // E nenhum balde carrega valor fora do enum, tirando o `PENDENTE` morto,
  // que fica documentado aqui em vez de sumir calado.
  const fora = baldes.flatMap((b) => STATUS_FILTER_RAW[b]).filter((v) => !STATUS_REAIS.includes(v as never));
  assert.deepEqual(fora, ["PENDENTE"]);
});

// ── Composição categoria + status ────────────────────────────────────────────
// A tela combina `categoriaAtiva === "todas" || item.categoriaKey === categoriaAtiva`
// com `statusMatchesFilter`. Aqui a mesma expressão, para provar que soltar o
// filtro de status não solta o de categoria.

type Linha = { categoriaKey: CategoriaFiltro; statusRaw: string };

function filtra(itens: Linha[], categoria: CategoriaFiltro, status: StatusFiltro) {
  return itens.filter(
    (item) =>
      (categoria === "todas" || item.categoriaKey === categoria) && statusMatchesFilter(item, status),
  );
}

const AMOSTRA: Linha[] = [
  { categoriaKey: "diarista", statusRaw: "ACEITO" },
  { categoriaKey: "diarista", statusRaw: "CANCELADO" },
  { categoriaKey: "montador", statusRaw: "ACEITO" },
  { categoriaKey: "baba", statusRaw: "SOLICITADO" },
  { categoriaKey: "cozinheira", statusRaw: "CONFIRMADO" },
];

test("Todos + Todos devolve tudo que foi carregado", () => {
  assert.equal(filtra(AMOSTRA, "todas", "todas").length, AMOSTRA.length);
});

test("Diarista + Todos devolve todos os status DA categoria", () => {
  const resultado = filtra(AMOSTRA, "diarista", "todas");
  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado.map((i) => i.statusRaw).sort(), ["ACEITO", "CANCELADO"]);
});

test("Montador + Todos não traz itens de outra categoria", () => {
  const resultado = filtra(AMOSTRA, "montador", "todas");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].categoriaKey, "montador");
});

test("Diarista + Aceitas segue restringindo os dois eixos", () => {
  const resultado = filtra(AMOSTRA, "diarista", "aceitas");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].statusRaw, "ACEITO");
});

test("Todos + Aceitas atravessa categorias", () => {
  assert.equal(filtra(AMOSTRA, "todas", "aceitas").length, 2);
});
