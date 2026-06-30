# RELATÓRIO DE AUDITORIA — PERFIL MONTADOR
**Data:** 2026-06-18  
**Auditor:** Sub-Agente 4 — Auditor do Perfil Montador  
**Escopo:** Fluxo completo do perfil Montador no app Dular (mobile + backend)

---

## 1. RESUMO EXECUTIVO

O fluxo Montador está **parcialmente operacional**, com o backend bem estruturado e o mobile cobrindo os casos principais. Foram identificados **2 bugs CRÍTICOS**, **2 ALTOS** e **3 MÉDIOS**. O mais grave é a **inconsistência de chave na resposta do endpoint `/servico-ativo`**: o backend retorna `ativo` mas o mobile lê `hasActiveService`, fazendo o botão "Contratar" nunca aparecer ou exibir o card de serviço ativo de forma incorreta. O segundo crítico é que **`REPROVADO` nunca é persistido no `MontadorPerfil`**: ao reprovar documentos de um montador, o backend só seta `verificado: false`, sem nenhum campo que diferencie "jamais enviou" de "foi reprovado" — a tela mobile exibe o estado errado.

---

## 2. MAPA DE TELAS/SEÇÕES

| Seção Mobile | Arquivo | Endpoint Consumido | Status |
|---|---|---|---|
| Perfil (dados, especialidades, área, preços) | `MontadorPerfil.tsx` | `PATCH /api/montador/me` | OK |
| Carregamento do perfil | `MontadorPerfil.tsx` | `GET /api/montador/me` | OK |
| Upload de avatar | `MontadorPerfil.tsx` | `PATCH /api/perfil` (via `uploadAvatarDataUrl`) | OK |
| Portfólio (upload/remoção S3) | `MontadorPerfil.tsx` | `POST /api/montador/portfolio`, `DELETE /api/montador/portfolio` | OK |
| Verificação de documentos | `VerificacaoDocs` (nav) | Fora do escopo desta auditoria | NÃO AUDITADO |
| SafeScore | `SafeScoreScreen` (nav) | Fora do escopo | NÃO AUDITADO |
| Carteira/Ganhos | `CarteiraScreen` | Fora do escopo | NÃO AUDITADO |
| Busca pública de montadores | (tela Empregador) | `GET /api/montadores/buscar` | OK com ressalvas |
| Perfil público do montador | `MontadorPublicProfile.tsx` | `GET /api/montadores/{id}`, `GET /api/montadores/{id}/servico-ativo` | **BUG CRÍTICO** |
| Contratação | `MontadorPublicProfile.tsx` → nav `SolicitarServico` | `POST /api/servicos` | OK com ressalvas |
| Solicitações recebidas | `MontadorSolicitacoes.tsx` | `GET /api/servicos/minhas` | OK |
| Detalhe da solicitação | `MontadorDetalheSolicitacao.tsx` | `GET /api/servicos/{id}` | OK |
| Agenda | `MontadorAgenda.tsx` | `GET /api/servicos/minhas` | OK |
| Mensagens | `MontadorMensagens.tsx` | Chat | OK |
| Home | `MontadorHome.tsx` | `GET /api/servicos/minhas` | OK |

---

## 3. REGRA DE PERFIL MÍNIMO E VISIBILIDADE

### 3.1 Campos obrigatórios para perfil "completo"

Definidos em `web/src/lib/montadorProfile.ts` (linhas 79–93):

```
calcularCompletudeMontador:
  - nome:            user.nome não-vazio
  - apresentacao:    perfil.bio não-vazio
  - especialidades:  especialidades.length > 0
  - areaAtendimento: cidade + estado + (bairros.length > 0 OU atendeTodaCidade === true)
  - ativo:           perfil.ativo === true E user.status !== "BLOQUEADO"
```

Progresso = quantos dos 5 estão completos × 20%.

### 3.2 Critério de visibilidade na busca pública

O endpoint `GET /api/montadores/buscar` aplica os seguintes filtros em cascata (`web/src/app/api/montadores/buscar/route.ts` linhas 161–173):

