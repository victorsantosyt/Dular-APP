-- CreateTable
CREATE TABLE "ServicoEvento" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "fromStatus" "ServicoStatus" NOT NULL,
    "toStatus" "ServicoStatus" NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoEvento_servicoId_idx" ON "ServicoEvento"("servicoId");

-- CreateIndex
CREATE INDEX "ServicoEvento_actorId_idx" ON "ServicoEvento"("actorId");

-- AddForeignKey
ALTER TABLE "ServicoEvento" ADD CONSTRAINT "ServicoEvento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
