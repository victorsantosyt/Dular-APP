-- Migration: add structured motivo/observacao/motivoGrave columns to ServicoEvento
-- Non-destructive: only ADD COLUMN with IF NOT EXISTS for idempotency
-- Existing rows: receive NULL for motivo/observacao and FALSE for motivoGrave

ALTER TABLE "ServicoEvento" ADD COLUMN IF NOT EXISTS "motivo" TEXT;
ALTER TABLE "ServicoEvento" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
ALTER TABLE "ServicoEvento" ADD COLUMN IF NOT EXISTS "motivoGrave" BOOLEAN NOT NULL DEFAULT FALSE;
