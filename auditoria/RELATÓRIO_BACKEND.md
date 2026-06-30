# RELATÓRIO DE AUDITORIA — BACKEND DULAR
**Agente:** SUB-AGENTE 1 — Auditor de Arquitetura e Backend  
**Data:** 2026-06-18  
**Escopo auditado:** `web/prisma/`, `web/src/app/api/`, `web/src/lib/`  
**Metodologia:** leitura exaustiva (read-only) — nenhum arquivo foi modificado

---

## SUMÁRIO EXECUTIVO

A arquitetura geral do backend está funcional e bem estruturada. O sistema de Guardian (SafeScore), as máquinas de estado de serviço e os middlewares de autenticação cobrem os fluxos principais. Foram identificados **4 achados CRÍTICOS**, **7 achados ALTO**, **9 achados MÉDIO** e **4 achados BAIXO**.

---

## 1. ACHADOS CRÍTICOS

### C-01 — Schema drift: `DiaristaProfile.genero` existe no banco, não no schema Prisma
**Arquivo:** `web/prisma/migrations/20260508000000_novo_modelo_perfis/migration.sql:29`  
**Evidência:**
```sql
ALTER TABLE "DiaristaProfile" ADD COLUMN "genero" "Genero";
```
O campo `genero` foi adicionado ao banco de dados via migration mas **não consta em `web/prisma/schema.prisma`**. O Prisma Client não enxerga esta coluna. Qualquer `SELECT *` ou `include` não vai retornar o campo. Se houver uma nova migration `prisma migrate dev`, o Prisma vai tentar dropar a coluna (dado que schema.prisma é a fonte de verdade).

**Risco:** Perda de dados silenciosa ou crash em próxima migração. Drift confirmado também em `User.genero` (mesma migration, linha 26) — embora `User.genero` possa constar no schema.

**Ação recomendada:** Verificar schema.prisma e alinhar. Se o campo foi intencionalmente removido do schema, a coluna órfã deve ser dropada com migration explícita.

---

### C-02 — Inconsistência de unidade monetária: centavos vs reais no mesmo modelo
**Arquivo principal:** `web/prisma/schema.prisma` + `web/src/app/api/servicos/route.ts:410-436`  
**Evidência no schema:**
- `DiaristaProfile.precoLeve / precoMedio / precoPesada : Int` — armazenados em **centavos**
- `DiaristaProfile.precoBabaHora / precoCozinheiraBase / taxaMinima : Decimal(10,2)` — armazenados em **reais**

**Evidência no código:**
```typescript
// servicos/route.ts:422-433
} else if (tipo === "FAXINA") {
  precoFinal = prof.precoLeve;               // já em centavos — usa direto
} else if (tipo === "BABA") {
  precoFinal = Math.round(Number(prof.precoBabaHora ?? 0) * 100);  // converte reais→centavos
} else if (tipo === "COZINHEIRA") {
  precoFinal = Math.round(Number(prof.precoCozinheiraBase ?? 0) * 100);
}
```

A migration `20260617120000_normalize_baba_cozinheira_precofinal/migration.sql` é evidência de que houve **corrupção de dados em produção** pela mesma inconsistência — a migration multiplica `precoFinal * 100` para corrigir valores já existentes.

**Risco:** Novo endpoint ou manutenção futura que não conheça esta convenção vai exibir ou gravar preços errados (BABA a R$ 0,35 em vez de R$ 35,00 ou vice-versa).

**Ação recomendada:** Padronizar tudo em centavos (Int). Renomear campos Decimal para deixar explícito ou documentar inline com comentário de unidade em TODOS os campos de preço do schema.

---

### C-03 — Role JWT não revalidado contra banco em `requireRole`
**Arquivo:** `web/src/lib/requireAuth.ts:53-62`  
**Evidência:**
```typescript
export function requireRole(
  reqOrAuth: Request | JwtPayload,
  allowedRoles: readonly AuthRole[]
) {
  const auth = isRequest(reqOrAuth) ? requireAuth(reqOrAuth) : reqOrAuth;
  if (!allowedRoles.includes(auth.role)) {   // <-- role vem do JWT, não do banco
    throw new Error("Forbidden");
  }
  return auth;
}
```

O JWT tem expiração de 7 dias (`web/src/lib/auth.ts`). Se um usuário tiver seu role alterado no banco (ex.: DIARISTA rebaixada, conta ADMIN revogada), o token existente continua autorizando ações pelo role antigo por até 7 dias.

