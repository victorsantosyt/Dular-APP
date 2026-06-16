-- Reagendamento com aprovação: proposta pendente armazenada no próprio Servico.
-- Colunas opcionais (aditivas) — não afetam linhas existentes.
ALTER TABLE "Servico" ADD COLUMN "reagendamentoData" TIMESTAMP(3);
ALTER TABLE "Servico" ADD COLUMN "reagendamentoTurno" "Turno";
ALTER TABLE "Servico" ADD COLUMN "reagendamentoPor" TEXT;
ALTER TABLE "Servico" ADD COLUMN "reagendamentoEm" TIMESTAMP(3);
