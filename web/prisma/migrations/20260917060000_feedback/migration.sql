-- CreateEnum
CREATE TYPE "FeedbackTipo" AS ENUM ('SUGESTAO', 'PROBLEMA', 'ELOGIO', 'OUTRO');

-- CreateTable
-- Canal de opinião sobre o APP. Não confundir com Avaliacao (avalia a pessoa do
-- serviço) nem com IncidentReport (denúncia formal de conduta).
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "FeedbackTipo" NOT NULL DEFAULT 'SUGESTAO',
    "nota" INTEGER,
    "mensagem" TEXT NOT NULL,
    "origem" TEXT,
    "appVersao" TEXT,
    "plataforma" TEXT,
    "lidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "Feedback_tipo_createdAt_idx" ON "Feedback"("tipo", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- AddForeignKey
-- CASCADE, e não RESTRICT: feedback não pode segurar a exclusão de uma conta.
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
