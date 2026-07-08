/*
  Pagamento PIX (P2P empregador → profissional) + alinhamento de drift.

  1. PIX: enums PaymentStatus/PixKeyType/PaymentEventType, campos payment* no
     Servico, tabelas PaymentInfo (chave do profissional, 1:1 com User) e
     PaymentEvent (trilha de auditoria do pagamento).

  2. MontadorPerfil: o histórico de migrations criou precoBase/taxaMinima como
     INTEGER, mas o schema.prisma declara Decimal(10,2) — era o "drift falso
     positivo" que fazia todo `migrate dev` pedir reset. O cast Integer→Decimal
     é sem perda (valores são centavos inteiros; 15000 vira 15000.00) e o
     client Prisma já tipava Decimal, então nenhum código muda de comportamento.
*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('WAITING_PAYMENT', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_DISPUTED');

-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CELULAR', 'EMAIL', 'ALEATORIA');

-- CreateEnum
CREATE TYPE "PaymentEventType" AS ENUM ('PIX_GENERATED', 'PIX_COPIED', 'PAYMENT_REPORTED', 'PAYMENT_CONFIRMED', 'PAYMENT_DISPUTED');

-- AlterTable
ALTER TABLE "MontadorPerfil" ALTER COLUMN "especialidades" SET DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "precoBase" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "taxaMinima" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "paymentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentDisputedAt" TIMESTAMP(3),
ADD COLUMN     "paymentReportedAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'WAITING_PAYMENT';

-- CreateTable
CREATE TABLE "PaymentInfo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pixType" "PixKeyType" NOT NULL,
    "pixKey" TEXT NOT NULL,
    "bank" TEXT,
    "holderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "tipo" "PaymentEventType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInfo_userId_key" ON "PaymentInfo"("userId");

-- CreateIndex
CREATE INDEX "PaymentEvent_servicoId_idx" ON "PaymentEvent"("servicoId");

-- CreateIndex
CREATE INDEX "PaymentEvent_actorId_idx" ON "PaymentEvent"("actorId");

-- AddForeignKey
ALTER TABLE "PaymentInfo" ADD CONSTRAINT "PaymentInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
