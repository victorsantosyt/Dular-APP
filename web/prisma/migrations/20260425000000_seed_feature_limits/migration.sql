-- Seed FeatureLimit: limites de cada plano de assinatura
--
-- FREE    → trial sem pagamento
-- BASIC   → diarista básico (até 10 serviços/mês)
-- PREMIUM → ilimitado (diarista pro_mensal/pro_anual + cliente_mensal)

INSERT INTO "FeatureLimit" (id, plan, feature, "limit", enabled) VALUES

  -- FREE: acesso restrito para quem ainda não assinou
  (gen_random_uuid()::text, 'FREE', 'SOLICITACOES_MES',   3,    true),
  (gen_random_uuid()::text, 'FREE', 'CHAT_ATIVO',         NULL, false),
  (gen_random_uuid()::text, 'FREE', 'HISTORICO_COMPLETO', NULL, false),
  (gen_random_uuid()::text, 'FREE', 'SUPORTE_PRIORITARIO',NULL, false),

  -- BASIC: diarista basico_mensal (10 serviços/mês)
  (gen_random_uuid()::text, 'BASIC', 'SOLICITACOES_MES',   10,   true),
  (gen_random_uuid()::text, 'BASIC', 'CHAT_ATIVO',         NULL, true),
  (gen_random_uuid()::text, 'BASIC', 'HISTORICO_COMPLETO', NULL, false),
  (gen_random_uuid()::text, 'BASIC', 'SUPORTE_PRIORITARIO',NULL, false),

  -- PREMIUM: ilimitado — diarista pro_mensal/pro_anual e cliente_mensal
  (gen_random_uuid()::text, 'PREMIUM', 'SOLICITACOES_MES',   NULL, true),
  (gen_random_uuid()::text, 'PREMIUM', 'CHAT_ATIVO',         NULL, true),
  (gen_random_uuid()::text, 'PREMIUM', 'HISTORICO_COMPLETO', NULL, true),
  (gen_random_uuid()::text, 'PREMIUM', 'SUPORTE_PRIORITARIO',NULL, true)

ON CONFLICT (plan, feature) DO UPDATE
  SET "limit"  = EXCLUDED."limit",
      enabled  = EXCLUDED.enabled;
