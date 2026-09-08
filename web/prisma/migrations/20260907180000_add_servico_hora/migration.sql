-- Horário escolhido pelo empregador ("HH:MM").
--
-- `Servico.data` guarda data-pura (meia-noite UTC) e `turno` só distingue
-- manhã/tarde. O app oferece 6 horários e mostrava "às 10:00" na confirmação,
-- mas nada disso era persistido: o profissional via apenas "Manhã".
--
-- String, não timestamp: é hora local do serviço, sem fuso associado —
-- transformá-la em DateTime reintroduziria o mesmo deslize de dia que o
-- helper parseDataServico existe para corrigir.
--
-- Idempotente e opcional: serviços anteriores ficam com NULL e as telas
-- continuam caindo no turno.
ALTER TABLE "Servico" ADD COLUMN IF NOT EXISTS "hora" TEXT;
ALTER TABLE "Servico" ADD COLUMN IF NOT EXISTS "reagendamentoHora" TEXT;
