-- AlterTable: valor base por categoria da diarista (passa-roupa/lavadeira/cuidadora).
-- IF NOT EXISTS: precoPassadeira/precoLavadeira já são criadas pela migration
-- 20260622200000_add_diarista_precos_nichos — sem isto, o replay do histórico
-- em banco novo (shadow DB do migrate dev e migrate deploy de produção) falha
-- com 42701 (coluna duplicada).
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoPassadeira" DECIMAL(10,2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoLavadeira" DECIMAL(10,2);
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoCuidadora" DECIMAL(10,2);