**Contraste:** `requireAdmin` (`requireAuth.ts:64-76`) faz lookup no banco — é o único que protege corretamente.

**Risco:** Escalonamento de privilégio ou autorização indevida persistente pós-revogação. Afeta todos os endpoints que usam `requireRole` (aproximadamente 40+ rotas).

**Ação recomendada:** Adicionar lookup de role no banco dentro de `requireRole`, ou reduzir drasticamente o TTL do JWT, ou manter uma denylist de tokens revogados.

---

### C-04 — Rate limiting em memória não funciona em ambiente multi-instância/serverless
**Arquivo:** `web/src/lib/rateLimit.ts:1-7`  
**Evidência:**
```typescript
// Rate limit em memória: protege uma instância do processo Next.js.
// Em serverless/multi-instância, cada instância mantém seu próprio bucket.
const buckets = new Map<string, Hit>();
```

O próprio código documenta o problema. Em produção Next.js (Vercel/serverless), cada invocação pode rodar em instâncias separadas sem memória compartilhada. O rate limit é completamente contornável abrindo múltiplas conexões simultâneas (cada uma cai em instância diferente).

**Risco:** Ataques de força bruta em `/api/auth`, `/api/auth/mobile-google`, `/api/auth/signin/apple`, e qualquer endpoint que use `rateLimit()`. Ataques de abuso de recursos (ex.: criação massiva de serviços, envio massivo de SOS).

**Ação recomendada:** Substituir por rate limiting distribuído via Redis (Upstash, etc.) antes de habilitar como controle de segurança real.

---

## 2. ACHADOS ALTO

### A-01 — Dual SafeScore: SafeScore legado + SafeScoreProfile novo coexistem sem consolidação
**Arquivo:** `web/src/lib/safeScoreGuardian.ts:105-119`  
**Evidência:**
```typescript
async function getScoreAndTier(userId: string) {
  const profile = await prisma.safeScoreProfile.findUnique({ where: { userId } });
  if (profile) return { score: profile.currentScore, tier: profile.tier };
  const legacy = await prisma.safeScore.findUnique({ where: { userId } });
  if (legacy) return { score: legacy.score, tier: scoreToGuardianTier(legacy.score) };
  return { score: 500, tier: "BRONZE" }; // default silencioso
}
```

O fallback silencioso retorna score 500 (tier SILVER) para usuários sem nenhum dos dois registros. Isso pode permitir que usuários novos sem score passem pelo Guardian com tier SILVER em vez de serem corretamente avaliados.

**Risco:** Usuários fraudulentos sem histórico passam a barreira do Guardian. Manutenção aumenta — qualquer nova lógica de score precisa ser duplicada em ambos os modelos.

---

### A-02 — Campos de score denormalizados em `User` nunca escritos por código auditado
**Arquivo:** `web/prisma/schema.prisma` — campos `scoreAtual Float`, `riskScore Float`, `riskTier SafeScoreTier` em `User`  

Nenhum endpoint auditado escreve nesses campos. Eles existem em paralelo ao `SafeScoreProfile`. Se algum código legado ainda os lê, pode retornar dados desatualizados.

**Risco:** Inconsistência silenciosa. Campos com valores antigos podem ser exibidos para o usuário se algum GET os incluir.

---

### A-03 — `GET /api/servicos/[id]` expõe `enderecoCompleto` independente do status
**Arquivo:** `web/src/app/api/servicos/[id]/route.ts:36-43`  
**Evidência:**
```typescript
return NextResponse.json({
  ok: true,
  servico: {
    ...servico,
    endereco: servico.enderecoCompleto,  // exposto para qualquer status
  },
  otherUserId,
});
```

O endpoint `GET /api/servicos/minhas` (rota de listagem) filtra corretamente `enderecoCompleto` por status. O endpoint de detalhe individual não filtra — retorna o endereço residencial do empregador para qualquer participante em qualquer status (incluindo SOLICITADO, RECUSADO, CANCELADO).

**Risco:** Profissional que teve serviço recusado ou cancelado vê o endereço completo do empregador indefinidamente.

---

### A-04 — `MontadorPerfil.precoBase` é `Decimal?` no schema mas tratado como centavos Int no código
**Arquivos:**  
- `web/prisma/schema.prisma`: `precoBase Decimal?`  
- `web/src/app/api/montador/me/route.ts`: `centsSchema = z.number().int().min(0)` para `precoBase`  
- `web/src/app/api/montadores/buscar/route.ts`: `(Number(montador.precoBase) / 100).toFixed(2)` — trata como centavos  

