-- AlterEnum
ALTER TYPE "ServicoTipo" ADD VALUE 'MONTADOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_MONTAGEM';
ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_REPAROS';
ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_ELETRICA';
ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_HIDRAULICA';
ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_PINTURA';
ALTER TYPE "ServicoCategoria" ADD VALUE 'MONTADOR_CARPINTARIA';

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "montadorId" TEXT,
ALTER COLUMN "diaristaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Avaliacao" ADD COLUMN     "montadorId" TEXT,
ALTER COLUMN "diaristaId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Servico_montadorId_idx" ON "Servico"("montadorId");

-- CreateIndex
CREATE INDEX "Avaliacao_montadorId_idx" ON "Avaliacao"("montadorId");

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_montadorId_fkey" FOREIGN KEY ("montadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

