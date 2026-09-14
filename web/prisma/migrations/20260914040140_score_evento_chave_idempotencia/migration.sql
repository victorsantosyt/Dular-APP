-- ScoreEvento: o legado deixa de contar duas vezes o mesmo fato.
--
-- `chaveIdempotencia` = `${tipo}:${referenciaId ?? "sem-ref"}`, a mesma convenção
-- da chave do V2, única por SafeScore. Com ela, a segunda gravação do mesmo fato
-- (retentativa, duplo clique, duas requisições simultâneas) aborta a transação
-- do legado inteira — inclusive o score já somado.
--
-- Por que coluna, e não índice único direto em (safeScoreId, tipo, referenciaId):
--   - `referenciaId` é nulo em "sem-ref", e o Postgres trata NULLs como
--     distintos — o índice direto não barraria duplicata sem referência;
--   - o Prisma 7 não aceita campo opcional em @@unique nem índice por expressão
--     (COALESCE) no schema; ficaria fora do schema, sem proteção contra drift.
--
-- MUDANÇA DE COMPORTAMENTO, intencional: até aqui o legado somava a cada chamada
-- repetida. O banco local de desenvolvimento tem um KYC aprovado duas vezes para o
-- mesmo documento, somado +100.
--
-- O histórico NÃO é apagado nem deduplicado: linhas existentes recebem
-- `legado:<id>`, única por linha. Por isso a migration não falha em banco que já
-- tenha repetições.

ALTER TABLE "ScoreEvento" ADD COLUMN "chaveIdempotencia" TEXT;

UPDATE "ScoreEvento"
SET "chaveIdempotencia" = 'legado:' || "id"
WHERE "chaveIdempotencia" IS NULL;

ALTER TABLE "ScoreEvento" ALTER COLUMN "chaveIdempotencia" SET NOT NULL;

CREATE UNIQUE INDEX "ScoreEvento_safeScoreId_chaveIdempotencia_key" ON "ScoreEvento"("safeScoreId", "chaveIdempotencia");