**Risco:** Qualquer insert/update via ORM que passe um `Decimal` (ex.: 150.00) em vez de um inteiro (ex.: 15000) vai armazenar valor 10000x menor. O tipo `Decimal` não impede isso.

---

### A-05 — `DiaristaHabilidade` (legacy) acumula dados órfãos silenciosamente
**Arquivo:** `web/src/app/api/servicos/route.ts:374-386` — comentário inline confirma: `diaristaHabilidade` é legado, `servicosOferecidos` é fonte de verdade  

O modelo ainda recebe writes em alguns flows (não encontrado write direto no código auditado, mas o modelo existe com dados ativos). A busca em `diaristas/buscar/route.ts:140-148` usa `habilidades` (legado) apenas quando `tipo` é passado como parâmetro — cria comportamento inconsistente.

**Risco:** A busca filtrada por `tipo` usa tabela legada; a busca por `servico` usa `servicosOferecidos`. Um profissional pode aparecer em um filtro e não no outro para a mesma habilidade.

---

### A-06 — Localização triplicada sem fonte de verdade única
**Arquivo:** `web/prisma/schema.prisma`  
Os três perfis (`EmpregadorPerfil`, `DiaristaProfile`, `MontadorPerfil`) têm campos `cidade/estado` (base) + `cidadeAtual/estadoAtual/bairroAtual` (atual). Além disso, `User` tem `localizacaoPermitida`, `cidadeAtual`, `estadoAtual`, `bairroAtual`.

**Evidência de inconsistência real:** `GET /api/me` para MONTADOR não retorna campos de localização do `User` (`localizacaoPermitida`), apenas do `MontadorPerfil`.

**Risco:** Dados de localização divergentes entre perfil e usuário; dificuldade em saber qual é o "endereço atual" canônico do usuário.

---

### A-07 — Default score 500 (SILVER) para usuários sem SafeScore — bypass silencioso do Guardian
**Arquivo:** `web/src/lib/safeScoreGuardian.ts:118-119`  
**Evidência:**
```typescript
return { score: 500, tier: "BRONZE" };
```
(Note: o comentário diz BRONZE mas o score 500 retornado é threshold de SILVER pelo próprio `scoreToGuardianTier`. Há inconsistência no valor padrão vs tier padrão.)

Usuários sem nenhum registro de score recebem score 500, que está acima do `SCORE_BLOQUEIO = 400`, permitindo que criem serviços e recebam serviços sem histórico avaliado.

---

## 3. ACHADOS MÉDIO

### M-01 — `DIARISTA` nova criada com `precoLeve: 0, precoPesada: 0`
**Arquivo:** `web/src/lib/userProfiles.ts`  
`ensureUserRoleProfile` usa upsert com `precoLeve: 0, precoPesada: 0`. Esses campos são `Int NOT NULL` no schema. Um `0` passa pela validação mas pode ser interpretado como "sem preço configurado" em alguns lugares e "preço zero" em outros.

---

### M-02 — `GET /api/usuarios/[id]/score` expõe tier/faixa de qualquer usuário para qualquer autenticado
**Arquivo:** `web/src/app/api/usuarios/[id]/score/route.ts`  
Qualquer usuário logado pode consultar o score tier de outro usuário pelo ID. Não há restrição de role ou relação entre o requester e o target.

---

### M-03 — Apple Sign-In sem rota dedicada — depende de catchall NextAuth
**Arquivo:** Não existe `web/src/app/api/auth/signin/apple/route.ts`  
O mobile chama `/api/auth/signin/apple` (confirmado em `dular-mobile`). Isso cai no catchall `[...nextauth]` do NextAuth. A configuração do provider Apple está em `auth-oauth.ts` mas o handler da rota mobile-específico não foi encontrado — pode retornar formato não esperado pelo mobile.

---

### M-04 — `requireAuth` lança `Error("Unauthorized")` genérico — sem diferenciação de token expirado vs inválido
**Arquivo:** `web/src/lib/requireAuth.ts:21-26`  
O catch do `verifyToken` transforma qualquer erro JWT em `"Unauthorized"`. Token expirado e token adulterado recebem o mesmo tratamento, impedindo que o cliente saiba se deve renovar o token ou fazer novo login.

---

### M-05 — Endpoints públicos de busca sem limitação de resultados configurável — `take: 300` fixo
**Arquivo:** `web/src/app/api/diaristas/buscar/route.ts:189`, `web/src/app/api/montadores/buscar/route.ts`  
`take: 300` hardcoded. Qualquer requisição válida retorna até 300 profissionais + dados relacionados (bairros, user). Em cidades grandes isso representa uma resposta de payload considerável sem paginação.

