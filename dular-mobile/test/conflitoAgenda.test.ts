import assert from "node:assert/strict";
import test from "node:test";
import { conflitosDoPedido } from "../src/lib/conflitoAgenda";
import { duracaoMaximaHoras } from "../src/lib/duracaoServico";

// Faxina leve aceita às 08:00 do dia 28 → termina até ~12:00 (máx 4h).
const aceito = { id: "a", status: "ACEITO", data: "2026-09-28T00:00:00.000Z", hora: "08:00", tipo: "FAXINA", categoria: "FAXINA_LEVE" };
const pedido = (hora: string, extra: Record<string, unknown> = {}) => ({
  id: "p",
  status: "SOLICITADO",
  data: "2026-09-28T00:00:00.000Z",
  hora,
  tipo: "FAXINA",
  categoria: "FAXINA_LEVE",
  ...extra,
});

test("pedido que cruza o horário de outro serviço é sobreposto", () => {
  const r = conflitosDoPedido(pedido("10:00"), [aceito]);
  assert.deepEqual(r, [{ id: "a", inicio: "08:00", fimEstimado: "12:00", tipo: "sobreposto" }]);
});

test("pedido logo depois do fim estimado é próximo; longe não avisa", () => {
  assert.equal(conflitosDoPedido(pedido("12:00"), [aceito])[0]?.tipo, "proximo");
  assert.equal(conflitosDoPedido(pedido("13:00"), [aceito])[0]?.tipo, "proximo");
  assert.deepEqual(conflitosDoPedido(pedido("14:00"), [aceito]), []);
});

test("outro dia, serviço não aceito ou o próprio pedido não contam", () => {
  assert.deepEqual(conflitosDoPedido(pedido("10:00", { data: "2026-09-29T00:00:00.000Z" }), [aceito]), []);
  assert.deepEqual(conflitosDoPedido(pedido("10:00"), [{ ...aceito, status: "CANCELADO" }]), []);
  assert.deepEqual(conflitosDoPedido(pedido("10:00"), [{ ...aceito, status: "SOLICITADO" }]), []);
  assert.deepEqual(conflitosDoPedido(pedido("10:00", { id: "a" }), [aceito]), []);
});

test("serviço antigo só com turno usa o início do turno", () => {
  const antigo = { ...aceito, hora: null, turno: "TARDE" };
  assert.equal(conflitosDoPedido(pedido("14:00"), [antigo])[0]?.inicio, "13:00");
});

test("dia vem do prefixo ISO, sem virar a véspera no fuso do Brasil", () => {
  assert.equal(conflitosDoPedido(pedido("10:00", { data: "2026-09-28" }), [aceito]).length, 1);
});

test("duração máxima por tipo/categoria de serviço criado", () => {
  assert.equal(duracaoMaximaHoras("FAXINA", "FAXINA_PESADA"), 8);
  assert.equal(duracaoMaximaHoras("MONTADOR", "MONTADOR_PINTURA"), 4);
  assert.equal(duracaoMaximaHoras("CUIDADORA", null), 8);
  assert.equal(duracaoMaximaHoras("FAXINA", null), null);
});
