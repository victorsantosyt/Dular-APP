# Security Fase 1B — Testes Manuais/API

> Objetivo: validar rate limit, ownership checks e upload seguro sem alterar contratos mobile/backend.
>
> Use tokens e IDs de QA. Não use credenciais reais em histórico de terminal.

## Variáveis

```bash
export BASE_URL="http://localhost:3000"
export TOKEN_EMPREGADOR_A="<jwt_empregador_a>"
export TOKEN_EMPREGADOR_B="<jwt_empregador_b>"
export TOKEN_DIARISTA="<jwt_diarista>"
export TOKEN_NAO_ADMIN="<jwt_nao_admin>"
export SERVICO_A="<servico_do_empregador_a>"
export SERVICO_B="<servico_do_empregador_b>"
export USER_CONTRAPARTE="<user_id_contraparte_real_do_servico_a>"
export USER_ARBITRARIO="<user_id_fora_do_servico_a>"
```

## 1. Serviço de outro usuário deve retornar 403

```bash
curl -i -X POST "$BASE_URL/api/incidentes" \
  -H "Authorization: Bearer $TOKEN_EMPREGADOR_B" \
  -H "Content-Type: application/json" \
  -d "{\"serviceId\":\"$SERVICO_A\",\"reportedUserId\":\"$USER_CONTRAPARTE\",\"categoria\":\"OUTRO\",\"descricao\":\"teste\"}"
```

Esperado: `HTTP 403` com erro seguro.

## 2. Chat de outro serviço deve retornar 403

```bash
curl -i -X POST "$BASE_URL/api/chat/$SERVICO_A/messages" \
  -H "Authorization: Bearer $TOKEN_EMPREGADOR_B" \
  -H "Content-Type: application/json" \
  -d '{"type":"TEXT","content":"teste"}'
```

Esperado: `HTTP 403`.

## 3. Incidente com reportedUserId arbitrário deve retornar 403

```bash
curl -i -X POST "$BASE_URL/api/incidentes" \
  -H "Authorization: Bearer $TOKEN_EMPREGADOR_A" \
  -H "Content-Type: application/json" \
  -d "{\"serviceId\":\"$SERVICO_A\",\"reportedUserId\":\"$USER_ARBITRARIO\",\"categoria\":\"OUTRO\",\"descricao\":\"teste\"}"
```

Esperado: `HTTP 403`.

## 4. Não-admin acessando rota admin deve retornar 403

```bash
curl -i -X POST "$BASE_URL/api/admin/admins/promote" \
  -H "Authorization: Bearer $TOKEN_NAO_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"telefone":"65999999999"}'
```

Esperado: `HTTP 403`.

## 5. Stripe webhook sem assinatura em produção deve retornar erro

Rodar contra ambiente de staging/producao com `NODE_ENV=production` e sem `STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV=true`.

```bash
curl -i -X POST "$BASE_URL/api/webhooks/stripe" \
  -H "Content-Type: application/json" \
  -d '{"type":"checkout.session.completed","data":{"object":{}}}'
```

Esperado: `HTTP 400`, sem processar evento e sem stack trace.

## 6. Upload .jpg com conteúdo inválido deve retornar 400

```bash
printf 'not-a-real-jpeg' > /tmp/falso.jpg

curl -i -X POST "$BASE_URL/api/verificacoes" \
  -H "Authorization: Bearer $TOKEN_DIARISTA" \
  -F "docFrente=@/tmp/falso.jpg;type=image/jpeg" \
  -F "docVerso=@/tmp/falso.jpg;type=image/jpeg"
```

Esperado: `HTTP 400` com mensagem segura de arquivo inválido.

## 7. Rate limit deve retornar 429

Exemplo para checkout:

```bash
for i in $(seq 1 7); do
  curl -i -X POST "$BASE_URL/api/billing/checkout" \
    -H "Authorization: Bearer $TOKEN_EMPREGADOR_A" \
    -H "Content-Type: application/json" \
    -d '{"plano":"PLUS"}'
done
```

Esperado: alguma resposta `HTTP 429` após exceder o limite da janela.

## Limitação conhecida

O rate limit atual usa buckets em memória (`web/src/lib/rateLimit.ts`). Ele reduz abuso em uma instância do processo Next.js, mas não é limite global forte em serverless ou múltiplas instâncias. Para produção escalada, planejar storage compartilhado.
