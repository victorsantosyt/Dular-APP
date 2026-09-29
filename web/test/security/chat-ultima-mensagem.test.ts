import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mockPrisma, resetMockPrisma } from "./_mocks";

/**
 * Prévia da lista de conversas (GET /api/chat): a última mensagem de cada sala.
 *
 * Era `chatMessage.findMany({ distinct: ["roomId"] })`. O Prisma 7 não gera
 * DISTINCT ON: o SQL registrado num Postgres local foi
 * `SELECT ... FROM "ChatMessage" WHERE "roomId" IN (...) ORDER BY ... OFFSET`,
 * trazendo TODAS as mensagens das salas para filtrar em memória (20.000 linhas
 * com 50 salas × 400 mensagens; mediana local da rota 131,9 ms → 27,9 ms com a
 * consulta de uma linha por sala; resultado idêntico, inclusive no empate de
 * createdAt). `take: 1` por relação tem o mesmo problema.
 */

const SRC = join(import.meta.dirname, "..", "..", "src");
const ler = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("última mensagem por sala", () => {
  beforeEach(() => resetMockPrisma());

  it("a lista não usa distinct nem take por relação para a prévia", () => {
    const rota = ler("app/api/chat/route.ts");
    assert.doesNotMatch(rota, /distinct:/);
    assert.match(rota, /ultimaMensagemPorSala\(roomIds\)/);
  });

  it("o banco devolve uma linha por sala, na ordem do histórico", () => {
    const sql = ler("lib/chatSala.ts");
    const corpo = sql.slice(sql.indexOf("export async function ultimaMensagemPorSala"), sql.indexOf("/** Condição"));
    assert.match(corpo, /CROSS JOIN LATERAL/);
    assert.match(corpo, /ORDER BY c\."createdAt" DESC, c\."id" DESC\s+LIMIT 1/);
    assert.match(corpo, /unnest\(\$\{roomIds\}::text\[\]\)/, "ids vão como UM parâmetro (array), nunca interpolados no texto");
  });

  it("sem salas, não consulta o banco", async () => {
    let consultas = 0;
    (mockPrisma as any).$queryRaw = async () => {
      consultas++;
      return [];
    };
    const { ultimaMensagemPorSala } = await import("../../src/lib/chatSala");
    assert.deepEqual(await ultimaMensagemPorSala([]), []);
    assert.equal(consultas, 0);
  });

  it("passa os ids como parâmetro da consulta", async () => {
    let recebidos: unknown = null;
    (mockPrisma as any).$queryRaw = async (_sql: TemplateStringsArray, ids: unknown) => {
      recebidos = ids;
      return [];
    };
    const { ultimaMensagemPorSala } = await import("../../src/lib/chatSala");
    await ultimaMensagemPorSala(["sala-1", "sala-2"]);
    assert.deepEqual(recebidos, ["sala-1", "sala-2"]);
  });
});
