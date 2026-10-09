-- Troca de plano na própria assinatura Stripe: "stripePlanoVersao" ordena as
-- trocas de plano (só versão maior troca o plano) e "StripeOperacao" persiste
-- cada operação iniciada na Stripe para ser retomada sem cobrar de novo.

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "stripePlanoVersao" INTEGER;

-- CreateTable
CREATE TABLE "StripeOperacao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planId" TEXT,
    "externalId" TEXT,
    "substituida" TEXT,
    "versao" INTEGER,
    "chave" TEXT NOT NULL,
    "referencia" TEXT,
    "url" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeOperacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeOperacao_chave_key" ON "StripeOperacao"("chave");

-- CreateIndex
CREATE INDEX "StripeOperacao_userId_status_idx" ON "StripeOperacao"("userId", "status");

-- CreateIndex
CREATE INDEX "StripeOperacao_externalId_idx" ON "StripeOperacao"("externalId");

-- CreateIndex
CREATE INDEX "StripeOperacao_substituida_idx" ON "StripeOperacao"("substituida");

-- CreateIndex
CREATE INDEX "StripeOperacao_status_updatedAt_idx" ON "StripeOperacao"("status", "updatedAt");
