-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENTE', 'DIARISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "VerificacaoStatus" AS ENUM ('PENDENTE', 'VERIFICADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "TipoFaxina" AS ENUM ('LEVE', 'PESADA');

-- CreateEnum
CREATE TYPE "ServicoStatus" AS ENUM ('RASCUNHO', 'SOLICITADO', 'ACEITO', 'RECUSADO', 'CANCELADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CONFIRMADO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "senhaHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENTE',
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaristaProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verificacao" "VerificacaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fotoUrl" TEXT,
    "docUrl" TEXT,
    "bio" TEXT,
    "precoLeve" INTEGER NOT NULL,
    "precoPesada" INTEGER NOT NULL,
    "notaMedia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalServicos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaristaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bairro" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,

    CONSTRAINT "Bairro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaristaBairro" (
    "id" TEXT NOT NULL,
    "diaristaId" TEXT NOT NULL,
    "bairroId" TEXT NOT NULL,

    CONSTRAINT "DiaristaBairro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disponibilidade" (
    "id" TEXT NOT NULL,
    "diaristaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "turno" "Turno" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Disponibilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" TEXT NOT NULL,
    "status" "ServicoStatus" NOT NULL DEFAULT 'SOLICITADO',
    "tipo" "TipoFaxina" NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "turno" "Turno" NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "bairro" TEXT NOT NULL,
    "enderecoCompleto" TEXT,
    "observacoes" TEXT,
    "temPet" BOOLEAN NOT NULL DEFAULT false,
    "quartos3Mais" BOOLEAN NOT NULL DEFAULT false,
    "banheiros2Mais" BOOLEAN NOT NULL DEFAULT false,
    "precoFinal" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "diaristaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "diaristaId" TEXT NOT NULL,
    "notaGeral" INTEGER NOT NULL,
    "pontualidade" INTEGER NOT NULL,
    "qualidade" INTEGER NOT NULL,
    "comunicacao" INTEGER NOT NULL,
    "comentario" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telefone_key" ON "User"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DiaristaProfile_userId_key" ON "DiaristaProfile"("userId");

-- CreateIndex
CREATE INDEX "Bairro_cidade_uf_idx" ON "Bairro"("cidade", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "Bairro_nome_cidade_uf_key" ON "Bairro"("nome", "cidade", "uf");

-- CreateIndex
CREATE INDEX "DiaristaBairro_bairroId_idx" ON "DiaristaBairro"("bairroId");

-- CreateIndex
CREATE INDEX "DiaristaBairro_diaristaId_idx" ON "DiaristaBairro"("diaristaId");

-- CreateIndex
CREATE UNIQUE INDEX "DiaristaBairro_diaristaId_bairroId_key" ON "DiaristaBairro"("diaristaId", "bairroId");

-- CreateIndex
CREATE INDEX "Disponibilidade_diaristaId_idx" ON "Disponibilidade"("diaristaId");

-- CreateIndex
CREATE UNIQUE INDEX "Disponibilidade_diaristaId_diaSemana_turno_key" ON "Disponibilidade"("diaristaId", "diaSemana", "turno");

-- CreateIndex
CREATE INDEX "Servico_data_turno_idx" ON "Servico"("data", "turno");

-- CreateIndex
CREATE INDEX "Servico_status_idx" ON "Servico"("status");

-- CreateIndex
CREATE INDEX "Servico_cidade_uf_bairro_idx" ON "Servico"("cidade", "uf", "bairro");

-- CreateIndex
CREATE INDEX "Servico_diaristaId_idx" ON "Servico"("diaristaId");

-- CreateIndex
CREATE INDEX "Servico_clientId_idx" ON "Servico"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_servicoId_key" ON "Avaliacao"("servicoId");

-- CreateIndex
CREATE INDEX "Avaliacao_diaristaId_idx" ON "Avaliacao"("diaristaId");

-- CreateIndex
CREATE INDEX "Avaliacao_clientId_idx" ON "Avaliacao"("clientId");

-- AddForeignKey
ALTER TABLE "DiaristaProfile" ADD CONSTRAINT "DiaristaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaristaBairro" ADD CONSTRAINT "DiaristaBairro_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "DiaristaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaristaBairro" ADD CONSTRAINT "DiaristaBairro_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "Bairro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disponibilidade" ADD CONSTRAINT "Disponibilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "DiaristaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
