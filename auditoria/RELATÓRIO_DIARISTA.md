# RELATÓRIO DE AUDITORIA — PERFIL DIARISTA (Profissional de Casa)

**Data:** 2026-06-18  
**Auditor:** Sub-Agente 3 — Auditor do Perfil Diarista  
**Escopo:** Cadastro → Onboarding → Perfil → Disponibilidade → Serviços → Contratação → Avaliações

---

## 1. RESUMO EXECUTIVO

O fluxo ponta-a-ponta do perfil Diarista está **estruturalmente funcional**: o backend tem rotas de criação, completude, busca, contratação e avaliação implementadas com validações coerentes. O mobile cobre as seções esperadas. Contudo, existem **dois bloqueios críticos de lançamento** e vários problemas de severidade ALTA que impedem que a maioria das diaristas apareça na busca ou seja contratada em produção.

**Bloqueios críticos:**
1. A busca filtra `verificacao = VERIFICADO` — mas a aprovação manual não existe como endpoint operacional autoexecutável em produção; `AUTO_VERIFY_PROFILES=true` só está disponível para QA/E2E. Qualquer diarista real ficará bloqueada em `PENDENTE` indefinidamente até aprovação admin manual.
2. A busca exige também `SafeScore.canAppearInSearch = true`, que requer `SafeScoreProfile` existente com score ≥ 400 **e** verificação VERIFICADO. Para usuários novos, o `SafeScoreProfile` pode não existir — o fallback retorna score 500 (BRONZE), mas a lógica `canAppearInSearch` requer `verificado AND !scoreBaixo`. Novos usuários sem verificação jamais passam.

---

## 2. MAPA DE TELAS/SEÇÕES

| Seção | Tela Mobile | Endpoint Backend | Status |
|---|---|---|---|
| Seleção de role | `RoleSelectScreen.tsx` | `POST /api/me/role` | FUNCIONAL |
| Gate de nichos pós-login | `NichosGateScreen.tsx` | `PATCH /api/diarista/me` | FUNCIONAL |
| Gate de gênero | `GeneroGateScreen.tsx` | `PATCH /api/me/profile` | FUNCIONAL |
| Perfil completo (diarista) | `DiaristaPerfil.tsx` | `GET /api/diarista/me` | FUNCIONAL |
| Editar dados pessoais | Modal "dados" em `DiaristaPerfil.tsx` | `PUT /api/me` + `PATCH /api/diarista/me` | FUNCIONAL |
| Serviços oferecidos | Modal "servicos" em `DiaristaPerfil.tsx` | `PATCH /api/diarista/me` | FUNCIONAL |
| Área de atendimento | Modal "area" em `DiaristaPerfil.tsx` | `PATCH /api/diarista/me` + `PUT /api/diarista/bairros` | FUNCIONAL |
| Preços | Modal "precos" em `DiaristaPerfil.tsx` | `PUT /api/diarista/precos` + `PATCH /api/diarista/me` | FUNCIONAL |
| Habilidades/catálogo | Modal "habilidades" em `DiaristaPerfil.tsx` | `PUT /api/diarista/habilidades` | FUNCIONAL |
| Disponibilidade | Modal "disponibilidade" em `DiaristaPerfil.tsx` | `PUT /api/diarista/disponibilidade` | FUNCIONAL |
| Documentos/verificação | `VerificacaoDocs.tsx` (via navigate) | `POST /api/verificacoes` | FUNCIONAL (upload) |
| Avaliações | Modal "avaliacoes" em `DiaristaPerfil.tsx` | (exibe `profile.avaliacoes` já carregado) | FUNCIONAL |
| Busca (lado empregador) | `BuscarScreen.tsx` | `GET /api/diaristas/buscar` | FUNCIONAL COM RESTRIÇÕES |
| Perfil público da diarista | `DiaristaProfileScreen.tsx` | `GET /api/diaristas/[userId]` | FUNCIONAL |
| Contratação | Fluxo em `SolicitarServicoScreen` | `POST /api/servicos` | FUNCIONAL COM RESTRIÇÕES |
| Avaliação pós-serviço | `AvaliacaoModal.tsx` | `POST /api/servicos/[id]/avaliar` | FUNCIONAL |

---

