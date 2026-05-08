-- CreateEnum
CREATE TYPE "UserRole_new" AS ENUM ('EMPREGADOR', 'DIARISTA', 'MONTADOR', 'ADMIN');

-- AlterEnum
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'CLIENTE' THEN 'EMPREGADOR'
    ELSE "role"::text
  END
)::"UserRole_new";

ALTER TABLE "ServicoEvento" ALTER COLUMN "actorRole" TYPE "UserRole_new" USING (
  CASE "actorRole"::text
    WHEN 'CLIENTE' THEN 'EMPREGADOR'
    ELSE "actorRole"::text
  END
)::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "genero" "Genero";

-- AlterTable
ALTER TABLE "DiaristaProfile" ADD COLUMN "genero" "Genero";

-- CreateTable
CREATE TABLE "EmpregadorPerfil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cidade" TEXT,
    "estado" TEXT,
    "fotoPerfil" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpregadorPerfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MontadorPerfil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "especialidades" TEXT[] NOT NULL,
    "anosExperiencia" INTEGER,
    "cidade" TEXT,
    "estado" TEXT,
    "fotoPerfil" TEXT,
    "documentoFrente" TEXT,
    "documentoVerso" TEXT,
    "selfieDoc" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalServicos" INTEGER NOT NULL DEFAULT 0,
    "safeScore" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MontadorPerfil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmpregadorPerfil_userId_key" ON "EmpregadorPerfil"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MontadorPerfil_userId_key" ON "MontadorPerfil"("userId");

-- AddForeignKey
ALTER TABLE "EmpregadorPerfil" ADD CONSTRAINT "EmpregadorPerfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MontadorPerfil" ADD CONSTRAINT "MontadorPerfil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
