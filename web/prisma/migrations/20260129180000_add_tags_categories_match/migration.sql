-- CreateEnum
CREATE TYPE "ServicoTipo" AS ENUM ('FAXINA', 'BABA', 'COZINHEIRA', 'PASSA_ROUPA');

-- CreateEnum
CREATE TYPE "ServicoCategoria" AS ENUM (
  'FAXINA_LEVE',
  'FAXINA_PESADA',
  'FAXINA_COMPLETA',
  'BABA_DIURNA',
  'BABA_NOTURNA',
  'BABA_INTEGRAL',
  'COZINHEIRA_DIARIA',
  'COZINHEIRA_EVENTO',
  'PASSA_ROUPA_BASICO',
  'PASSA_ROUPA_COMPLETO'
);

-- Add column categoria (nullable)
ALTER TABLE "Servico" ADD COLUMN "categoria" "ServicoCategoria";

-- Map existing TipoFaxina -> ServicoCategoria before changing enum
UPDATE "Servico"
SET "categoria" = CASE
  WHEN "tipo" = 'LEVE' THEN 'FAXINA_LEVE'::"ServicoCategoria"
  WHEN "tipo" = 'PESADA' THEN 'FAXINA_PESADA'::"ServicoCategoria"
  ELSE NULL
END;

-- Change tipo from TipoFaxina -> ServicoTipo (set all existing to FAXINA)
ALTER TABLE "Servico"
  ALTER COLUMN "tipo" TYPE "ServicoTipo"
  USING (
    CASE
      WHEN "tipo" = 'LEVE' THEN 'FAXINA'::"ServicoTipo"
      WHEN "tipo" = 'PESADA' THEN 'FAXINA'::"ServicoTipo"
      ELSE 'FAXINA'::"ServicoTipo"
    END
  );

-- CreateTable
CREATE TABLE "DiaristaHabilidade" (
  "id" TEXT NOT NULL,
  "diaristaId" TEXT NOT NULL,
  "tipo" "ServicoTipo" NOT NULL,
  "categoria" "ServicoCategoria",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiaristaHabilidade_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "DiaristaHabilidade_diaristaId_tipo_categoria_key" ON "DiaristaHabilidade"("diaristaId", "tipo", "categoria");
CREATE INDEX "DiaristaHabilidade_tipo_categoria_idx" ON "DiaristaHabilidade"("tipo", "categoria");
CREATE INDEX "DiaristaHabilidade_diaristaId_idx" ON "DiaristaHabilidade"("diaristaId");

-- FK
ALTER TABLE "DiaristaHabilidade" ADD CONSTRAINT "DiaristaHabilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
