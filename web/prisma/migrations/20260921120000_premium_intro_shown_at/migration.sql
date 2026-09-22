-- Marca, por CONTA, que a apresentação do Premium (paywall de primeiro acesso)
-- já foi exibida. Nulo = ainda não viu.
--
-- Duas etapas, e a segunda é uma decisão de produto, não um detalhe técnico.

-- 1. A coluna. Anulável e SEM default: é o nulo que significa "ainda não viu",
--    e quem preenche é o POST /api/me/subscription/claim-intro. Um default no
--    schema marcaria toda conta nova como já vista e nenhuma apresentação
--    aconteceria jamais.
ALTER TABLE "User" ADD COLUMN "premiumIntroShownAt" TIMESTAMP(3);

-- 2. Backfill: toda conta que já existia neste instante conta como "já viu".
--
--    FIRST_LOGIN é apresentação de PRIMEIRO acesso. Sem esta etapa, a base
--    inteira fica com NULL e recebe a introdução de uma vez no primeiro
--    acesso após o deploy — gente que usa o app há meses veria uma tela de
--    boas-vindas ao Premium.
--
--    Marca TODAS, não só as do plano gratuito. O que se registra aqui é a
--    IDADE da conta, não a assinatura dela: um assinante antigo que cancelar
--    daqui a seis meses volta a ser FREE, e ainda assim não é um primeiro
--    acesso. Filtrar por plano deixaria essa porta aberta.
--
--    O WHERE é redundante logo após o ALTER — toda linha está nula neste
--    ponto. Fica escrito porque é a intenção do comando ("marcar quem não tem
--    marca") e porque torna ESTE UPDATE seguro de rodar sozinho, à mão, num
--    banco que já tenha dados na coluna: ele não sobrescreve marca feita pelo
--    claim. A migration inteira não é reexecutável — o ALTER acusa
--    `column already exists` —, e não precisa ser: o Prisma Migrate aplica
--    cada migration uma única vez.
UPDATE "User"
SET "premiumIntroShownAt" = CURRENT_TIMESTAMP
WHERE "premiumIntroShownAt" IS NULL;