## 3. CRITÉRIOS EXATOS DE VISIBILIDADE NA BUSCA

Fonte: `web/src/app/api/diaristas/buscar/route.ts` (linhas 129–311) + `web/src/lib/safeScoreGuardian.ts` (linhas 323–345)

### 3.1 Filtro Prisma (linha 129–150, `buscar/route.ts`)

```
WHERE ativo = true
  AND verificacao = 'VERIFICADO'        -- VerificacaoStatus enum
  AND (servico IS NULL OR servicosOferecidos @> [servico])
  AND user.status = 'ATIVO'
  AND user.restrictions NONE OF (SHADOW_BAN | SUSPEND | BLOCK) ativos
  AND (tipo/categoria match via habilidades se informado)
```

### 3.2 Filtro de localização em memória (linhas 203–231)

- Match `cidade/estado` (normalizado, sem acentos) com o parâmetro da busca  
- OU: ao menos um `DiaristaBairro.bairro.cidade/uf` bate com a busca  
- Se `atendeTodaCidade = true` → passa independente de bairro específico  
- Se `atendeTodaCidade = false` E `bairroNorm` informado → exige bairro vinculado com nome igual

### 3.3 Filtro de completude (linhas 240–266)

Usa `getDiaristaProfileCompleteness` (ou `isDiaristaProfileCompleteForServico` se `servico` informado):

- `ativo = true`
- `user.status ≠ 'BLOQUEADO'`
- `user.nome` não vazio
- `bio` não vazio
- `servicosOferecidos.length > 0`
- `(cidade && estado)` OU `bairros.length > 0`
- Se `servico` especificado:
  - `servicosOferecidos.includes(servico)`
  - Preço adequado ao nicho (ou `valorACombinar = true`)

### 3.4 Filtro Guardian (linhas 283–305)

Executa `getGuardianStatusForUser` para cada candidata. Exige `canAppearInSearch = true`, que requer:
- `verificacao = VERIFICADO`
- `perfil completo`
- `!hardBan && !SHADOW_BAN`
- `score >= 400`

**Fonte:** `web/src/lib/safeScoreGuardian.ts:342`

```typescript
canAppearInSearch = baseLiberado && verificado && completude.completo && !shadow;
```

---

## 4. COMPLETUDE DO PERFIL

### 4.1 Regra backend (`getDiaristaProfileCompleteness`)

Fonte: `web/src/lib/diaristaProfile.ts:131–150`

| Critério | Campo | Condição |
|---|---|---|
| Usuário ativo | `user.status` | ≠ `BLOQUEADO` |
| Perfil ativo | `ativo` | `= true` |
| Nome | `user.nome` | `.trim()` não vazio |
| Bio | `bio` | `.trim()` não vazio |
| Serviços | `servicosOferecidos` | length > 0 |
| Localização | `cidade+estado` OU `bairros.length > 0` | pelo menos um |

### 4.2 Regra mobile (`calcularCompletudeDiarista`)

Fonte: `dular-mobile/src/api/diaristaApi.ts:269–315`

| Critério | Condição |
|---|---|
| Nome | length >= 2 |
| Bio | length >= 20 chars |
| Serviços | length > 0 |
| Localização | `bairros.length > 0` OU `cidade+estado` |
| Preços | `valorACombinar=true` OU `(precoLeve > 0 AND precoPesada > 0)` |

### 4.3 Inconsistência entre mobile e backend

**ALTO:** O mobile exige bio >= 20 chars. O backend exige apenas `bio?.trim()` não vazio (qualquer comprimento). Uma diarista pode ter 100% no backend e <100% no mobile (ou vice-versa se digitar 1-19 chars).

**Fonte:** `diaristaApi.ts:282` vs `diaristaProfile.ts:139`

### 4.4 Completude no perfil público

O `useDiaristaPublico.ts` (hook do empregador) recalcula `perfilCompleto` no client usando `calcularCompletudeDiarista` (regra mobile), mas o backend em `diaristas/[userId]` retorna `perfilCompleto` calculado com `getDiaristaProfileCompleteness` (regra backend).  
Resultado: o valor `perfilCompleto` exibido ao empregador pode divergir do calculado pelo backend que controla a busca.

