# Security Testing — Dular Fases 1C → 1E

Testes automatizados das proteções introduzidas nas Fases 1A, 1A.1 e 1B
(RBAC/IDOR, rate limit, magic bytes, request IP, ownership, hardening
Stripe/admin) + CI gate (Fase 1E).

## CI

Workflow: [`.github/workflows/security-tests.yml`](../../.github/workflows/security-tests.yml).

Gatilhos:
- `pull_request` afetando `web/**`
- `push` para `main` afetando `web/**`

Etapas (job único `security`):
1. checkout
2. setup Node 20 com cache do npm em `web/package-lock.json`
3. `npm ci` (instalação determinística)
4. `npx prisma generate` (necessário antes do tsc)
5. `npx prisma validate`
6. `npx tsc --noEmit --pretty false`
7. `npm run test:security`

Mobile fica de fora deste workflow para manter o gate rápido (<3 min). Quando
houver demanda, abrir `mobile-typecheck.yml` separado.

## Como rodar

```bash
cd web
npm run test:security
```

O script usa o **test runner nativo do Node.js** (`node --test`) executado via
**tsx** para suporte direto a TypeScript. **Não há dependências novas**: tsx
já estava em `devDependencies` antes da Fase 1C.

Variáveis de ambiente dummy são injetadas pelo script para que módulos como
`lib/auth.ts` (exige `JWT_SECRET`) e `lib/prisma.ts` (exige `DATABASE_URL`)
não falhem no import. Os valores são **fake** e não tocam em banco real
(nenhum teste executa query Prisma).

## O que está coberto

### Helpers de upload — `imageMagicBytes`
- aceita JPEG real (`FF D8 FF`)
- aceita PNG real (`89 50 4E 47 0D 0A 1A 0A`)
- rejeita buffer vazio, truncado, GIF, PDF, texto puro
- rejeita PNG com signature parcial (último byte trocado)

### Extração de IP — `requestIp`
- pega o primeiro IP válido de `x-forwarded-for`
- ignora valores malformados e segue para o próximo
- fallback para `x-real-ip` e para `"unknown"`
- rejeita IPv4 com octeto > 255
- rejeita SQL injection-like strings
- rejeita strings gigantes (DoS de string)
- aceita IPv6 (`::1`, `2001:db8::1`)

### Rate limit — `rateLimit`
- bloqueia ao exceder limite
- decrementa `remaining` corretamente
- `resetAt` cai dentro da janela
- libera após janela expirar
- chaves diferentes têm buckets independentes
- `rateLimitRetryAfterMs`: nunca negativo, nunca NaN, zero se já expirou

### Ownership/IDOR — `isServiceParticipant`
- EMPREGADOR/DIARISTA/MONTADOR passam quando o campo correspondente bate
- usuário não-participante recebe `false` (regressão IDOR)
- `service: null | undefined` retorna `false`
- `userId` null/undefined/""/não-string sempre retorna `false`
- `service.{clientId,diaristaId,montadorId}` null/undefined/"" nunca libera acesso (corrigido em Fase 1C.1)

## Riscos conhecidos documentados pelos testes

### Rate limit em memória
Buckets vivem no Map do processo. Em deploy multi-instância
(Vercel serverless, múltiplos pods), cada instância tem seu próprio
limite. Testes cobrem comportamento single-instance. Fix real exige
Redis/Upstash (fora do escopo da Fase 1C).

## Testes de rota (Fase 1D)

Cobrem o caminho real do `route.ts` exportado pelo Next.js: monta `Request`
web standard, mocka `prisma` via `globalThis.prisma`, assina JWT real com
o `JWT_SECRET` dummy e assere o `Response`.

### Stripe webhook — `POST /api/webhooks/stripe`
- 400 quando `STRIPE_WEBHOOK_SECRET` não está configurado em prod
- 400 com assinatura inválida quando secret válido
- rejeita unsigned em prod **mesmo** com `STRIPE_WEBHOOK_ALLOW_UNSIGNED_DEV=true`
- rejeita unsigned em dev quando flag DEV não está ligada
- rejeita secret placeholder (com `...`)
- rejeita secret que não começa com `whsec_`

### Admin promote — `POST /api/admin/admins/promote`
- 401 sem token
- 403 token EMPREGADOR
- 403 token DIARISTA
- **403 stale token**: JWT diz `ADMIN` mas banco diz `EMPREGADOR`
- 400 com body inválido (admin legítimo)
- 404 quando admin tenta promover telefone inexistente

### Incidentes (IDOR) — `POST /api/incidentes`
- 401 sem token
- **403 IDOR**: usuário fora do serviço
- **403 IDOR**: `reportedUserId` arbitrário fora da contraparte
- 400 sem `serviceId`
- 403 serviço inexistente
- 200 empregador reportando diarista do mesmo serviço (contraparte legítima)
- 200 diarista reportando empregador (contraparte default)

### Chat — `POST /api/chat/[roomId]/messages`
- 401 sem token
- **403 IDOR**: outsider tenta postar
- 404 serviço inexistente
- 403 chat antes do serviço ser aceito
- **400 `type: IMAGE`** (URL externa proibida)
- 201 TEXT válido de participante

### Verificacoes (autorização) — `POST /api/verificacoes`
- 401 sem token
- 403 role não suportado (ADMIN)
- 409 DIARISTA com verificação já APROVADA
- 409 EMPREGADOR com verificação PENDING ativa

