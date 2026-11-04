import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atuacaoDoPerfil, resumoFranquia, subtituloMeuPlano } from "../src/lib/franquiaPlano";

const ler = (...p: string[]) => readFileSync(join(import.meta.dirname, "..", "src", ...p), "utf8");
const DEZEMBRO = { inicio: "2026-11-01T00:00:00.000Z", fim: "2026-12-01T00:00:00.000Z" };

test("atuação lista as categorias oferecidas, não conta serviços", () => {
  assert.equal(atuacaoDoPerfil(["DIARISTA"]), "Atuação: Diarista");
  assert.equal(atuacaoDoPerfil(["DIARISTA", "BABA", "DIARISTA"]), "Atuação: Diarista, Babá");
  assert.equal(atuacaoDoPerfil(["INEXISTENTE"]), null);
  assert.equal(atuacaoDoPerfil([]), null);
  assert.equal(atuacaoDoPerfil(undefined), null);
});

test("franquia: limite, uso e saldo como o servidor respondeu, com a renovação do período dele", () => {
  assert.deepEqual(resumoFranquia({ used: 1, limit: 5, periodo: DEZEMBRO }), {
    limite: 5,
    usados: 1,
    saldo: 4,
    esgotada: false,
    texto: "1 de 5 serviços aceitos · 4 restantes · renova em 01/12",
  });
});

test("saldo zero: limite atingido (e uso acima do limite não vira saldo negativo)", () => {
  const r = resumoFranquia({ used: 7, limit: 5, periodo: DEZEMBRO })!;
  assert.equal(r.saldo, 0);
  assert.equal(r.esgotada, true);
  assert.match(r.texto, /limite atingido/);
});

test("mudança de plano: o mesmo uso com limite nulo é 'sem limite' — nada fixo no app", () => {
  assert.equal(resumoFranquia({ used: 3, limit: 5, periodo: DEZEMBRO })!.saldo, 2);
  assert.deepEqual(resumoFranquia({ used: 3, limit: null }), { limite: null, usados: 3, saldo: null, esgotada: false, texto: "Sem limite de serviços aceitos" });
  assert.equal(resumoFranquia({ used: 0, limit: 10, periodo: DEZEMBRO })!.texto, "0 de 10 serviços aceitos · 10 restantes · renova em 01/12");
});

test("sem período na resposta (backend anterior): não inventa periodicidade", () => {
  const t = resumoFranquia({ used: 1, limit: 5 })!.texto;
  assert.doesNotMatch(t, /renova|mês|mensal/);
});

test("linha 'Meu plano': nome e franquia; sem dado de uso, só o nome", () => {
  assert.equal(subtituloMeuPlano("Gratuito", { used: 1, limit: 5, periodo: DEZEMBRO }, false), "Gratuito · 1 de 5 serviços aceitos · 4 restantes · renova em 01/12");
  assert.equal(subtituloMeuPlano("Pro", undefined, false), "Pro");
  assert.equal(subtituloMeuPlano(null, undefined, true), "Não foi possível consultar seu plano");
});

test("perfil não mostra mais 'Oferece N serviço' e o módulo não fixa o número da franquia", () => {
  assert.doesNotMatch(ler("screens", "diarista", "DiaristaPerfil.tsx"), /Oferece \$\{/);
  const modulo = ler("lib", "franquiaPlano.ts");
  assert.doesNotMatch(modulo, /\b5\b/);
});
