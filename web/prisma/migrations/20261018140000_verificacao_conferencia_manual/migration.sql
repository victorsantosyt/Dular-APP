-- Conferência manual da verificação (documento, dados e selfie): checklist do
-- admin e categoria do motivo em cada decisão. Aditiva.

-- AlterTable
ALTER TABLE "DecisaoVerificacao" ADD COLUMN     "conferencia" JSONB,
ADD COLUMN     "motivoCategoria" TEXT;