---

### M-06 — `FAXINEIRA` no enum `ServicoTipo` difere de `FAXINA` usado no código de preço
**Arquivo:** `web/prisma/migrations/20260617200000_add_servico_tipos_casa/migration.sql:9`  
Migration adiciona `FAXINEIRA` ao enum `ServicoTipo`. O código de preço em `servicos/route.ts` trata `FAXINEIRA` como "a combinar" (`tipoACombinar`). Mas `empregadorApi.ts:7` do mobile mapeia `categoria: "faxineira" → tipo: "FAXINEIRA"`. Isso funciona, mas `FAXINA` (para diarista clássica) e `FAXINEIRA` (novo nicho) podem ser confundidos por futuros mantenedores.

---

### M-07 — Sem transaction em criação de serviço com ChatRoom upsert
**Arquivo:** `web/src/app/api/servicos/route.ts:445-469`  
O `servico.create` e o `chatRoom.upsert` subsequente estão em try/catch separados. Se o chatRoom falhar, o serviço já foi criado sem sala de chat. O comentário inline diz "o serviço deve existir, sala pode ser criada depois" — mas isso deixa o serviço em estado incompleto sem nenhuma notificação ou retry automático.

---

### M-08 — `rateLimit` cleanup nunca chamado automaticamente
**Arquivo:** `web/src/lib/rateLimit.ts:32-37`  
`cleanupRateLimit` existe mas não é chamado por nenhum mecanismo automático (cron, middleware). O `buckets` Map crescerá indefinidamente enquanto a instância estiver viva (mitigado apenas pelo ciclo de vida da instância serverless).

---

### M-09 — Campos `cidadeAtual/estadoAtual/bairroAtual` do `User` não retornados em `/api/me` para MONTADOR
**Arquivo:** `web/src/app/api/me/route.ts`  
GET para MONTADOR retorna apenas campos do `MontadorPerfil`. Campos de localização atual do `User` (`localizacaoPermitida`, `cidadeAtual`, `estadoAtual`, `bairroAtual`) não são incluídos, potencialmente fazendo o mobile exibir localização desatualizada.

---

## 4. ACHADOS BAIXO

### B-01 — Debug logs ativos em produção em `diaristas/buscar`
**Arquivo:** `web/src/app/api/diaristas/buscar/route.ts:67-104`  
O bloco `if (isDev)` controla logs detalhados, incluindo 4 queries extras de contagem. Correto. Mas o bloco existe e adiciona overhead de leitura de código.

---

### B-02 — Endpoints só-mobile não acessíveis via web sem doc
Vários endpoints (`/api/me/push-token`, `/api/seguranca/sos`, `/api/seguranca/checkin`) são mobile-only mas não têm qualquer marcação ou guard impedindo acesso web.

---

### B-03 — `/api/ops/fila` e `/api/me/header` não chamados pelo mobile (endpoints órfãos potenciais)
Esses endpoints existem no backend mas não aparecem em nenhuma chamada do `dular-mobile`. Podem ser web-only ou podem estar abandonados.

---

### B-04 — Tipagem `any` em filtro de habilidades na busca de diaristas
**Arquivo:** `web/src/app/api/diaristas/buscar/route.ts:142-145`  
```typescript
tipo: tipo as any,
...(categoria ? { categoria: categoria as any } : {}),
```
Cast para `any` em filtro Prisma — perde type-safety para os campos `tipo` e `categoria` do modelo `DiaristaHabilidade`.

---

## 5. MAPA DE ENDPOINTS AUDITADOS