### Verificacoes (magic bytes via multipart real) — Fase 1E
- recusa `.jpg` com conteúdo de texto → 400
- recusa PDF renomeado para `.jpg` → 400
- recusa MIME `image/png` declarado mas bytes JPEG → 400 (mismatch)
- recusa MIME `application/pdf` (não-image) → 400
- JPG real válido passa magic bytes e chega ao `putObject` (S3 stubado) → ≠ 400

### Incidentes (anexos com magic bytes via multipart real) — Fase 1E
- anexo com bytes inválidos é **descartado** mas o incidente é criado (best-effort)
- anexo JPG real é persistido em `IncidentAttachment`
- anexo com MIME não-image é descartado no filtro inicial

### Stripe webhook (fluxo positivo) — Fase 1E
Com `stripe.webhooks.constructEvent` stubado:
- `checkout.session.completed` em `subscription` faz `upsert` em Subscription com o plano correto
- `checkout.session.completed` em `payment` credita `CreditWallet` e cria `CreditTransaction`
- evento sem `client_reference_id` é no-op silencioso (200, sem persistir)
- `customer.subscription.deleted` chama `updateMany` marcando `CANCELED`

### Login rate limit — `POST /api/auth/login`
- **429** após exceder 8 tentativas por usuário (IPs distintos)
- **429** após exceder 20 tentativas por IP (logins distintos)
- `retryAfterMs` nunca negativo nem NaN

## Harness multipart

`web/test/security/_multipart.ts` constrói um body `multipart/form-data` real
como `Buffer` com boundary explícito e devolve um `Request` standard com
headers compatíveis com `formidable` (incluindo `content-length`). Resolve o
erro `_transform() not implemented` que ocorre ao passar `FormData` direto
como body do `Request`.

API:
- `buildMultipart(parts) → { body, contentType }` — monta o body.
- `multipartRequest(url, parts, { userId, role })` — devolve `Request`
  pronto, opcionalmente com header `Authorization: Bearer <jwt>`.
- `JPEG_VALID`, `PNG_VALID` — buffers com magic bytes válidos para testes
  positivos.

`parts[]` aceita tanto `{ kind: "file" }` (com `filename`, `mime`, `data:
Buffer`) quanto `{ kind: "field" }` (texto simples).

## Limitações conhecidas

1. **Sem cobertura de Prisma real** — todas as queries são mockadas.
   Queries reais precisam de banco de teste (fora do escopo desta fase).

2. **Sem coverage report** — `node --test` suporta
   `--experimental-test-coverage`. Pode ser ligado pontualmente.

3. **`npm audit` — 5 vulnerabilidades moderadas** — dívida controlada
   por exigirem `audit fix --force` (breaking changes). Tracking em
   issue separado, não bloqueia release de Fase 1E.

4. **Stripe webhook positivo depende de mock global** — `stripe.webhooks.
   constructEvent` é monkey-patched no instance do singleton. Se outro
   teste rodar em paralelo (não é o caso hoje, `node --test` é sequencial
   por arquivo), poderia haver vazamento. Restaurado em `after()`.

5. **Logs silenciados em test** — `LOG_LEVEL=silent` no `_mocks.ts`
   sobrescreve `console.log/warn/info` para reduzir ruído. `console.error`
   é mantido para que falhas reais apareçam.

## Pendências (Fase 1F recomendada)

| Caso | Endpoint | Como atacar |
|------|----------|-------------|
| Paywall server-side | endpoints premium | mocks de `subscription` + assertar 402/403 |
| Testes de integração com Prisma real | qualquer rota | provisionar Postgres em CI (ex.: service container) |
| Rate limit cross-instance | rate limit geral | requer Redis/Upstash (mudança de produto) |
| Coverage report no CI | meta-target | habilitar `--experimental-test-coverage` e publicar |

## Estrutura

```
.github/
└── workflows/
    └── security-tests.yml                       ← CI gate (Fase 1E)

web/
├── test/
│   └── security/
│       ├── _mocks.ts                            ← mock global de prisma + silenciador de log
│       ├── _helpers.ts                          ← JWT real para auth header
│       ├── _multipart.ts                        ← harness multipart real (Fase 1E)
│       ├── imageMagicBytes.test.ts              ← magic bytes JPEG/PNG (unit)
│       ├── requestIp.test.ts                    ← IP defensivo (unit)
│       ├── rateLimit.test.ts                    ← bucket, janela (unit)
│       ├── requireAuth.test.ts                  ← isServiceParticipant (unit)
│       ├── routes-stripe-webhook.test.ts        ← rota Stripe rejeição + fluxo positivo (1D+1E)
│       ├── routes-admin-promote.test.ts         ← rota admin RBAC (1D)
│       ├── routes-incidentes.test.ts            ← rota IDOR + anexos com magic bytes (1D+1E)
│       ├── routes-chat.test.ts                  ← rota chat IDOR + IMAGE (1D)
│       ├── routes-verificacoes-upload.test.ts   ← rota autorização + magic bytes via multipart (1D+1E)
│       └── routes-login-ratelimit.test.ts       ← rota rate limit (1D)
├── docs/
│   ├── SECURITY-TESTING.md                      ← este arquivo
│   └── SECURITY-FASE-1B-TESTS.md                ← checklist manual existente
└── package.json                                 ← script `test:security`
```
