-- Novos tipos de serviço da "profissional de casa" (diarista), alinhados ao
-- fluxo de contratação do empregador: Faxineira, Lavadeira e Cuidadora.
-- (PASSA_ROUPA / Passadeira já existia no enum.)
--
-- Pricing destes nichos é "a combinar" (sem coluna de preço dedicada); a
-- oferta é controlada por DiaristaProfile.servicosOferecidos (String[]),
-- portanto não há mudança de coluna — apenas novos valores de enum.

ALTER TYPE "ServicoTipo" ADD VALUE IF NOT EXISTS 'FAXINEIRA';
ALTER TYPE "ServicoTipo" ADD VALUE IF NOT EXISTS 'LAVADEIRA';
ALTER TYPE "ServicoTipo" ADD VALUE IF NOT EXISTS 'CUIDADORA';