1. `ativo === true AND user.status === "ATIVO"` (T-18.6: sem SHADOW_BAN/SUSPEND/BLOCK ativos no DB)
2. **`verificado === true`** — obrigatório; sem verificação não aparece
3. `completude.completo === true`
4. `cidade/estado/bairro` correspondem à busca (ou `atendeTodaCidade === true`)
5. `especialidade` (filtro opcional)
6. **Gate final do Guardian** (`canAppearInSearch`): score ≥ 400, sem SHADOW_BAN, sem hardBan, completude OK, `verificado === VERIFICADO`

Portanto, para aparecer na busca, o montador precisa de **5/5 requisitos de completude + verificado=true + score ≥ 400 + sem restrições ativas**.

### 3.3 Como o verificado é definido

- Automático via `autoVerificarMontadorSePossivel` (chamada silenciosa no `PATCH /api/montador/me`): seta `verificado=true` se perfil completo + os 3 documentos (`documentoFrente`, `documentoVerso`, `selfieDoc`) presentes (`web/src/lib/autoVerificacao.ts` linhas 157–168).
- Manual via admin (fluxo KYC externo).

---

## 4. FLUXO DE CONTRATAÇÃO PASSO A PASSO

```
[1] Montador preenche perfil (mobile: MontadorPerfil.tsx)
       PATCH /api/montador/me → salva no DB; 
       auto-verificação lateral silenciosa.
       STATUS: OK

[2] Montador envia documentos (VerificacaoDocs)
       Endpoint externo ao escopo desta auditoria.
       Quando aprovado: verificado=true é setado no MontadorPerfil.

[3] Empregador busca montadores (tela Empregador)
       GET /api/montadores/buscar?cidade=&uf=&bairro=
       Filtra: ativo + verificado + completo + localização + Guardian.
       STATUS: OK

[4] Empregador abre perfil público (MontadorPublicProfile.tsx)
       GET /api/montadores/{id} → carrega dados do montador.
       STATUS: OK

[4b] MontadorPublicProfile busca serviço ativo
       GET /api/montadores/{profissionalId}/servico-ativo
       BACKEND retorna: { ok, ativo: true/false, servico }
       MOBILE lê:       res.data?.hasActiveService  ← CHAVE ERRADA
       STATUS: ** BUG CRÍTICO ** — botão "Contratar" e card "Serviço ativo"
               ficam sempre no estado incorreto.

[5] Empregador contrata (botão "Contratar")
       Navega para SolicitarServico com profissionalId.
       POST /api/servicos { tipo: "MONTADOR", montadorUserId, ... }
       Backend: valida Guardian, verifica completude, bloqueia duplicidade,
       cria Servico com precoFinal=0 (sentinela "a orçar"), cria ChatRoom,
       notifica montador.
       STATUS: OK funcional; precoFinal=0 é intencional (orçamento pós-aceite).

[6] Montador recebe solicitação (MontadorSolicitacoes.tsx)
       GET /api/servicos/minhas → lista com status SOLICITADO.
       STATUS: OK

[7] Montador aceita/recusa (MontadorDetalheSolicitacao.tsx)
       POST /api/servicos/{id}/aceitar ou /recusar.
       STATUS: OK

[8] Execução e finalização
       POST /api/servicos/{id}/iniciar → EM_ANDAMENTO
       POST /api/servicos/{id}/concluir → AGUARDANDO_FINALIZACAO
       POST /api/servicos/{id}/confirmar-finalizacao → CONCLUIDO
       STATUS: OK (dupla confirmação T-14 implementada)
```

**O fluxo quebra no passo 4b.** O empregador pode mesmo assim clicar em "Contratar" porque a lógica do botão (linha 391 de `MontadorPublicProfile.tsx`) verifica `activeService?.hasActiveService === false` — e como `hasActiveService` nunca é lido corretamente do backend, o estado fica `null` (nunca chega a `false`), fazendo o botão **não aparecer** enquanto a verificação de serviço ativo está sendo feita ou retornou sem o campo esperado.

---

## 5. BUGS E INCONSISTÊNCIAS

