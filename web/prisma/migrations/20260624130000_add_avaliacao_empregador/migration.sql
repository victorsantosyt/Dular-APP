-- CreateTable
CREATE TABLE "AvaliacaoEmpregador" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "profissionalId" TEXT NOT NULL,
    "empregadorId" TEXT NOT NULL,
    "notaGeral" INTEGER NOT NULL,
    "pontualidade" INTEGER NOT NULL,
    "qualidade" INTEGER NOT NULL,
    "comunicacao" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvaliacaoEmpregador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvaliacaoEmpregador_servicoId_key" ON "AvaliacaoEmpregador"("servicoId");

-- CreateIndex
CREATE INDEX "AvaliacaoEmpregador_empregadorId_idx" ON "AvaliacaoEmpregador"("empregadorId");

-- CreateIndex
CREATE INDEX "AvaliacaoEmpregador_profissionalId_idx" ON "AvaliacaoEmpregador"("profissionalId");

-- AddForeignKey
ALTER TABLE "AvaliacaoEmpregador" ADD CONSTRAINT "AvaliacaoEmpregador_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
