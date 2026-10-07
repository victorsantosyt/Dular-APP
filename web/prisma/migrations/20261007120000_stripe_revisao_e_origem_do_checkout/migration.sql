-- Revisão manual de cobranças Stripe (renovação paga de assinatura substituída;
-- checkout pago sem prova de origem), presença do código que grava a operação
-- do checkout (StripeMarco) e as janelas em que o código ANTERIOR, sem essa
-- operação, pode ter criado sessões (StripeJanelaLegado). Nenhuma janela nasce
-- aqui: a migration roda antes do build e não sabe se o código novo entra no
-- ar; quem registra é o build de produção que terminou (scripts/janela-legado-checkout.mjs).

-- CreateTable
CREATE TABLE "StripeRevisao" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "userId" TEXT,
    "assinatura" TEXT,
    "substituida" TEXT,
    "faturaId" TEXT,
    "sessaoId" TEXT,
    "valor" INTEGER,
    "moeda" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeRevisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeMarco" (
    "chave" TEXT NOT NULL,
    "em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeMarco_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "StripeJanelaLegado" (
    "id" TEXT NOT NULL,
    "desde" TIMESTAMP(3),
    "ate" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeJanelaLegado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StripeRevisao_chave_key" ON "StripeRevisao"("chave");

-- CreateIndex
CREATE INDEX "StripeRevisao_status_createdAt_idx" ON "StripeRevisao"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StripeJanelaLegado_ate_idx" ON "StripeJanelaLegado"("ate");
