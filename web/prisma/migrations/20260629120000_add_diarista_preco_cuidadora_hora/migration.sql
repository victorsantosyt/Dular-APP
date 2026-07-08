-- AlterTable: preço/hora da Cuidadora no perfil da diarista.
-- IF NOT EXISTS: a coluna já é criada por 20260622200000_add_diarista_precos_nichos;
-- sem isto o replay do histórico em banco novo falha com 42701.
ALTER TABLE "DiaristaProfile" ADD COLUMN IF NOT EXISTS "precoCuidadoraHora" DECIMAL(10,2);
