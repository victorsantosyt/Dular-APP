-- Ajuste do KYC quando a decisão de um envio é revisada (lib/safeScore:
-- reconciliarKycDaVerificacao). Aditiva: o código anterior não usa o valor.
ALTER TYPE "ScoreEventoTipo" ADD VALUE 'KYC_REVISAO';