**Fonte:** `useDiaristaPublico.ts:154–191` vs `web/src/app/api/diaristas/[userId]/route.ts:106–123`

---

## 5. PREÇOS — UNIDADES E CATEGORIAS "A COMBINAR"

### 5.1 Unidades

| Campo | Tipo (schema) | Unidade | Comportamento |
|---|---|---|---|
| `precoLeve` | `Int` | **CENTAVOS** | schema.prisma:268 |
| `precoMedio` | `Int` | **CENTAVOS** | schema.prisma:269 |
| `precoPesada` | `Int` | **CENTAVOS** | schema.prisma:270 |
| `precoBabaHora` | `Decimal(10,2)` | **REAIS** | schema.prisma:298 |
| `precoCozinheiraBase` | `Decimal(10,2)` | **REAIS** | schema.prisma:299 |
| `taxaMinima` | `Decimal(10,2)` | **REAIS** | schema.prisma:300 |

O mobile converte corretamente:
- Centavos → input: `DiaristaPerfil.tsx:225–237` (`centsToInput`, `centsToBRL`)
- REAIS Decimal → input: `DiaristaPerfil.tsx:255–259` (`decimalToInput`)

O backend em `/api/servicos/route.ts:431` converte Decimal para centavos ao criar o serviço:
```typescript
precoFinal = Math.round(Number(prof.precoBabaHora ?? 0) * 100);
```

A conversão está correta mas é frágil: depende de `Number(prof.precoBabaHora)` funcionar bem com strings do Prisma Decimal. Sem validação de NaN neste ponto.

### 5.2 Nichos "a combinar" (FAXINEIRA, PASSADEIRA, LAVADEIRA, CUIDADORA)

Fonte: `web/src/lib/diaristaProfile.ts:70–75` e `web/src/app/api/servicos/route.ts:418`

Estes nichos são declarados `SERVICOS_A_COMBINAR` e **não exigem preço** configurado para:
- Aparecer na busca (completude não verifica preço para eles)
- Ser contratada (código em `servicos/route.ts:418–420` usa `precoFinal=0` para esses tipos)

O mobile reflete isso: o modal de preços só exige leve/pesada se o perfil oferecer `DIARISTA`; babaHora se `BABA`; cozinheiraBase se `COZINHEIRA`. Para FAXINEIRA/PASSADEIRA/LAVADEIRA/CUIDADORA, o campo é liberado sem validação obrigatória.  
**Status:** CORRETO e funcional.

---

## 6. servicosOferecidos — DEFINIÇÃO E MATCH

### 6.1 Gate NichosGateScreen

Fonte: `dular-mobile/src/screens/onboarding/NichosGateScreen.tsx`

- Dispara quando `user.servicosOferecidos` está vazio após login como DIARISTA
- Lista opções de `OFERTAS_DIARISTA` (derivado de `constants/categorias.ts`)
- Salva via `PATCH /api/diarista/me` com payload `{ servicosOferecidos }`
- Pré-seleciona `["DIARISTA"]` por padrão

### 6.2 Match na Busca

Fonte: `buscar/route.ts:133`

```typescript
servicosOferecidos: { has: servico }
```

O parâmetro `servico` na query deve ser exatamente um dos valores do enum `ServicoOferecido`: `DIARISTA | BABA | COZINHEIRA | FAXINEIRA | PASSADEIRA | LAVADEIRA | CUIDADORA`.

### 6.3 Match na Contratação

Fonte: `servicos/route.ts:321,381`

- `nichoFromTipo(tipo)` mapeia `ServicoTipo` → `ServicoOferecido`
- `PASSA_ROUPA` → `"PASSADEIRA"` (linha 89 de `diaristaProfile.ts`)
- Verifica `prof.servicosOferecidos.includes(nicho)`

**Problema ALTO:** `nichoFromCategoria` em `diaristaProfile.ts:99–106` cobre apenas `FAXINA_*`, `BABA_*`, `COZINHEIRA_*`, `PASSA_ROUPA_*`. **Não cobre `FAXINEIRA`, `LAVADEIRA`, `CUIDADORA`** quando categoria é passada sem tipo. Mas como `tipo` é sempre enviado no fluxo principal, este é um risco latente.

---

