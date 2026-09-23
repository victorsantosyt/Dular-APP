import assert from "node:assert/strict";
import test from "node:test";
import { shouldShowHistoryBanner } from "../src/screens/empregador/agendamentos/historyBanner";
import type { CategoriaFiltro, StatusFiltro } from "../src/screens/empregador/agendamentos/components";

const cases: {
  label: string;
  category: CategoriaFiltro;
  status: StatusFiltro;
  visibleWithResults: boolean;
}[] = [
  { label: "Todos + Todos", category: "todas", status: "todas", visibleWithResults: false },
  { label: "Todos + Aguardando", category: "todas", status: "aguardando", visibleWithResults: false },
  { label: "Todos + Aceitas", category: "todas", status: "aceitas", visibleWithResults: true },
  { label: "Todos + Concluídas", category: "todas", status: "concluidas", visibleWithResults: false },
  { label: "Diarista + Aceitas", category: "diarista", status: "aceitas", visibleWithResults: false },
  { label: "Babá + Aceitas", category: "baba", status: "aceitas", visibleWithResults: false },
  { label: "Cozinheira + Aceitas", category: "cozinheira", status: "aceitas", visibleWithResults: false },
  { label: "Montador + Aceitas", category: "montador", status: "aceitas", visibleWithResults: false },
  { label: "Todos + Canceladas", category: "todas", status: "canceladas", visibleWithResults: false },
];

for (const scenario of cases) {
  for (const resultCount of [0, 1, 3]) {
    test(`${scenario.label}, ${resultCount} resultados: visibilidade do Histórico`, () => {
      assert.equal(
        shouldShowHistoryBanner({ category: scenario.category, status: scenario.status, resultCount }),
        resultCount === 0 ? false : scenario.visibleWithResults,
      );
    });
  }
}