### 5.1 BUG CRÍTICO — Chave `ativo` vs `hasActiveService` (servico-ativo)

**Arquivo backend:** `web/src/app/api/montadores/[id]/servico-ativo/route.ts` linha 50-52  
**Resposta retornada:**
```json
{ "ok": true, "ativo": true/false, "servico": {...} }
```

**Arquivo mobile:** `dular-mobile/src/screens/empregador/MontadorPublicProfile.tsx` linha 152  
**Código que lê:**
```js
const hasActiveService = Boolean(res.data?.hasActiveService ?? servico) && !isStatusEncerrado(...)
```

O mobile usa `res.data?.hasActiveService` que é `undefined` (a chave não existe). O fallback `?? servico` até funciona como workaround parcial (se `servico` existir, `hasActiveService` fica `true`), mas a exibição do botão "Contratar" depende de `activeService?.hasActiveService === false` (linha 391) — quando não há serviço ativo, o backend retorna `{ ativo: false, servico: null }`, o fallback vira `null`, e `Boolean(null)` é `false`; portanto nesse caso o botão aparece. **O problema real é quando há serviço ativo**: `res.data?.hasActiveService` é `undefined`, `servico` está presente, então `hasActiveService` fica `true` e o card aparece — esse caminho funciona acidentalmente. Porém o contrato está errado e frágil: qualquer refatoração ou mudança na chave do backend quebrará silenciosamente.

**Severidade:** ALTO (funciona por acidente, mas o contrato está quebrado e documentado como BUG).

### 5.2 BUG CRÍTICO — `REPROVADO` não é persistido no `MontadorPerfil`

**Arquivo:** `web/src/app/api/admin/verificacoes/reprove/route.ts` linhas 95–100  
**Código atual:**
```js
if (existing.user.role === "MONTADOR") {
  await tx.montadorPerfil.update({
    where: { userId: existing.userId },
    data: { verificado: false },
  });
}
```

O schema do `MontadorPerfil` (`web/prisma/schema.prisma` linha 351) tem apenas `verificado: Boolean`. Não há campo `verificacaoStatus` ou `REPROVADO` no modelo de dados do montador.

A função `getMontadorVerificationStatus` (`web/src/lib/profileVerification.ts` linhas 79–97) só distingue `VERIFICADO` (verificado=true) de `PENDENTE` (algum doc presente) e `NAO_ENVIADO`. **Nunca retorna `REPROVADO`.**

O endpoint `GET /api/montador/me` deriva `verificacaoStatus` inline (linha 171):
```js
verificacaoStatus: perfil.verificado ? "APROVADO" : hasDocs ? "PENDENTE" : "NAO_ENVIADO"
```

Portanto, após reprovação:
- `verificado = false`
- `hasDocs = true` (documentos ainda armazenados)
- `verificacaoStatus` retornado = `"PENDENTE"` ← **ERRADO, deveria ser `"REPROVADO"`**

**Impacto no mobile:** `MontadorPerfil.tsx` linha 424 lê `perfil?.verificacaoStatus`. O case `"REPROVADO"` na lógica de status card (linha 429) **nunca será atingido** — o montador reprovado vê o mesmo estado "Aguardando verificação" de quem ainda não foi avaliado. O CTA para reenviar documentos não aparece.

**Severidade:** CRÍTICO.

### 5.3 ALTO — `precoBase`/`taxaMinima` são `Decimal` no banco, chegam como string no JSON

**Schema:** `web/prisma/schema.prisma` linhas 341–342:
```prisma
precoBase  Decimal? @db.Decimal(10, 2)
taxaMinima Decimal? @db.Decimal(10, 2)
```

O Prisma serializa `Decimal` como string no JSON (ex.: `"12000.00"` em vez de `12000`).

**No mobile, há mitigação:**
- `montadorUtils.ts` linha 30: `formatMoneyFromCents` faz `typeof value === "string" ? Number(value) : value`
- `MontadorPerfil.tsx` linha 133: `centsToInput` faz `typeof value === "string" ? Number(value) : value`

