-- AlterTable: valor base por categoria da diarista (passa-roupa/lavadeira/cuidadora).
ALTER TABLE "DiaristaProfile" ADD COLUMN "precoPassadeira" DECIMAL(10,2);
ALTER TABLE "DiaristaProfile" ADD COLUMN "precoLavadeira" DECIMAL(10,2);
ALTER TABLE "DiaristaProfile" ADD COLUMN "precoCuidadora" DECIMAL(10,2);