## 7. CONTRATAÇÃO PONTA A PONTA

### 7.1 Fluxo empregador → diarista

1. Empregador abre `BuscarScreen`, busca por cidade/uf
2. Resultado: diaristas com `ativo=true AND verificacao=VERIFICADO AND user.status=ATIVO AND canAppearInSearch=true`
3. Empregador clica em "Ver perfil" → `DiaristaProfileScreen`
4. Empregador clica em "Contratar" → navega para `SolicitarServicoScreen`
5. `POST /api/servicos` valida:
   - Empregador Guardian: `canCreateServico = true` (exige empregador verificado)
   - Feature gate: limite de solicitações do plano
   - Diarista Guardian: `canReceiveServico = true` (VERIFICADO + não banida + score ≥ 400)
   - Diarista perfil completo para o nicho
   - Bairro cadastrado na tabela `Bairro` **obrigatoriamente** (`findUnique` pelo nome_cidade_uf)
   - Diarista atende o bairro (ou `atendeTodaCidade=true`)
   - Serviço ativo não duplicado

### 7.2 BLOQUEIO CRÍTICO: Bairro deve existir na tabela `Bairro`

Fonte: `servicos/route.ts:356–360`

```typescript
const bairroDb = await prisma.bairro.findUnique({
  where: { nome_cidade_uf: { nome: bairro, cidade, uf } },
});
if (!bairroDb) {
  return NextResponse.json({ ok: false, error: "Bairro não cadastrado." }, { status: 400 });
}
```

A tabela `Bairro` é populada via `PUT /api/diarista/bairros` (upsert por nome+cidade+uf). Mas se o empregador informar um bairro com grafia diferente da que a diarista cadastrou (ex: "Centro" vs "centro"), a busca via normalização passa (campo cidade/uf normalizado em memória), mas a criação do serviço falha com 400 porque usa `findUnique` sem normalização.

**Inconsistência:** a busca usa normalização de acentos/case; a criação do serviço usa exact match no banco. **Uma diarista pode aparecer na busca mas a contratação pode falhar silenciosamente.**

### 7.3 Disponibilidade NÃO é verificada na criação do serviço

A tabela `Disponibilidade` (dias/turnos da diarista) **não é consultada** em `POST /api/servicos`. Empregador pode solicitar serviço em qualquer dia/turno independente da disponibilidade cadastrada pela diarista.

**Fonte:** `servicos/route.ts` não faz join com `Disponibilidade`.

---

## 8. AVALIAÇÕES

### 8.1 Fluxo completo

Fonte: `web/src/app/api/servicos/[id]/avaliar/route.ts`

- Apenas `EMPREGADOR` pode avaliar
- Serviço precisa estar no status `CONFIRMADO`
- `avaliacao` já existente → retorna 409
- Cria `Avaliacao` com `diaristaId = servico.diaristaId`
- Muda status do serviço para `FINALIZADO`
- Chama `recomputeDiaristaStats` → recalcula `notaMedia` e `totalServicos` no `DiaristaProfile`
- Aplica evento ao SafeScore: `AVALIACAO_POSITIVA` (nota >= 4) ou `AVALIACAO_NEGATIVA`

### 8.2 Exibição no perfil da diarista

Fonte: `diarista/me/route.ts:252–267`

O endpoint `/api/diarista/me` retorna `avaliacoes.itens` com as 5 mais recentes. O modal "avaliacoes" em `DiaristaPerfil.tsx` exibe `profile.avaliacoes.total` e a nota média.

**Problema MÉDIO:** O perfil público (`/api/diaristas/[userId]`) **não retorna avaliações individuais** — retorna apenas `notaMedia` e `totalServicos`. O `useDiaristaPublico.ts` constrói o campo `mediaAvaliacao` a partir do endpoint `/api/usuarios/[id]/trust-signals`, não do endpoint de perfil. As avaliações textuais (comentários) não são acessíveis ao empregador na tela de perfil público.

---

## 9. INCONSISTÊNCIAS MOBILE↔BACKEND / DADOS MOCKADOS

### 9.1 `verificacaoSubtitle` — valor string "APROVADO" não existe no enum backend

Fonte: `dular-mobile/src/screens/diarista/DiaristaPerfil.tsx:210–214`

