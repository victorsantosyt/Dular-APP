-- Vínculo explícito entre o aviso de verificação e o envio/decisão que o
-- geraram. Aditiva: colunas anuláveis, sem chave estrangeira (o servidor
-- confere a propriedade ao ler) e sem preencher avisos antigos — esses
-- continuam sem vínculo e o app os trata como contexto histórico incerto.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "verificacaoId" TEXT,
ADD COLUMN     "decisaoVerificacaoId" TEXT;
