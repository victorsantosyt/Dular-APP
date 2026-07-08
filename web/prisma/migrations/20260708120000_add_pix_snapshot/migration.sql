-- CreateTable
CREATE TABLE "PixSnapshot" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "pixType" "PixKeyType" NOT NULL,
    "pixKey" TEXT NOT NULL,
    "bank" TEXT,
    "holderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PixSnapshot_servicoId_key" ON "PixSnapshot"("servicoId");

-- AddForeignKey
ALTER TABLE "PixSnapshot" ADD CONSTRAINT "PixSnapshot_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
