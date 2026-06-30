-- Normalização de precoFinal (GAP-D3) — BABA / COZINHEIRA
--
-- Contexto: precoFinal é sempre em CENTAVOS (o app exibe via /100).
-- Antes do fix, serviços de BABA/COZINHEIRA gravavam precoFinal em REAIS
-- (ex.: R$ 35 -> 35), porque precoBabaHora/precoCozinheiraBase são
-- Decimal(10,2) em reais e eram apenas arredondados (sem * 100).
-- FAXINA sempre usou precoLeve/Medio/Pesada (Int já em centavos) — NÃO tocar.
-- MONTADOR e valorACombinar têm precoFinal = 0 — ignorados pelo filtro > 0.
--
-- IMPORTANTE: esta migração é de uso ÚNICO (o sistema de migrations garante
-- que rode uma só vez por ambiente). Deve ser aplicada JUNTO com o deploy do
-- fix do backend (servicos/route.ts), antes que novos serviços sejam criados
-- com precoFinal já em centavos — caso contrário converteria valores corretos.
-- Não execute este SQL manualmente fora do `prisma migrate deploy`.

UPDATE "Servico"
SET "precoFinal" = "precoFinal" * 100
WHERE "tipo"::text IN ('BABA', 'COZINHEIRA')
  AND "precoFinal" > 0;
