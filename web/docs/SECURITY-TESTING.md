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

## O que ainda é manual / pendente

Os testes acima cobrem **helpers puros**. Os testes de rota inteira (carregar
o `route.ts` do Next.js, fazer Request, assertar Response) exigem mais
infraestrutura — ficaram para Fase 1D.

**Pendências documentadas (Fase 1D recomendada):**

| Caso | Endpoint | O que validar | Como testar (proposta) |
|------|----------|----------------|--------------------------|
| IDOR de incidente | `POST /api/incidentes` | `reportedUserId` arbitrário → 403 | Harness com Request mock + Prisma mock |
| Chat sem participação | `GET/POST /api/chat/[roomId]/messages` | outsider → 403 | idem |
| Rota admin sem ADMIN | `POST /api/admin/admins/promote` | role ≠ ADMIN → 403 | idem |
| Stripe webhook sem assinatura | `POST /api/webhooks/stripe` | `stripe-signature` ausente em prod → 400 | env mock + Request sem header |
| Upload `.jpg` inválido | `POST /api/verificacoes` | conteúdo PDF renomeado → 400 | multipart com buffer PDF |
| Rate limit 429 em produção | `POST /api/auth/login` | exceder limite → 429 + `retryAfterMs` | loop de requests no harness |
| Magic bytes em incidentes | anexos do `POST /api/incidentes` | conteúdo PDF descartado, incidente criado sem anexo | idem |

**Testes manuais já documentados** em `SECURITY-FASE-1B-TESTS.md` continuam
sendo o checklist humano para release até que a Fase 1D automatize.

## Limitações conhecidas

1. **Sem cobertura de rotas Next.js** — App Router exige bootstrap pesado;
   adiar para 1D.
2. **Sem cobertura de Prisma** — toda lógica testada é pura (helpers).
   Queries reais ainda precisam de banco de teste (não vale a pena nesta
   fase).
3. **Sem coverage report** — Node `--test` nativo suporta `--experimental-test-coverage`
   mas não foi habilitado aqui para evitar ruído. Pode ser ligado pontualmente:
   ```bash
   JWT_SECRET=test_only DATABASE_URL=postgresql://test:test@localhost:5432/test \
     node --import tsx --test --experimental-test-coverage test/security/*.test.ts
   ```
4. **Sem CI gate** — script `test:security` precisa ser ligado ao CI/CD
   (GitHub Actions, etc.) em commit separado.

## Próximos passos recomendados (Fase 1D)

1. **Harness de rotas**: criar wrapper que instancia o `POST` exportado do
   `route.ts`, monta `Request` web standard, mocka `prisma` e `stripe`.
2. **Testes de IDOR de rota**: porta os 6 casos da tabela acima.
3. **Testes de paywall**: confirmar que sem subscription ativa, endpoints
   premium retornam 402/403.
4. **CI gate**: adicionar `npm run test:security` ao workflow do GitHub.
5. ~~Refatorar `isServiceParticipant` para defender contra `userId` nulo~~
   ✅ Feito em Fase 1C.1.

## Estrutura

```
web/
├── test/
│   └── security/
│       ├── imageMagicBytes.test.ts   ← magic bytes JPEG/PNG
│       ├── requestIp.test.ts         ← extração defensiva de IP
│       ├── rateLimit.test.ts         ← bucket, janela, retryAfter
│       └── requireAuth.test.ts       ← isServiceParticipant (IDOR)
├── docs/
│   ├── SECURITY-TESTING.md           ← este arquivo
│   └── SECURITY-FASE-1B-TESTS.md     ← checklist manual existente
└── package.json                      ← script `test:security`
```