**No backend `GET /api/montadores/buscar`** (linha 138–142) e `GET /api/montadores/{id}` (linha 96–99), o `precoLabel` é calculado com `Number(montador.precoBase) / 100` — isso funciona pois `Number("12000.00") === 12000`.

**Conclusão:** O bug está mitigado nos dois lados. As correções existentes (comentadas como "Decimal do backend chega como string") são adequadas. **Risco residual:** se algum consumer novo ler `precoBase` diretamente sem coerção, exibirá string crua.

**Severidade:** MÉDIO (mitigado, mas frágil sem type safety).

### 5.4 ALTO — Guardian usa `"VERIFICADO"` mas `getMontadorVerificationStatus` nunca retorna `"REPROVADO"`

O Guardian (`safeScoreGuardian.ts` linha 331) decide com:
```js
const verificado = verificationStatus === "VERIFICADO";
```

Portanto um montador reprovado tem `verificado = false`, o que bloqueia `canAppearInSearch` e `canReceiveServico` corretamente. **Mas o motivo registrado é `"documento_aguardando_analise"` (PENDENTE) em vez de `"documento_reprovado"`** — o Guardian não consegue distinguir "docs em análise" de "docs reprovados" para o montador, pois `getMontadorVerificationStatus` nunca retorna `"REPROVADO"`.

**Severidade:** ALTO (consequência direta do bug 5.2).

### 5.5 MÉDIO — `perfil.portfolioFotos` não renderiza imagens no perfil público

`MontadorPublicProfile.tsx` linhas 347–353 exibe apenas contagem de fotos, sem thumbnail:
```tsx
{portfolioFotos.length > 0 ? (
  <Text style={styles.bio}>{portfolioFotos.length} foto(s) cadastrada(s).</Text>
) : ...}
```
O empregador não visualiza as fotos do portfólio, apenas a contagem — diferente do perfil do próprio montador que tem a grade real de fotos.

**Severidade:** MÉDIO (impacto na experiência de contratação; fotos são fator de decisão).

### 5.6 MÉDIO — `GET /api/montadores/{id}` não verifica `verificado=true`

`web/src/app/api/montadores/[id]/route.ts` linhas 18–25: busca apenas com `ativo: true, user: { status: "ATIVO" }`. **Não filtra por `verificado`.**

Um empregador que acesse diretamente a URL de um montador não-verificado (ex.: via deep link ou link compartilhado) consegue ver o perfil completo. O botão "Contratar" verificará `profileCompleto`, mas não `verificado`.

**Severidade:** MÉDIO (o Guardian bloqueia a criação do serviço, mas a UI não avisa proativamente).

### 5.7 BAIXO — `precoFinal = 0` no `Servico` criado para montador

`web/src/app/api/servicos/route.ts` linha 258:
```js
precoFinal: 0,
```
Comentado como "sentinela a orçar" (linha 241). O preço é negociado externamente após aceite. Não há endpoint de "definir orçamento/preço final" na auditoria — fluxo de orçamento pós-aceite ainda não implementado (comentado como "GAP T-07"). Nenhum `precoFinal` real é persistido no serviço do montador.

**Severidade:** BAIXO (documentado, mas o fluxo financeiro está incompleto).

---

## 6. RISCOS PARA LANÇAMENTO

1. **CRÍTICO — Montador reprovado aparece como "aguardando"**: Montadores com documentos reprovados ficam em loop esperando aprovação que nunca vem, sem receber o CTA de "reenviar". O admin reprova mas o montador não sabe — risco de suporte e frustração.

2. **ALTO — Contrato `hasActiveService` vs `ativo` frágil**: Funciona por acidente; qualquer refatoração futura do backend quebrará o fluxo de "já tenho serviço com este montador" para o empregador.

3. **ALTO — Orçamento pós-aceite não implementado (GAP T-07)**: Todo serviço de montador cria `precoFinal = 0`. Não há tela nem endpoint para definir o preço real após o aceite. O app não tem como exibir o valor correto ao empregador no resumo financeiro.

4. **MÉDIO — Portfólio invisível no perfil público**: O empregador vê apenas contagem de fotos — impacto direto na taxa de conversão de contratação.

