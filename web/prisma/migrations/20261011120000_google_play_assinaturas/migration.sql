-- Google Play (issue #359): estado da compra na loja (plano base, estado bruto,
-- reconhecimento, encerramento definitivo, teste, substituição), auditoria das
-- notificações da loja e o token da conta gravado para as notificações chegarem
-- à conta certa. Aditiva: o código anterior não lê nada disto.

-- AlterTable
ALTER TABLE "AssinaturaLoja" ADD COLUMN     "encerradaEm" TIMESTAMP(3),
ADD COLUMN     "estadoLoja" TEXT,
ADD COLUMN     "planoBase" TEXT,
ADD COLUMN     "reconhecidaEm" TIMESTAMP(3),
ADD COLUMN     "substituidaPor" TEXT,
ADD COLUMN     "teste" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenLoja" TEXT;

-- CreateTable
CREATE TABLE "NotificacaoLoja" (
    "id" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "mensagemId" TEXT NOT NULL,
    "externalId" TEXT,
    "tipo" TEXT NOT NULL,
    "recebidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadaEm" TIMESTAMP(3),
    "erro" TEXT,

    CONSTRAINT "NotificacaoLoja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacaoLoja_provider_mensagemId_key" ON "NotificacaoLoja"("provider", "mensagemId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tokenLoja_key" ON "User"("tokenLoja");

