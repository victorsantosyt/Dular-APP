-- Limites de plano. Sem estas linhas o `checkFeatureAccess` libera tudo
-- (ele trata "sem registro" como sem restrição), e por isso o paywall não
-- barrava ninguém: a tabela estava vazia em dev E em produção.
--
-- SOLICITACOES_MES para o PROFISSIONAL = serviços aceitos no mês.
--   FREE    → 5   (direito do plano gratuito)
--   BASIC   → 10  (bate com a description do catálogo em lib/stripe.ts)
--   PREMIUM → NULL = ilimitado
--
-- Idempotente: ON CONFLICT no par (plan, feature), que é @@unique no schema.
INSERT INTO "FeatureLimit" ("id", "plan", "feature", "limit", "enabled")
VALUES
  ('fl_free_solicitacoes',    'FREE',    'SOLICITACOES_MES', 5,    true),
  ('fl_basic_solicitacoes',   'BASIC',   'SOLICITACOES_MES', 10,   true),
  ('fl_premium_solicitacoes', 'PREMIUM', 'SOLICITACOES_MES', NULL, true)
ON CONFLICT ("plan", "feature") DO UPDATE
  SET "limit" = EXCLUDED."limit", "enabled" = EXCLUDED."enabled";
