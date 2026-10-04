-- Ordem e repetição dos eventos de ciclo de vida da Stripe: "stripeBase" guarda o
-- estado do vínculo antes de qualquer evento, e "StripeEventoAssinatura" deduplica
-- por id do evento (sem FK: o evento pode chegar antes da linha de Subscription).

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "stripeBase" JSONB;

-- CreateTable
CREATE TABLE "StripeEventoAssinatura" (
    "eventId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "faturaId" TEXT,
    "fimPeriodo" TIMESTAMP(3),
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEventoAssinatura_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "StripeEventoAssinatura_externalId_idx" ON "StripeEventoAssinatura"("externalId");
