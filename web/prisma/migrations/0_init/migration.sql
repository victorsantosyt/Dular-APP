-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENTE', 'DIARISTA', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "VerificacaoStatus" AS ENUM ('PENDENTE', 'VERIFICADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "SafetyEventType" AS ENUM ('CHECKIN_OK', 'SOS_SILENT');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('ASSEDIO', 'IMPORTUNACAO', 'VIOLENCIA', 'AMEACA', 'OUTRO');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'CONFIRMADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MANHA', 'TARDE');

-- CreateEnum
CREATE TYPE "ServicoTipo" AS ENUM ('FAXINA', 'BABA', 'COZINHEIRA', 'PASSA_ROUPA');

-- CreateEnum
CREATE TYPE "ServicoCategoria" AS ENUM ('FAXINA_LEVE', 'FAXINA_PESADA', 'FAXINA_COMPLETA', 'BABA_DIURNA', 'BABA_NOTURNA', 'BABA_INTEGRAL', 'COZINHEIRA_DIARIA', 'COZINHEIRA_EVENTO', 'PASSA_ROUPA_BASICO', 'PASSA_ROUPA_COMPLETO');

-- CreateEnum
CREATE TYPE "ServicoStatus" AS ENUM ('RASCUNHO', 'SOLICITADO', 'ACEITO', 'RECUSADO', 'CANCELADO', 'EM_ANDAMENTO', 'CONCLUIDO', 'CONFIRMADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'APPLE');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'LOCATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REFUND');

-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('SOLICITACOES_MES', 'CHAT_ATIVO', 'HISTORICO_COMPLETO', 'SUPORTE_PRIORITARIO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "senhaHash" TEXT,
    "role" "UserRole",
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avatarUrl" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskTier" INTEGER NOT NULL DEFAULT 0,
    "cpf" TEXT,
    "dataNascimento" TIMESTAMP(3),
    "pushToken" TEXT,

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
    "tipo" "ServicoTipo" NOT NULL,
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
    "categoria" "ServicoCategoria",

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaristaHabilidade" (
    "id" TEXT NOT NULL,
    "diaristaId" TEXT NOT NULL,
    "tipo" "ServicoTipo" NOT NULL,
    "categoria" "ServicoCategoria",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiaristaHabilidade_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "SafetyEvent" (
    "id" TEXT NOT NULL,
    "type" "SafetyEventType" NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReport" (
    "id" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "serviceId" TEXT,
    "type" "IncidentType" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIA',
    "description" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncidentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "servicoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureLimit" (
    "id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL,
    "feature" "FeatureKey" NOT NULL,
    "limit" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeatureLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telefone_key" ON "User"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

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
CREATE INDEX "DiaristaHabilidade_tipo_categoria_idx" ON "DiaristaHabilidade"("tipo", "categoria");

-- CreateIndex
CREATE INDEX "DiaristaHabilidade_diaristaId_idx" ON "DiaristaHabilidade"("diaristaId");

-- CreateIndex
CREATE UNIQUE INDEX "DiaristaHabilidade_diaristaId_tipo_categoria_key" ON "DiaristaHabilidade"("diaristaId", "tipo", "categoria");

-- CreateIndex
CREATE INDEX "ServicoEvento_servicoId_idx" ON "ServicoEvento"("servicoId");

-- CreateIndex
CREATE INDEX "ServicoEvento_actorId_idx" ON "ServicoEvento"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_servicoId_key" ON "Avaliacao"("servicoId");

-- CreateIndex
CREATE INDEX "Avaliacao_diaristaId_idx" ON "Avaliacao"("diaristaId");

-- CreateIndex
CREATE INDEX "Avaliacao_clientId_idx" ON "Avaliacao"("clientId");

-- CreateIndex
CREATE INDEX "IncidentReport_reportedUserId_idx" ON "IncidentReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "IncidentReport_status_idx" ON "IncidentReport"("status");

-- CreateIndex
CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerId_key" ON "OAuthAccount"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoom_servicoId_key" ON "ChatRoom"("servicoId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditWallet_userId_key" ON "CreditWallet"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_walletId_idx" ON "CreditTransaction"("walletId");

-- CreateIndex
CREATE INDEX "CreditTransaction_servicoId_idx" ON "CreditTransaction"("servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureLimit_plan_feature_key" ON "FeatureLimit"("plan", "feature");

-- AddForeignKey
ALTER TABLE "DiaristaProfile" ADD CONSTRAINT "DiaristaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaristaBairro" ADD CONSTRAINT "DiaristaBairro_bairroId_fkey" FOREIGN KEY ("bairroId") REFERENCES "Bairro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaristaBairro" ADD CONSTRAINT "DiaristaBairro_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "DiaristaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disponibilidade" ADD CONSTRAINT "Disponibilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "DiaristaProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaristaHabilidade" ADD CONSTRAINT "DiaristaHabilidade_diaristaId_fkey" FOREIGN KEY ("diaristaId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoEvento" ADD CONSTRAINT "ServicoEvento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyEvent" ADD CONSTRAINT "SafetyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReport" ADD CONSTRAINT "IncidentReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "IncidentReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditWallet" ADD CONSTRAINT "CreditWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
