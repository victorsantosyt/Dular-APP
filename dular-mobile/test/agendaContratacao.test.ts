import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  diaDisponivel,
  HORARIOS,
  horarioDisponivel,
  primeiroDiaDisponivel,
  resumoAgenda,
  turnoDoHorario,
} from "../src/screens/empregador/service-flow/agendaDisponivel";
import { duracaoEstimada } from "../src/lib/duracaoServico";

// Sexta, 25/09/2026, 09:30. 0=domingo … 6=sábado, como o backend (getDay()).
const AGORA = new Date(2026, 8, 25, 9, 30);
const seg = new Date(2026, 8, 28);
const ter = new Date(2026, 8, 29);
const sab = new Date(2026, 8, 26);

// Segunda: só manhã. Terça: só tarde. Resto: nada.
const AGENDA = [
  { diaSemana: 1, turno: "MANHA", ativo: true },
  { diaSemana: 2, turno: "TARDE", ativo: true },
  { diaSemana: 3, turno: "MANHA", ativo: false },
];

test("dia fora da agenda não é oferecido; dia da agenda é", () => {
  assert.equal(diaDisponivel(seg, AGENDA, AGORA), true);
  assert.equal(diaDisponivel(ter, AGENDA, AGORA), true);
  assert.equal(diaDisponivel(sab, AGENDA, AGORA), false);
  // Registro inativo não conta.
  assert.equal(diaDisponivel(new Date(2026, 8, 30), AGENDA, AGORA), false);
});

test("horário respeita o turno do dia, com o mesmo corte do payload", () => {
  assert.equal(horarioDisponivel(seg, "10:00", AGENDA, AGORA), true);
  assert.equal(horarioDisponivel(seg, "12:00", AGENDA, AGORA), false);
  assert.equal(horarioDisponivel(ter, "10:00", AGENDA, AGORA), false);
  assert.equal(horarioDisponivel(ter, "14:00", AGENDA, AGORA), true);
  for (const h of HORARIOS) assert.equal(turnoDoHorario(h), Number(h.slice(0, 2)) < 12 ? "MANHA" : "TARDE");
  const payload = readFileSync(join(import.meta.dirname, "..", "src", "api", "empregadorApi.ts"), "utf8");
  assert.match(payload, /return hora < 12 \? "MANHA" : "TARDE";/);
});

test("sem agenda cadastrada atende sempre, mas nunca no passado", () => {
  assert.equal(diaDisponivel(sab, [], AGORA), true);
  assert.equal(diaDisponivel(new Date(2026, 8, 24), [], AGORA), false);
  // Hoje: só o que ainda não passou.
  const hoje = new Date(2026, 8, 25);
  assert.equal(horarioDisponivel(hoje, "08:00", [], AGORA), false);
  assert.equal(horarioDisponivel(hoje, "10:00", [], AGORA), true);
});

test("primeiro dia livre e resumo legível", () => {
  assert.equal(primeiroDiaDisponivel(AGENDA, AGORA)?.getDate(), 28);
  assert.equal(primeiroDiaDisponivel([{ diaSemana: 9, turno: "MANHA" }], AGORA), null);
  assert.equal(resumoAgenda(AGENDA), "segunda (manhã), terça (tarde)");
  assert.equal(resumoAgenda([]), null);
});

test("duração depende da categoria e da intensidade", () => {
  assert.equal(duracaoEstimada("diarista", "FAXINA_LEVE"), "De 3h a 4h");
  assert.equal(duracaoEstimada("diarista", "FAXINA_PESADA"), "De 7h a 8h");
  assert.notEqual(duracaoEstimada("diarista", "FAXINA_LEVE"), duracaoEstimada("diarista", "FAXINA_COMPLETA"));
  assert.equal(duracaoEstimada("baba", "BABA_NOTURNA"), "Até 10h");
  assert.equal(duracaoEstimada("montador", "MONTADOR_PINTURA"), "De 1h a 4h (varia com o serviço)");
  assert.equal(duracaoEstimada("cuidadora", null), "Até 8h");
  assert.equal(duracaoEstimada("diarista", null), null);
  const tela = readFileSync(
    join(import.meta.dirname, "..", "src", "screens", "empregador", "service-flow", "EscolherDataScreen.tsx"),
    "utf8",
  );
  assert.ok(!tela.includes("De 1h a 2h, 30 min"), "texto fixo antigo voltou");
});
