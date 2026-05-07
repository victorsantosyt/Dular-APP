-- CreateEnum
CREATE TYPE "IncidenteCategoria" AS ENUM ('AGRESSAO_VERBAL', 'AGRESSAO_FISICA', 'AGRESSAO_PSICOLOGICA', 'AGRESSAO_EMOCIONAL', 'VIOLENCIA_SEXUAL', 'IMPORTUNACAO_SEXUAL', 'FURTO', 'DANO_MATERIAL', 'AMBIENTE_INSALUBRE', 'VIOLACAO_PRIVACIDADE', 'NO_SHOW', 'OUTRO');

-- CreateEnum
CREATE TYPE "IncidenteGravidade" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "IncidenteResolucao" AS ENUM ('CONFIRMADA', 'ARQUIVADA', 'EM_ANALISE', 'AGUARDANDO_EVIDENCIA');

-- CreateEnum
CREATE TYPE "ScoreEventoTipo" AS ENUM ('AVALIACAO_POSITIVA', 'AVALIACAO_NEGATIVA', 'SERVICO_CONCLUIDO', 'KYC_APROVADO', 'DENUNCIA_CONFIRMADA', 'DENUNCIA_ARQUIVADA', 'CANCELAMENTO', 'NO_SHOW', 'TEMPO_PLATAFORMA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emObservacao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "IncidentReport" ADD COLUMN "categoria" "IncidenteCategoria" NOT NULL DEFAULT 'OUTRO',
ADD COLUMN "subtipo" TEXT,
ADD COLUMN "gravidade" "IncidenteGravidade" NOT NULL DEFAULT 'MEDIA',
ADD COLUMN "resolucao" "IncidenteResolucao";

-- CreateTable
CREATE TABLE "SafeScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 500,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvento" (
    "id" TEXT NOT NULL,
    "safeScoreId" TEXT NOT NULL,
    "tipo" "ScoreEventoTipo" NOT NULL,
    "peso" INTEGER NOT NULL,
    "descricao" TEXT,
    "referenciaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafeScore_userId_key" ON "SafeScore"("userId");

-- CreateIndex
CREATE INDEX "ScoreEvento_safeScoreId_idx" ON "ScoreEvento"("safeScoreId");

-- CreateIndex
CREATE INDEX "ScoreEvento_tipo_idx" ON "ScoreEvento"("tipo");

-- CreateIndex
CREATE INDEX "ScoreEvento_referenciaId_idx" ON "ScoreEvento"("referenciaId");

-- AddForeignKey
ALTER TABLE "SafeScore" ADD CONSTRAINT "SafeScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvento" ADD CONSTRAINT "ScoreEvento_safeScoreId_fkey" FOREIGN KEY ("safeScoreId") REFERENCES "SafeScore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
