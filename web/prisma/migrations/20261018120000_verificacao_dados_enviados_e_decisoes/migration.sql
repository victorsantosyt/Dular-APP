-- Verificação documental: fotografia dos dados enviados em cada submissão,
-- decisão vigente com motivo mostrado à pessoa, histórico de decisões
-- (inclusive revisões) e nome completo separado do nome de exibição.
-- Aditiva: o código anterior não lê nada disto.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nomeCompleto" TEXT;

-- AlterTable
ALTER TABLE "DocumentVerification" ADD COLUMN     "dadosEnviados" JSONB,
ADD COLUMN     "decididoEm" TIMESTAMP(3),
ADD COLUMN     "decisao" TEXT,
ADD COLUMN     "motivoUsuario" TEXT;

-- CreateTable
CREATE TABLE "DecisaoVerificacao" (
    "id" TEXT NOT NULL,
    "verificacaoId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "de" "DocumentVerificationStatus" NOT NULL,
    "para" "DocumentVerificationStatus" NOT NULL,
    "decisao" TEXT NOT NULL,
    "revisao" BOOLEAN NOT NULL DEFAULT false,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisaoVerificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisaoVerificacao_verificacaoId_createdAt_idx" ON "DecisaoVerificacao"("verificacaoId", "createdAt");

-- AddForeignKey
ALTER TABLE "DecisaoVerificacao" ADD CONSTRAINT "DecisaoVerificacao_verificacaoId_fkey" FOREIGN KEY ("verificacaoId") REFERENCES "DocumentVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

