# Security Testing — Dular Fase 1C

Testes automatizados mínimos para impedir regressão das proteções introduzidas
nas Fases 1A, 1A.1 e 1B (RBAC/IDOR, rate limit, magic bytes, request IP,
ownership, hardening Stripe/admin).

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

### Login rate limit — `POST /api/auth/login`
- **429** após exceder 8 tentativas por usuário (IPs distintos)
- **429** após exceder 20 tentativas por IP (logins distintos)
- `retryAfterMs` nunca negativo nem NaN

## Limitações conhecidas

1. **Upload multipart real não é testado de rota inteira** — `formidable`
   não consome bem o stream de `Readable.fromWeb(FormData)` do Request
   web standard (erro `_transform() not implemented`). A lógica de
   magic bytes está totalmente coberta unit em `imageMagicBytes.test.ts`.
   O caminho de autorização de upload (401, 403, 409) está coberto. Fica
   pendente um harness multipart próprio para Fase 1E.

2. **Logs ruidosos** — `[AUTH LOGIN] ...` e similar aparecem no stdout
   durante o run. Não afeta o resultado, mas atrapalha leitura.
   Mitigação futura: env var `LOG_LEVEL=silent` reconhecida pelo produto.

3. **Sem cobertura de Prisma real** — todas as queries são mockadas.
   Queries reais precisam de banco de teste (não vale a pena nesta fase).

4. **Sem coverage report** — Node `--test` nativo suporta
   `--experimental-test-coverage`. Pode ser ligado pontualmente.

5. **Sem CI gate** — script `test:security` precisa ser ligado ao
   workflow (GitHub Actions) em commit separado.

## Pendências (Fase 1E recomendada)

| Caso | Endpoint | Bloqueio |
|------|----------|----------|
| Upload `.jpg` com conteúdo PDF aceito por rota | `POST /api/verificacoes` | harness multipart funcional |
| Magic bytes descartam anexo em `/api/incidentes` | `POST /api/incidentes` | idem |
| Paywall server-side | endpoints premium | mocks de subscription |
| Webhook Stripe processando evento real (mocked) | `POST /api/webhooks/stripe` | mock de `stripe.webhooks.constructEvent` |

## Próximos passos recomendados (Fase 1E)

1. **Harness multipart**: investigar `busboy` direto ou wrapper que monte
   o stream com `content-length` correto para o formidable. Alternativa:
   refatorar `parseMultipart` para aceitar buffer pré-extraído.
2. **Mock de stripe.webhooks**: testar processamento de
   `checkout.session.completed` → upsert de subscription.
3. **CI gate**: ligar `npm run test:security` ao workflow.
4. **Suprimir logs em test**: env var reconhecida pelo logger interno.
5. ~~Refatorar `isServiceParticipant` para defender contra `userId` nulo~~
   ✅ Feito em Fase 1C.1.

## Estrutura

```
web/
├── test/
│   └── security/
│       ├── _mocks.ts                            ← mock global de prisma
│       ├── _helpers.ts                          ← JWT real para auth header
│       ├── imageMagicBytes.test.ts              ← magic bytes JPEG/PNG (unit)
│       ├── requestIp.test.ts                    ← IP defensivo (unit)
│       ├── rateLimit.test.ts                    ← bucket, janela (unit)
│       ├── requireAuth.test.ts                  ← isServiceParticipant (unit)
│       ├── routes-stripe-webhook.test.ts        ← rota Stripe (1D)
│       ├── routes-admin-promote.test.ts         ← rota admin RBAC (1D)
│       ├── routes-incidentes.test.ts            ← rota IDOR de incidente (1D)
│       ├── routes-chat.test.ts                  ← rota chat IDOR + IMAGE (1D)
│       ├── routes-verificacoes-upload.test.ts   ← rota autorização upload (1D)
│       └── routes-login-ratelimit.test.ts       ← rota rate limit (1D)
├── docs/
│   ├── SECURITY-TESTING.md                      ← este arquivo
│   └── SECURITY-FASE-1B-TESTS.md                ← checklist manual existente
└── package.json                                 ← script `test:security`
```
