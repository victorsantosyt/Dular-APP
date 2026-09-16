-- Status de atendimento do SOS no painel admin.
--
-- Só acrescenta: nenhuma linha existente muda. A coluna é nula e sem default de
-- propósito: check-ins não têm atendimento, e os SOS gravados antes desta
-- migration ficam nulos (o painel mostra esses SOS como ACIONADO). Quem grava
-- SOS daqui em diante preenche ACIONADO: /api/seguranca/sos e
-- registrarMotivoGrave (lib/safetyMotivo.ts).

-- CreateEnum
CREATE TYPE "SafetyEventStatus" AS ENUM ('ACIONADO', 'EM_ATENDIMENTO', 'RESOLVIDO');

-- AlterTable
ALTER TABLE "SafetyEvent" ADD COLUMN     "status" "SafetyEventStatus",
ADD COLUMN     "statusAtualizadoEm" TIMESTAMP(3),
ADD COLUMN     "statusAtualizadoPorId" TEXT;

-- CreateIndex
CREATE INDEX "SafetyEvent_type_status_createdAt_idx" ON "SafetyEvent"("type", "status", "createdAt");
