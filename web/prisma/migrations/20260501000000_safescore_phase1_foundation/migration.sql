-- CreateEnum
CREATE TYPE "SafeScoreTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRestrictionType" AS ENUM ('SHADOW_BAN', 'LIMIT_BOOKINGS', 'SUSPEND', 'BLOCK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "scoreAtual" DOUBLE PRECISION NOT NULL DEFAULT 500,
ALTER COLUMN "riskScore" SET DEFAULT 0,
ALTER COLUMN "riskScore" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "riskTier",
ADD COLUMN     "riskTier" "SafeScoreTier" NOT NULL DEFAULT 'BRONZE';

-- CreateTable
CREATE TABLE "SafeScoreProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tier" "SafeScoreTier" NOT NULL DEFAULT 'BRONZE',
    "lastRecalcAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafeScoreProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafeScorePolicyVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "SafeScorePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafeScoreEvent" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "scoreBefore" DOUBLE PRECISION NOT NULL,
    "scoreAfter" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "actorId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafeScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docUrl" TEXT NOT NULL,
    "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafeScoreProfile_userId_key" ON "SafeScoreProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SafeScorePolicyVersion_version_key" ON "SafeScorePolicyVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "SafeScoreEvent_idempotencyKey_key" ON "SafeScoreEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SafeScoreEvent_userId_idx" ON "SafeScoreEvent"("userId");

-- CreateIndex
CREATE INDEX "SafeScoreEvent_idempotencyKey_idx" ON "SafeScoreEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId");

-- CreateIndex
CREATE INDEX "DocumentVerification_userId_idx" ON "DocumentVerification"("userId");

-- CreateIndex
CREATE INDEX "UserRestriction_userId_idx" ON "UserRestriction"("userId");

-- AddForeignKey
ALTER TABLE "SafeScoreProfile" ADD CONSTRAINT "SafeScoreProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafeScoreEvent" ADD CONSTRAINT "SafeScoreEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "SafeScoreProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafeScoreEvent" ADD CONSTRAINT "SafeScoreEvent_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "SafeScorePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerification" ADD CONSTRAINT "DocumentVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRestriction" ADD CONSTRAINT "UserRestriction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

