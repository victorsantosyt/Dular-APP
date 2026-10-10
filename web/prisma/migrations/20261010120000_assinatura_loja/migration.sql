-- Compras de assinatura nas lojas (App Store / Google Play), uma linha por
-- compra e nunca apagada: o histórico do canal. Registrar a loja não toca a
-- Subscription, que segue sendo o vínculo Stripe (issue #359).
-- Aditiva: o código anterior não lê esta tabela.

-- CreateTable
CREATE TABLE "AssinaturaLoja" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "storeProductId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "compradaEm" TIMESTAMP(3) NOT NULL,
    "vigente" BOOLEAN NOT NULL,
    "renova" BOOLEAN NOT NULL,
    "expiraEm" TIMESTAMP(3),
    "verificadaEm" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaLoja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssinaturaLoja_userId_idx" ON "AssinaturaLoja"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaLoja_provider_externalId_key" ON "AssinaturaLoja"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "AssinaturaLoja" ADD CONSTRAINT "AssinaturaLoja_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

