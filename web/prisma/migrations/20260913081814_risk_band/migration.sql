-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('BAIXO', 'MEDIO', 'ALTO', 'CRITICO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "riskBand" "RiskBand";
