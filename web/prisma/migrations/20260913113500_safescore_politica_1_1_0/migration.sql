-- SafeScore V2 — política 1.1.0: pesos fiéis ao ledger legado (lib/safeScore.ts).
--
-- Por que migration, e não seed: até aqui a única política vinha de
-- prisma/seed.ts, o seed de DESENVOLVIMENTO. Produção nunca teve linha nenhuma,
-- e todo applyEvent lá falhava com "nenhuma política ativa" — erro engolido
-- pelo dual-write. Política é dado que o código exige para funcionar.
--
-- Formato de `weights`: cada chave vale OU um número fixo, OU um objeto
-- {parametro: peso} para os eventos que variam por nota ou gravidade.
--   - avaliação: o parâmetro é a FAIXA de nota que o legado usa ("5"/"4"/"3" na
--     positiva, "3"/"2"/"1" na negativa), calculada em resolverPeso;
--   - denúncia: o parâmetro é a gravidade do incidente.
-- Parâmetro ausente no objeto → peso 0 (pesoDaPolitica, applyEvent.ts).
--
-- Diferenças em relação à 1.0.0 (que só existia via seed):
--   avaliacao_positiva   20        → {"5":15,"4":8,"3":0}
--   avaliacao_negativa   -30       → {"3":0,"2":-10,"1":-20}
--   servico_concluido    10        → 5
--   incidente_resolvido_favor -80  → denuncia_confirmada {BAIXA:-30, MEDIA:-80, ALTA:-150, CRITICA:-300}
--                                    (o nome antigo sugeria o contrário do que acontece)
--   (ausente)                      → denuncia_arquivada 10, no_show -25, tempo_plataforma 3
--                                    (antes caíam em delta 0 ou na chave de outro evento)
--   checkin_realizado, incidente_aberto: mantidas; nenhum código emite essas chaves hoje.
--
-- motivo_problema_seguranca e motivo_comportamento_inadequado ficam em 0 DE
-- PROPÓSITO. registrarMotivoGrave (lib/safetyMotivo.ts) emite essas chaves E,
-- no mesmo fluxo e para o mesmo serviço, DENUNCIA_CONFIRMADA com gravidade
-- ALTA (−150 em denuncia_confirmada). Qualquer peso aqui contaria a mesma
-- ocorrência duas vezes dentro do próprio V2. Mudar isso depende da decisão
-- pendente sobre a penalização automática sem revisão de admin — não é ajuste
-- de peso.
--
-- A 1.0.0 é DEPRECIADA, nunca editada nem apagada: SafeScoreEvent guarda
-- policyVersionId, e cada evento antigo precisa continuar apontando para os
-- pesos que valiam quando foi gravado. Em banco sem a 1.0.0 (produção) o
-- UPDATE não afeta nada.

UPDATE "SafeScorePolicyVersion"
SET "deprecatedAt" = CURRENT_TIMESTAMP
WHERE "version" = '1.0.0'
  AND "deprecatedAt" IS NULL;

INSERT INTO "SafeScorePolicyVersion" ("id", "version", "weights", "publishedAt")
VALUES (
  'policy_v1_1_0',
  '1.1.0',
  $pesos$
{
  "avaliacao_positiva": {"5": 15, "4": 8, "3": 0},
  "avaliacao_negativa": {"3": 0, "2": -10, "1": -20},
  "servico_concluido": 5,
  "tempo_plataforma": 3,
  "kyc_aprovado": 50,
  "kyc_rejeitado": -20,
  "denuncia_confirmada": {"BAIXA": -30, "MEDIA": -80, "ALTA": -150, "CRITICA": -300},
  "denuncia_arquivada": 10,
  "cancelamento_tardio": -15,
  "no_show": -25,
  "checkin_realizado": 5,
  "incidente_aberto": -50,
  "motivo_problema_seguranca": 0,
  "motivo_comportamento_inadequado": 0
}
  $pesos$::jsonb,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("version") DO NOTHING;
