-- Add current-location fields used as user-confirmed regional suggestions.
ALTER TABLE "EmpregadorPerfil"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "cidadeAtual" TEXT,
  ADD COLUMN "estadoAtual" TEXT,
  ADD COLUMN "bairroAtual" TEXT,
  ADD COLUMN "localizacaoPermitida" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "localizacaoAtualizadaEm" TIMESTAMP(3);

ALTER TABLE "MontadorPerfil"
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "cidadeAtual" TEXT,
  ADD COLUMN "estadoAtual" TEXT,
  ADD COLUMN "bairroAtual" TEXT,
  ADD COLUMN "localizacaoPermitida" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "localizacaoAtualizadaEm" TIMESTAMP(3),
  ADD COLUMN "atendeTodaCidade" BOOLEAN NOT NULL DEFAULT false;
