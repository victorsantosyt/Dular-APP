-- Idempotência da compra de créditos pelo Stripe.
--
-- Só ACRESCENTA: uma coluna anulável em CreditTransaction e um índice único
-- sobre ela. Nenhuma linha existente muda — os lançamentos atuais ficam com a
-- coluna nula, e o Postgres permite quantos nulos houver num índice único.
--
-- A coluna guarda o id da sessão de checkout (`cs_…`) que originou o crédito.
-- O índice único é o que impede a mesma compra de creditar duas vezes quando o
-- webhook repete a entrega, inclusive com entregas simultâneas: a segunda
-- escrita esbarra no índice e a transação inteira (saldo + lançamento) é
-- desfeita.
--
-- Reversão: o código anterior não lê a coluna, então basta voltar o código.
-- Remover, se um dia for preciso, é uma migration nova com DROP INDEX e
-- DROP COLUMN.

-- AlterTable
ALTER TABLE "CreditTransaction" ADD COLUMN "stripeCheckoutSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_stripeCheckoutSessionId_key" ON "CreditTransaction"("stripeCheckoutSessionId");
