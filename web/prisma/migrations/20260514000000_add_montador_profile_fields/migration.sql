-- AlterTable
ALTER TABLE "MontadorPerfil"
ADD COLUMN "bairros" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "raioAtendimentoKm" INTEGER,
ADD COLUMN "portfolioFotos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "precoBase" INTEGER,
ADD COLUMN "taxaMinima" INTEGER,
ADD COLUMN "cobraDeslocamento" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "observacaoPreco" TEXT,
ADD COLUMN "valorACombinar" BOOLEAN NOT NULL DEFAULT true;
