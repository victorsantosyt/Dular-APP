-- CreateEnum
CREATE TYPE "FavoritoTipo" AS ENUM ('DIARISTA', 'MONTADOR');

-- CreateTable
CREATE TABLE "EmpregadorFavorito" (
    "id" TEXT NOT NULL,
    "empregadorUserId" TEXT NOT NULL,
    "profissionalUserId" TEXT NOT NULL,
    "tipo" "FavoritoTipo" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmpregadorFavorito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpregadorFavorito_empregadorUserId_profissionalUserId_tipo_key" ON "EmpregadorFavorito"("empregadorUserId", "profissionalUserId", "tipo");

-- CreateIndex
CREATE INDEX "EmpregadorFavorito_empregadorUserId_idx" ON "EmpregadorFavorito"("empregadorUserId");

-- CreateIndex
CREATE INDEX "EmpregadorFavorito_profissionalUserId_idx" ON "EmpregadorFavorito"("profissionalUserId");

-- AddForeignKey
ALTER TABLE "EmpregadorFavorito" ADD CONSTRAINT "EmpregadorFavorito_empregadorUserId_fkey" FOREIGN KEY ("empregadorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpregadorFavorito" ADD CONSTRAINT "EmpregadorFavorito_profissionalUserId_fkey" FOREIGN KEY ("profissionalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
