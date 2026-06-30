-- DiaristaProfile: preços dos nichos novos (Faxineira, Cuidadora, Passadeira, Lavadeira).
-- Migration aditiva, idempotente, não-destrutiva. Null = "a combinar" (comportamento atual).

ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoCuidadoraHora" DECIMAL(10, 2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoPassadeira" DECIMAL(10, 2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoLavadeira" DECIMAL(10, 2);