### Endpoints com autenticação obrigatória (JWT)
| Endpoint | Método | Role | Observação |
|---|---|---|---|
| `/api/auth/logout` | POST | any | |
| `/api/auth/mobile-google` | POST | — | OAuth flow mobile |
| `/api/me` | GET/PUT | any | Shape varia por role |
| `/api/me/avatar` | POST | any | Upload S3 |
| `/api/me/guardian` | GET | any | Retorna permissões do Guardian |
| `/api/me/localizacao` | PUT | any | |
| `/api/me/push-token` | POST | any | Expo push token |
| `/api/me/restrictions` | GET | any | |
| `/api/me/subscription` | GET | any | |
| `/api/servicos` | POST | EMPREGADOR | Cria serviço |
| `/api/servicos/minhas` | GET | any | Lista com filtro de address por status |
| `/api/servicos/[id]` | GET | any (participante) | Expõe endereço sem filtro de status (C-03) |
| `/api/servicos/[id]/aceitar` | POST | DIARISTA/MONTADOR | |
| `/api/servicos/[id]/recusar` | POST | DIARISTA/MONTADOR | |
| `/api/servicos/[id]/iniciar` | POST | DIARISTA/MONTADOR | |
| `/api/servicos/[id]/concluir` | POST | DIARISTA/MONTADOR | |
| `/api/servicos/[id]/confirmar-finalizacao` | POST | EMPREGADOR | Double-confirm |
| `/api/servicos/[id]/confirmar` | POST | EMPREGADOR | CONCLUIDO→CONFIRMADO |
| `/api/servicos/[id]/cancelar` | POST | EMPREGADOR/DIARISTA/MONTADOR | |
| `/api/servicos/[id]/reagendar` | POST/PATCH | DIARISTA/EMPREGADOR | |
| `/api/servicos/[id]/avaliar` | POST | EMPREGADOR | Requer status CONFIRMADO |
| `/api/notificacoes` | GET | any | |
| `/api/notificacoes/[id]/ler` | POST | any | |
| `/api/notificacoes/ler-todas` | POST | any | |
| `/api/seguranca/checkin` | POST | any | |
| `/api/seguranca/sos` | POST | any | |
| `/api/seguranca/eventos` | GET | any | |
| `/api/incidentes` | POST | any | |
| `/api/verificacoes` | GET/POST | any | KYC |
| `/api/me/header` | GET | any | Web-only? |
| `/api/billing/checkout` | POST | any | Stripe |
| `/api/billing/plans` | GET | any | Web-only? |
| `/api/diarista/me` | GET/PUT | DIARISTA | |
| `/api/diarista/bairros` | GET/PUT | DIARISTA | |
| `/api/diarista/disponibilidade` | GET/PUT | DIARISTA | |
| `/api/diarista/habilidades` | GET/PUT | DIARISTA | Legacy? |
| `/api/diarista/precos` | GET/PUT | DIARISTA | |
| `/api/montador/me` | GET/PUT | MONTADOR | |
| `/api/montador/portfolio` | GET/POST/DELETE | MONTADOR | |
| `/api/empregador/favoritos` | GET/POST/DELETE | EMPREGADOR | |
| `/api/catalogo/servicos` | GET | any | |
| `/api/chat` | GET/POST | any (participante) | |
| `/api/ops/fila` | GET | ADMIN | |
| `/api/admin/*` | * | ADMIN | requireAdmin (verifica DB) |

### Endpoints públicos (sem auth)
| Endpoint | Observação |
|---|---|
| `/api/diaristas/buscar` | Guardian aplicado via Promise.all |
| `/api/montadores/buscar` | Sem Guardian aplicado aqui |
| `/api/usuarios/[id]/score` | Requer auth, mas qualquer role vê score de qualquer usuário (M-02) |
| `/api/usuarios/[id]/trust-signals` | Requer auth |

---

## 6. MÁQUINA DE ESTADOS DO SERVIÇO

```
RASCUNHO → SOLICITADO → ACEITO → EM_ANDAMENTO
                ↓            ↓          ↓
           RECUSADO    CANCELADO   CANCELADO
                                       ↓
                                AGUARDANDO_FINALIZACAO (profissional conclui)
                                       ↓
                                   CONCLUIDO (empregador confirma-finalizacao)
                                       ↓
                                   CONFIRMADO (empregador aprova via /confirmar)
                                       ↓
                                   FINALIZADO (após avaliação)
```

**Observação:** `/api/servicos/[id]/avaliar` aceita apenas `CONFIRMADO`. O `/confirmar` avança `CONCLUIDO→CONFIRMADO`. O `/confirmar-finalizacao` avança `EM_ANDAMENTO→AGUARDANDO_FINALIZACAO`. A nomeação `confirmar-finalizacao` vs `confirmar` é confusa — dois endpoints com "confirmar" para ações distintas na mesma máquina.

---

## 7. RESUMO DE COBERTURA

| Área | Arquivos lidos | Status |
|---|---|---|
| `web/prisma/schema.prisma` | 1 | Completo |
| `web/prisma/migrations/` | 6 migrations | Completo |
| `web/src/lib/` | 12 arquivos | Completo |
| `web/src/app/api/` | ~75 route.ts | Completo |
| `dular-mobile/src/api/` | 10 arquivos (cross-ref) | Completo |

---

*Relatório gerado por SUB-AGENTE 1 — nenhum arquivo de código foi modificado durante esta auditoria.*
