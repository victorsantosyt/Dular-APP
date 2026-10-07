-- Revisão manual de cobranças Stripe (renovação paga de assinatura substituída;
-- checkout pago sem prova de origem) e o marco de implantação a partir do qual
-- toda sessão de checkout nasce com uma StripeOperacao.

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

-- CreateIndex
CREATE UNIQUE INDEX "StripeRevisao_chave_key" ON "StripeRevisao"("chave");

-- CreateIndex
CREATE INDEX "StripeRevisao_status_createdAt_idx" ON "StripeRevisao"("status", "createdAt");

-- Marco: a migration roda no build de produção, logo antes de o código novo
-- entrar no ar. Sessão criada antes dele (pelo código anterior) não tem
-- StripeOperacao e usa a prova de legado (lib/origemDoCheckout). Em UTC, como
-- o Prisma lê TIMESTAMP sem fuso, qualquer que seja o fuso da sessão do banco.
INSERT INTO "StripeMarco" ("chave", "em") VALUES ('checkout_com_operacao', CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
ON CONFLICT ("chave") DO NOTHING;
