-- AlterTable
ALTER TABLE "DiaristaProfile"
ADD COLUMN "servicosOferecidos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
