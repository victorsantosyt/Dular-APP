-- CreateEnum
CREATE TYPE "TipoEndereco" AS ENUM ('RESIDENCIAL', 'EMPRESARIAL');

-- CreateTable
CREATE TABLE "EnderecoUsuario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoEndereco" NOT NULL,
    "cep" TEXT NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "pontoReferencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnderecoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnderecoUsuario_userId_idx" ON "EnderecoUsuario"("userId");

-- AddForeignKey
ALTER TABLE "EnderecoUsuario" ADD CONSTRAINT "EnderecoUsuario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