```typescript
function verificacaoSubtitle(status: VerificacaoStatus) {
  if (status === "APROVADO") return "Profissional verificada";
```

O tipo `VerificacaoStatus` do mobile inclui `"APROVADO"` e `"NAO_ENVIADO"`, mas o backend usa o enum Prisma `VerificacaoStatus` com valores `PENDENTE | VERIFICADO | REPROVADO`.

O mapeamento é feito em `loadMe` (linha 418–422):
```typescript
const pv = String(perfilData.verificacao).toUpperCase();
setVerificacao(
  pv === "VERIFICADO" ? "APROVADO" : pv === "REPROVADO" ? "REPROVADO" : "PENDENTE",
);
```

Isso funciona mas cria dois namespaces paralelos, aumentando risco de bug futuro.

**Fonte:** `DiaristaPerfil.tsx:418-422` e `perfilApi.ts` (tipo `VerificacaoStatus`)

### 9.2 `useDiaristaPublico` recalcula `perfilCompleto` com regra diferente do backend

Conforme seção 4.4 acima. O hook usa `calcularCompletudeDiarista` (regra mobile, bio >= 20 chars), mas o backend retorna `perfilCompleto` calculado com `getDiaristaProfileCompleteness` (sem mínimo de chars para bio). Resultado: `perfilCompleto` do hook pode diferir do campo retornado pela API.

**Fonte:** `useDiaristaPublico.ts:154` vs `diaristas/[userId]/route.ts:106`

### 9.3 Preços exibidos no perfil público sem divisão por 100 (RISCO)

Fonte: `DiaristaProfileScreen.tsx:62`

A função `precoLinhaLabel` divide corretamente `precos.leve / 100` ao exibir preço de diarista:
```typescript
const leveFmt = precos.leve != null ? formatCurrencyBRL(precos.leve / 100) : null;
```

O backend retorna em `precos: { leve, medio, pesada }` (campos de `DiaristaProfile`) os valores em **centavos** (Int). A divisão por 100 está presente. **Correto.**

Mas na `BuscarScreen/mapApiToProf`, os preços **não são exibidos** no card de profissional (campo `precoLabel` não é calculado para diaristas, apenas para montadores). **Sem impacto de bug mas oportunidade perdida de UX.**

### 9.4 Disponibilidade cadastrada mas não validada na contratação

Conforme seção 7.3. A disponibilidade da diarista é capturada (backend `PUT /api/diarista/disponibilidade`) e exibida no perfil (`DiaristaPerfil.tsx:596-616`) mas **nunca usada como gate** na criação do serviço. Decorativa no fluxo atual.

### 9.5 Habilidades/DiaristaHabilidade — campo legado, não impacta completude

Fonte: `servicos/route.ts:375-386` (comentário GAP-D2)

`DiaristaHabilidade` era a fonte de verdade antes do T-12+. Hoje é legado. O campo continua sendo salvo via `/api/diarista/habilidades`, é exibido no perfil e retornado pela API pública, mas **a completude e a busca usam apenas `servicosOferecidos`**. Não é um bug, mas gera dados redundantes e confusão conceitual.

### 9.6 `SafeScoreProfile` pode não existir para usuários novos

Fonte: `safeScoreGuardian.ts:101-120`

```typescript
// dual-read: SafeScoreProfile (novo) → fallback SafeScore legado
const profile = await prisma.safeScoreProfile.findUnique(...)
if (profile) { return { score: profile.currentScore, tier: profile.tier }; }
const legacy = await prisma.safeScore.findUnique(...)
if (legacy) { return { score: legacy.score, tier: scoreToGuardianTier(legacy.score) }; }
return { score: 500, tier: "BRONZE" };
```

Se nem `SafeScoreProfile` nem `SafeScore` existem (usuário novo), o score default é 500 (BRONZE). Score 500 >= 400, então `scoreBaixo = false`. Isso é OK para score. O problema é que sem verificação (`PENDENTE`), `canAppearInSearch` é `false` de qualquer forma.

### 9.7 Bairros: texto livre sem validação de formato

