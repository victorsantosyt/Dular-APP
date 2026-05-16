-- DiaristaProfile T-15: alinhamento estrutural com MontadorPerfil
-- Migration aditiva, idempotente, não-destrutiva.

ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "cidade" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "estado" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "cidadeAtual" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "estadoAtual" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "bairroAtual" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "localizacaoPermitida" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "localizacaoAtualizadaEm" TIMESTAMP(3);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "atendeTodaCidade" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "raioAtendimentoKm" INTEGER;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "anosExperiencia" INTEGER;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoBabaHora" DECIMAL(10, 2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoCozinheiraBase" DECIMAL(10, 2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "taxaMinima" DECIMAL(10, 2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "cobraDeslocamento" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "valorACombinar" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "observacaoPreco" TEXT;
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "portfolioFotos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "DiaristaProfile_cidade_estado_idx" ON "DiaristaProfile" ("cidade", "estado");
