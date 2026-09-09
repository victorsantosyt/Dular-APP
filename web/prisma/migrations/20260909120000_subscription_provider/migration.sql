-- Origem da assinatura + produto da loja.
--
-- Idempotente (IF NOT EXISTS / DO block): o histórico deste projeto já quebrou
-- uma vez por migration que só rodava em banco novo. Rodar duas vezes aqui não
-- faz nada.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionProvider') THEN
    CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'APPLE', 'GOOGLE', 'MANUAL');
  END IF;
END $$;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "provider" "SubscriptionProvider" NOT NULL DEFAULT 'STRIPE';

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "storeProductId" TEXT;

-- Um mesmo id de assinatura não pode pertencer a dois usuários dentro do mesmo
-- provedor: é o que impede um recibo de loja ser reaproveitado em outra conta.
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_provider_externalId_key"
  ON "Subscription" ("provider", "externalId")
  WHERE "externalId" IS NOT NULL;