No modal de área, os bairros são digitados em texto livre separados por vírgula. O `splitBairros` (`DiaristaPerfil.tsx:265-274`) aceita qualquer string com >= 2 chars. Não há autocomplete nem validação de bairro real. Combinado com o exact match no banco ao criar serviço, isso é um vetor de contratação quebrada (ver seção 7.2).

---

## 10. RISCOS PARA LANÇAMENTO

### CRÍTICO

1. **Verificação VERIFICADO bloqueada em produção sem processo de aprovação admin automatizado/mapeado.** A auto-aprovação só funciona com `AUTO_VERIFY_PROFILES=true` (exclusivo QA). Em produção, toda diarista fica em `PENDENTE` eternamente até aprovação manual via painel admin. O painel existe (`/api/admin/verificacoes/approve`) mas não está mapeado como parte do fluxo operacional documentado. Sem processo, nenhuma diarista aparece na busca.
   - **Fonte:** `autoVerificacao.ts:24-30` + `web/src/app/api/admin/verificacoes/approve/route.ts`

2. **Bairro exact-match pode impedir contratação de diaristas encontradas na busca.** A busca normaliza nomes de bairros (sem acentos, lowercase), mas `POST /api/servicos` exige exact match no banco (`findUnique` por `nome_cidade_uf`). Se empregador buscar por bairro diferente da grafia cadastrada, a contratação falha com erro `"Bairro não cadastrado."` — sem feedback claro ao usuário.
   - **Fonte:** `servicos/route.ts:356-360` vs `buscar/route.ts:32-39`

### ALTO

3. **Disponibilidade ignorada na contratação.** A diarista cadastra dias/turnos disponíveis, mas qualquer empregador pode solicitar qualquer data/turno. Expectativa de produto vs. comportamento real diferem.
   - **Fonte:** `servicos/route.ts` (sem join com `Disponibilidade`)

4. **Regra de completude divergente mobile↔backend (bio).** Mobile exige bio >= 20 chars; backend aceita qualquer bio não-vazia. A profissional vê 100% no app mas pode ser rejeitada pelo backend se tiver bio com 1-19 chars.
   - **Fonte:** `diaristaApi.ts:282` (`bio.trim().length >= 20`) vs `diaristaProfile.ts:139` (`!profile.bio?.trim()`)

5. **`perfilCompleto` recalculado no client com regra diferente.** O valor exibido ao empregador em `DiaristaProfileScreen` pode divergir do `perfilCompleto` retornado pela API, gerando inconsistência visual.
   - **Fonte:** `useDiaristaPublico.ts:154-191`

6. **Avaliações textuais inacessíveis ao empregador.** Comentários de avaliação não são retornados no endpoint público. O empregador só vê nota média e total — não os comentários que informariam a decisão de contratação.
   - **Fonte:** `diaristas/[userId]/route.ts:125-167` (sem campo `avaliacoes`)

### MÉDIO

7. **Disponibilidade não validada na busca.** A busca retorna diaristas independente de ter disponibilidade cadastrada. O empregador pode escolher uma diarista sem nenhum dia/turno configurado.

8. **Bairros em texto livre sem autocomplete.** Entrada manual de bairros por vírgula não garante consistência de nomes — aumenta risco do exact match falhar.

9. **Dois namespaces de `VerificacaoStatus` (mobile vs backend).** Risco de bug em manutenção futura. O mapeamento em `loadMe` funciona mas não é seguro por tipo.

10. **`SafeScoreProfile` criado on-demand?** Não identificado código que cria automaticamente `SafeScoreProfile` ao registrar novo usuário. Se não existir registro, o fallback retorna score 500 BRONZE, mas a ausência pode causar queries extras em toda busca.

### BAIXO

11. **`DiaristaHabilidade` legado acumula dados sem uso funcional.** Pode ser removido em limpeza futura sem impacto.

12. **Geolocalização opcional.** O toggle de geolocalização salva em `AsyncStorage` e pode divergir do backend. Sem impacto crítico de negócio.

---

## 11. RESPOSTAS ÀS QUESTÕES DO AUDITOR PRINCIPAL

**A Diarista consegue ser CONTRATADA ponta a ponta?**
Sim, se (e somente se): (1) verificação VERIFICADO aprovada manualmente por admin; (2) SafeScore profile existe com score >= 400; (3) bairro cadastrado via app com exata mesma grafia que o empregador informar; (4) Guardian do empregador também liberado. São 4 condições simultâneas — difícil de satisfazer em lançamento sem processo claro.