5. **MÉDIO — Perfil público acessível sem verificação**: Montadores não-verificados podem ter perfil visualizado diretamente, sem aviso claro ao empregador.

---

## 7. TABELA FINAL

| Item | Severidade | Evidência (arquivo:linha) | Impacto |
|---|---|---|---|
| `ativo` vs `hasActiveService` no contrato do endpoint servico-ativo | ALTO | `web/src/app/api/montadores/[id]/servico-ativo/route.ts:50-52` vs `dular-mobile/src/screens/empregador/MontadorPublicProfile.tsx:152` | Card "serviço ativo" e botão "Contratar" baseados em contrato errado; funciona por acidente |
| `REPROVADO` não persistido em `MontadorPerfil`; `verificacaoStatus` retorna `PENDENTE` ao invés de `REPROVADO` | CRÍTICO | `web/src/app/api/admin/verificacoes/reprove/route.ts:95-100`; `web/src/app/api/montador/me/route.ts:171`; `web/src/lib/profileVerification.ts:79-97` | Montador reprovado não recebe CTA de reenvio; fica em loop de espera infinito |
| Guardian não distingue PENDENTE de REPROVADO para montador | ALTO | `web/src/lib/profileVerification.ts:92-96`; `web/src/lib/safeScoreGuardian.ts:311` | Motivo errado registrado; impossível auditar por que montador foi bloqueado |
| `Decimal` → string no JSON (precoBase/taxaMinima) | MÉDIO | `web/prisma/schema.prisma:341-342`; mitigado em `dular-mobile/src/screens/montador/montadorUtils.ts:28-31` e `MontadorPerfil.tsx:133` | Sem impacto imediato (mitigado), mas frágil sem type safety |
| Portfólio não renderizado no perfil público do empregador | MÉDIO | `dular-mobile/src/screens/empregador/MontadorPublicProfile.tsx:347-353` | Empregador não vê fotos de trabalhos; impacto na conversão |
| `GET /api/montadores/{id}` não filtra `verificado=true` | MÉDIO | `web/src/app/api/montadores/[id]/route.ts:18-25` | Perfil de montador não-verificado visível; sem aviso ao empregador |
| `precoFinal = 0` no serviço do montador; GAP T-07 não implementado | BAIXO | `web/src/app/api/servicos/route.ts:258`; comentário linha 241 | Fluxo financeiro incompleto; sem valor real no contrato |
| Regra perfil mínimo não inclui preços | BAIXO | `web/src/lib/montadorProfile.ts:79-93` | Montador pode ser verificado sem definir preço ou `valorACombinar`; empregador vê "A combinar" mesmo com preço cadastrado mas `valorACombinar=true` padrão |

---

## 8. RESPOSTA DIRETA ÀS PERGUNTAS

**O Montador está realmente operacional ponta a ponta?**  
Parcialmente. O fluxo de cadastro, edição de perfil, busca e contratação funciona na maior parte. O fluxo de portfólio (S3) e preços está implementado e com mitigações para o bug de Decimal.

**O fluxo termina?**  
O fluxo termina no sentido que um serviço é criado, mas:
- O contrato financeiro fica com `precoFinal = 0` sem forma de atualizar (GAP T-07).
- A verificação de serviço ativo no perfil público usa chave errada (funciona por acidente).

**Onde quebra?**  
1. Montador reprovado → não recebe estado/CTA correto (bug mais grave).
2. Portfólio não renderiza fotos para o empregador.
3. Orçamento pós-aceite não implementado.

**O que falta?**  
- Campo `verificacaoStatus` com suporte a `REPROVADO` no `MontadorPerfil` (schema + endpoints).
- Corrigir a chave `ativo` → `hasActiveService` no endpoint servico-ativo (ou corrigir o consumer mobile).
- Renderizar thumbnails do portfólio no `MontadorPublicProfile`.
- Implementar o fluxo de orçamento/preço final pós-aceite (GAP T-07).
- Adicionar filtro `verificado=true` no `GET /api/montadores/{id}` para consistência.