**O Empregador consegue ENCONTRÁ-LA (a busca retorna diaristas reais)?**
Não em produção real sem aprovação manual de verificação. Em staging/QA com `AUTO_VERIFY_PROFILES=true`, sim.

**O perfil PÚBLICO está consistente com o que a diarista cadastra?**
Majoritariamente sim, com exceção: `perfilCompleto` pode divergir (regra de bio), e avaliações textuais não são exibidas.

**Há campos/telas sem backend, dados mockados?**
- `DiaristaHabilidade` existe no backend mas é legado; o mobile ainda salva/exibe.
- Disponibilidade existe backend+mobile mas não é validada na contratação.
- Avaliações individuais retornadas ao próprio perfil da diarista (`/api/diarista/me`), mas não ao empregador (`/api/diaristas/[userId]`).
- Não foram identificados dados **mockados hardcoded** — todo dado vem do banco.

---

## 12. TABELA FINAL DE ACHADOS

| # | Item | Severidade | Evidência (arquivo:linha) | Impacto |
|---|---|---|---|---|
| 1 | Verificação VERIFICADO bloqueada em produção (sem auto-aprovação real) | CRÍTICO | `autoVerificacao.ts:24-30`, `buscar/route.ts:132` | Nenhuma diarista aparece na busca |
| 2 | Bairro exact-match impede contratação de diaristas encontradas na busca | CRÍTICO | `servicos/route.ts:356-360`, `buscar/route.ts:32-39` | Contratação falha silenciosamente |
| 3 | Disponibilidade cadastrada mas ignorada na criação do serviço | ALTO | `servicos/route.ts` (ausência de join `Disponibilidade`) | Produto enganoso; diarista recebe pedido fora de sua agenda |
| 4 | Bio: mínimo 20 chars no mobile vs qualquer valor no backend | ALTO | `diaristaApi.ts:282` vs `diaristaProfile.ts:139` | Inconsistência de completude; potencial 100% falso no mobile |
| 5 | `perfilCompleto` recalculado no client com regra diferente da API | ALTO | `useDiaristaPublico.ts:154` vs `diaristas/[userId]/route.ts:106` | Exibição inconsistente ao empregador |
| 6 | Avaliações textuais não retornadas no perfil público | ALTO | `diaristas/[userId]/route.ts:125-167` | Empregador decide sem ver comentários |
| 7 | Busca não valida disponibilidade antes de listar | MÉDIO | `buscar/route.ts` (ausência de filtro `agenda`) | Diarista sem disponibilidade aparece na busca |
| 8 | Bairros digitados em texto livre sem autocomplete/validação | MÉDIO | `DiaristaPerfil.tsx:265-274` | Aumenta risco do exact match falhar na contratação |
| 9 | Dois namespaces de `VerificacaoStatus` mobile vs backend | MÉDIO | `DiaristaPerfil.tsx:210-214`, `perfilApi.ts` | Risco de bug em manutenção |
| 10 | `nichoFromCategoria` não mapeia FAXINEIRA/LAVADEIRA/CUIDADORA | MÉDIO | `diaristaProfile.ts:99-106` | Potencial falha silenciosa se categoria passada sem tipo |
| 11 | `DiaristaHabilidade` legado acumula dados sem uso na completude/busca | BAIXO | `servicos/route.ts:375-386` (comentário GAP-D2) | Confusão conceitual; dados redundantes |
| 12 | Geolocalização mobile não sincronizada com estado do backend | BAIXO | `DiaristaPerfil.tsx:1160-1176` | Inconsistência de exibição; sem impacto crítico |
| 13 | SafeScoreProfile não criado automaticamente no cadastro | BAIXO | `safeScoreGuardian.ts:101-120` | Queries extras; fallback 500 cobre, mas frágil |
| 14 | precoFinal calculado sem validação de NaN na conversão Decimal | BAIXO | `servicos/route.ts:431` | Risco de `precoFinal = 0` para BABA/COZINHEIRA com valor inválido |

---

*Fim do relatório. Auditoria read-only — nenhum arquivo foi modificado.*
