# RELATÓRIO DE AUDITORIA — FLUXOS COMPLETOS (SUB-AGENTE 6)

**Data:** 2026-06-18  
**Escopo:** Engenharia reversa de fluxos ponta-a-ponta (mobile → backend → mobile)  
**Metodologia:** Read-only. Toda afirmação com evidência `arquivo:linha`.

---

## RESUMO EXECUTIVO

O monorepo Dular apresenta **quatro problemas CRÍTICOS** e **três ALTO** nos fluxos auditados:

1. **CRÍTICO** — O status `INICIADO` é usado pelo mobile (múltiplos arquivos) mas **não existe no enum `ServicoStatus` do schema Prisma**. O backend só persiste `EM_ANDAMENTO`. O mobile exibe estados "INICIADO" que nunca chegam do backend, criando divergência de lógica de exibição.
2. **CRÍTICO** — O campo `valorEstimado` é consumido pelo mobile do Montador (5 arquivos) mas **não existe no modelo `Servico` do schema**. O backend nunca retorna esse campo, então o valor mostrado ao montador é sempre `undefined` → `0` → "R$ 0,00".
3. **CRÍTICO** — A tela de sucesso pós-criação (`SolicitacaoSucessoScreen`) exibe **protocolo hard-coded** `#SD250514-8K7D` e ignora o `servicoId` real recebido como parâmetro de navegação.
4. **CRÍTICO** — O preço estimado no resumo de confirmação do serviço de Diarista é **hard-coded em "R$ 160,00"** para todos os serviços, sem consumir `precoFinal` calculado pelo backend.
5. **ALTO** — `securityLevel` (`"NORMAL" | "REFORCADO"`) é lido pelo mobile da Diarista (`DiaristaSolicitacoes:119`) mas **nunca é setado pelo backend** em `/api/servicos/minhas`. O campo sempre chegará `undefined`, o badge "Segurança reforçada" nunca exibe.
6. **ALTO** — Fluxo de avaliação pós-CONCLUIDO tem **caminho duplo inconsistente**: o empregador pode chamar `/confirmar-finalizacao` (correto, T-14) ou `/confirmar` (legado, CONCLUIDO → CONFIRMADO). A tela `EmpregadorDetalhe` seleciona o path baseado no status atual, mas a lógica é frágil se o polling atualizar o status entre a renderização e o clique.
7. **ALTO** — `chatLiberado` no `EmpregadorDetalhe` (linha 172) só abre chat para `ACEITO | INICIADO | EM_ANDAMENTO`. Quando o serviço está em `AGUARDANDO_FINALIZACAO`, o chat fecha para o empregador — **dead-end de comunicação** justo quando as partes mais precisam negociar.

---

## FLUXO 1 — Empregador contrata Diarista

### Diagrama passo a passo

```
[EMPREGADOR — BuscarScreen]
    └─→ DiaristaProfileScreen (hook useDiaristaPublico)
            └─→ handleContratar() → navigate("SolicitarServico", {profissionalId, categoriaInicial, tipoInicial: "DIARISTA"})
                    └─→ [ServiceFlowProvider] draft preenchido com profissionalId
                            └─→ EscolherServicoScreen (step 1)        ✅ OK
                                └─→ EscolherDataScreen (step 2)       ✅ OK
                                    └─→ EnderecoServicoScreen (step 3) ✅ OK
                                        └─→ ObservacoesServicoScreen (step 4) ✅ OK
                                            └─→ ConfirmarSolicitacaoScreen (step 5)
                                                    └─→ prepararPayload(draft) → CriarServicoPayload
                                                    └─→ POST /api/servicos  {tipo, categoria, dataISO, turno, cidade, uf, bairro, diaristaUserId, …}
                                                            └─→ Backend cria Servico {status: "SOLICITADO"} + ChatRoom + notifica diarista
                                                    └─→ navigate("SolicitacaoSucesso", {servicoId: result.servicoId})
                                                            └─→ SolicitacaoSucessoScreen — EXIBE PROTOCOLO HARD-CODED
```

| Etapa | Status | Evidência |
|-------|--------|-----------|
| BuscarScreen → DiaristaProfileScreen | OK | `BuscarScreen.tsx:100` (categorias), `DiaristaProfileScreen.tsx:158` (navigate) |
| handleContratar passa profissionalId | OK | `DiaristaProfileScreen.tsx:158-163` |
| ServiceFlow 5 passos | OK | `EmpregadorServiceFlowNavigator.tsx:62-72` |
| prepararPayload / criarServico POST | OK | `empregadorApi.ts:100-188`, `ConfirmarSolicitacaoScreen.tsx:62-76` |
| Backend cria Servico SOLICITADO + ChatRoom + notif. | OK | `web/src/app/api/servicos/route.ts:445-483` |
| SolicitacaoSucesso usa servicoId real | **QUEBRA** | `SolicitacaoSucessoScreen.tsx:48` — protocolo `#SD250514-8K7D` hard-coded; `servicoId` ignorado |
| Preço exibido no resumo (não-montador) | **QUEBRA** | `ConfirmarSolicitacaoScreen.tsx:168` — `"R$ 160,00"` fixo para todos os serviços de Diarista |

**O ciclo FECHa** para criação, mas a tela de sucesso é fictícia (protocolo falso).

---

## FLUXO 2 — Empregador contrata Montador

### Diagrama passo a passo

```
[EMPREGADOR — BuscarScreen / MontadorPublicProfile]
    └─→ navigate("SolicitarServico", {tipoInicial: "MONTADOR", profissionalId, …})
            └─→ SolicitarServicoScreen: exibe MONTADOR_ESPECIALIDADES, requer especialidadeId
                    └─→ EscolherDataScreen, EnderecoServicoScreen, ObservacoesServicoScreen (obs >= 20 chars)
                            └─→ ConfirmarSolicitacaoScreen
                                    └─→ prepararPayload → {tipo: "MONTADOR", montadorUserId, categoriaBackend, observacoes}
                                    └─→ POST /api/servicos — precoFinal = 0 (sentinela "a orçar")
                                            └─→ Servico criado {status: "SOLICITADO", precoFinal: 0} + ChatRoom + notifica montador
                                    └─→ navigate("SolicitacaoSucesso", {servicoId}) — protocolo falso

[MONTADOR — MontadorSolicitacoes]
    └─→ useMontadorServicos → GET /api/servicos/minhas
            └─→ lista serviços com montadorId = auth.userId
            └─→ Exibe cartão com valorEstimado ?? precoFinal  ← QUEBRA: valorEstimado não existe no backend
                    └─→ aceitarSolicitacaoMontador → POST /api/servicos/{id}/aceitar ✅
```

| Etapa | Status | Evidência |
|-------|--------|-----------|
| Navigate para flow com profissionalId do montador | OK | `SolicitarServicoScreen.tsx:46-54`, `MontadorPublicProfile.tsx` (não lido diretamente, mas path existe) |
| SolicitarServicoScreen exige especialidade | OK | `SolicitarServicoScreen.tsx:33-34` |
| POST /api/servicos branch MONTADOR | OK | `web/src/app/api/servicos/route.ts:169-285` |
| Notificação ao montador | OK | `route.ts:277-284` |
| MontadorSolicitacoes busca /minhas | OK | `MontadorSolicitacoes.tsx:189`, `useMontadorServicos` |
| Valor exibido ao montador (valorEstimado) | **QUEBRA** | `MontadorSolicitacoes.tsx:140` — `valorEstimado` nunca retornado pelo backend; schema não tem esse campo; precoFinal = 0 mostrará "R$ 0,00" |
| Protocolo pós-criação | **QUEBRA** | `SolicitacaoSucessoScreen.tsx:48` hard-coded |

**O ciclo FECHA** para criação e notificação. O valor exibido ao montador é sempre R$ 0,00.

---

## FLUXO 3 — Cadastro → Perfil → Busca → Contratação

### Diagrama passo a passo

```
[App inicia — RootNavigator]
    └─→ isAuthenticated = false → OnboardingNavigator (Splash → Onboarding → RoleSelect → Login)
    └─→ isAuthenticated = true, user.genero == null → GeneroGateScreen            ✅ OK
            └─→ updateGenero() → PATCH /api/me/genero → setUser({genero}) → gate some
    └─→ role = "DIARISTA" e servicosOferecidos.length === 0 → NichosGateScreen    ✅ OK
            └─→ patchDiaristaPerfil({servicosOferecidos}) → setServicosOferecidos → gate some
    └─→ role = "MONTADOR" → MontadorNavigator direto (SEM gate de especialidades)  ← INCOMPLETO
    └─→ role = "EMPREGADOR" → EmpregadorNavigator → Home → BuscarScreen
            └─→ useBuscar → GET /api/diaristas/buscar ou /api/montadores/buscar
                    └─→ DiaristaProfileScreen / MontadorPublicProfile
                            └─→ handleContratar → navigate("SolicitarServico") → fluxo 1 ou 2
```

| Etapa | Status | Evidência |
|-------|--------|-----------|
| Onboarding / RoleSelect / Login | OK | `RootNavigator.tsx:121-127`, `OnboardingNavigator.tsx` |
| Gate de gênero (todos roles) | OK | `RootNavigator.tsx:27-33` |
| Gate de serviços oferecidos (DIARISTA) | OK | `RootNavigator.tsx:48-52` |
| Gate de especialidades (MONTADOR) | **INCOMPLETO** | `RootNavigator.tsx:61-67` — MONTADOR entra direto no app sem gate de especializações |
| Busca → Perfil → Contratar | OK | `BuscarScreen.tsx`, `DiaristaProfileScreen.tsx`, `MontadorPublicProfile.tsx` |
| Verificação do empregador pré-criação | OK | `ConfirmarSolicitacaoScreen.tsx:31-35` (local) + `route.ts:98` (Guardian) |

**Observação MÉDIO:** O MONTADOR não passa por nenhum gate pós-login para definir especialidades/serviços, ao contrário da DIARISTA. O perfil pode ficar incompleto sem aviso na entrada.

---

## FLUXO 4 — Ciclo de vida do Serviço

### Máquina de estados real (enum `ServicoStatus` — schema.prisma:134-145)

```
RASCUNHO
SOLICITADO
ACEITO
RECUSADO
CANCELADO
EM_ANDAMENTO
AGUARDANDO_FINALIZACAO
CONCLUIDO
CONFIRMADO
FINALIZADO
```

**Nota:** `INICIADO` **NÃO É** um valor válido do enum. O mobile usa `INICIADO` em múltiplos lugares como alias não-oficial de `EM_ANDAMENTO`.

### Transições e endpoints

| De → Para | Endpoint | Existe? | Ator |
|-----------|----------|---------|------|
| (criação) → SOLICITADO | POST /api/servicos | ✅ | EMPREGADOR |
| SOLICITADO → ACEITO | POST /api/servicos/{id}/aceitar | ✅ | DIARISTA/MONTADOR |
| SOLICITADO → RECUSADO | POST /api/servicos/{id}/recusar | ✅ | DIARISTA/MONTADOR |
| ACEITO → EM_ANDAMENTO | POST /api/servicos/{id}/iniciar | ✅ | DIARISTA/MONTADOR |
| EM_ANDAMENTO → AGUARDANDO_FINALIZACAO | POST /api/servicos/{id}/confirmar-finalizacao | ✅ | qualquer parte |
| AGUARDANDO_FINALIZACAO → CONCLUIDO | POST /api/servicos/{id}/confirmar-finalizacao | ✅ | outra parte |
| EM_ANDAMENTO → AGUARDANDO_FINALIZACAO (via legado) | POST /api/servicos/{id}/concluir | ✅ | DIARISTA/MONTADOR |
| CONCLUIDO → CONFIRMADO | POST /api/servicos/{id}/confirmar | ✅ | EMPREGADOR |
| CONFIRMADO → FINALIZADO | POST /api/servicos/{id}/avaliar | ✅ | EMPREGADOR |
| qualquer ativo → CANCELADO | POST /api/servicos/{id}/cancelar | ✅ | ambos |
| ACEITO → reagendar | PATCH /api/servicos/{id}/reagendar | ✅ | DIARISTA/MONTADOR propõe; EMPREGADOR decide |

### Diagrama textual (caminho feliz)

```
[SOLICITADO]
    ├─→ (Profissional aceita) → [ACEITO]
    │       ├─→ (Profissional inicia) → [EM_ANDAMENTO]
    │       │       ├─→ (qualquer parte confirma 1x) → [AGUARDANDO_FINALIZACAO]
    │       │       │       └─→ (outra parte confirma) → [CONCLUIDO]
    │       │       │                └─→ (Empregador confirma /confirmar) → [CONFIRMADO]
    │       │       │                        └─→ (Empregador avalia /avaliar) → [FINALIZADO] ✅
    │       │       └─→ (Profissional chama /concluir, legado) → [AGUARDANDO_FINALIZACAO] → ... idem
    │       └─→ (Qualquer parte cancela) → [CANCELADO]
    └─→ (Profissional recusa) → [RECUSADO]
```

### Etapas do ciclo e status

| Etapa | Status | Evidência |
|-------|--------|-----------|
| SOLICITADO aparece corretamente para Diarista | OK | `DiaristaSolicitacoes.tsx:100` |
| SOLICITADO aparece corretamente para Montador | OK | `MontadorSolicitacoes.tsx:38-44` |
| Aceite Diarista → ACEITO | OK | `DiaristaSolicitacoes.tsx:163`, `route.ts aceitar:67-73` |
| Aceite Montador → ACEITO | OK | `MontadorSolicitacoes.tsx:197-215`, `route.ts aceitar:67-73` |
| Notif. ao empregador no aceite | OK | `route.ts aceitar:91-97` |
| Iniciar (ACEITO → EM_ANDAMENTO) | OK | `DiaristaSolicitacoes.tsx:461`, `DiaristaDetalhe.tsx:371`, `MontadorDetalheServico.tsx:79`, `route.ts iniciar:30-33` |
| Status "INICIADO" no mobile sem correspondência no schema | **QUEBRA** | `DiaristaSolicitacoes.tsx:470`, `DiaristaDetalhe.tsx:332`, `EmpregadorDetalhe.tsx:50,64` — banco nunca persiste "INICIADO" |
| Confirmar finalização dupla | OK | `confirmar-finalizacao/route.ts`, `concluir/route.ts` |
| Notif. em AGUARDANDO_FINALIZACAO | OK | `concluir/route.ts:94-100`, `confirmar-finalizacao/route.ts:108-113` |
| Empregador confirma CONCLUIDO → CONFIRMADO | OK | `confirmar/route.ts:27-41` |
| Avaliação CONFIRMADO → FINALIZADO | OK | `avaliar/route.ts:11-91` |
| Chat ativo em AGUARDANDO_FINALIZACAO (empregador) | **QUEBRA** | `EmpregadorDetalhe.tsx:172` — `chatLiberado` só inclui `ACEITO|INICIADO|EM_ANDAMENTO`; AGUARDANDO_FINALIZACAO excluído |
| `securityLevel` retornado pelo backend | **QUEBRA** | Não há campo em `/api/servicos/minhas/route.ts`; `shared/types/servico.ts:78` declara mas backend nunca popula |
| Avaliação pelo profissional | **INCOMPLETO** | Endpoint /avaliar aceita só EMPREGADOR (`avaliar/route.ts:15-18`); não há avaliação reversa do profissional |

---

## DEAD-ENDS E DIVERGÊNCIAS ENTRE PONTAS

### Dead-ends

| Situação | Evidência |
|----------|-----------|
| Status `AGUARDANDO_FINALIZACAO`: chat fecha para empregador | `EmpregadorDetalhe.tsx:172` — sem `AGUARDANDO_FINALIZACAO` na lista `chatLiberado` |
| Status `FINALIZADO`: sem ação disponível para o profissional (sem avaliação inversa, sem ação de pagamento) | `DiaristaDetalhe.tsx:401-406` — só exibe mensagem estática "Serviço finalizado. Obrigada!" |
| Montador pós-`CONCLUIDO`: nenhuma CTA disponível para solicitar pagamento ou avaliar | `MontadorDetalheServico.tsx:230-237` — exibe apenas "Serviço finalizado." |
| Protocolo pós-criação é fictício | `SolicitacaoSucessoScreen.tsx:48` — `#SD250514-8K7D` hard-coded |

### Divergências entre pontas (frontend vs backend)

| Campo | Mobile usa | Backend retorna | Impacto |
|-------|-----------|-----------------|---------|
| `status = "INICIADO"` | 6+ locais | Nunca — enum só tem `EM_ANDAMENTO` | Lógica condicional no mobile para "INICIADO" nunca dispara via dados reais |
| `valorEstimado` | `MontadorSolicitacoes.tsx:140`, `CarteiraScreen.tsx:22`, etc. | Não existe em `Servico` (schema) nem em `/api/servicos/minhas` | Montador vê R$ 0,00 como valor |
| `precoFinal = 0` (Montador) | Interpretado como "a orçar" | Backend cria com 0 como sentinela (`route.ts:242`) | Congruente semanticamente, mas UI do Montador não exibe "A orçar" — exibe "R$ 0,00" via `formatMoneyFromCents(0)` |
| Preço exibido na confirmação de Diarista | "R$ 160,00" hard-coded | `precoFinal` calculado dinamicamente | Usuário vê sempre R$ 160 independente do serviço/preço da profissional |
| `securityLevel` | Lido em `DiaristaSolicitacoes.tsx:119` | Nunca incluído na resposta de `/api/servicos/minhas` | Badge "Segurança reforçada" nunca aparece |
| `servicoId` na SolicitacaoSucesso | Recebido via `route.params` mas ignorado | Backend retorna `servicoId` real em `{ok: true, servicoId}` | Protocolo falso exibido ao usuário |

---

## TABELA FINAL DE ACHADOS

| Fluxo/Etapa | Severidade | Evidência (arquivo:linha) | Impacto |
|-------------|------------|--------------------------|---------|
| Protocolo fictício na tela de sucesso | CRÍTICO | `SolicitacaoSucessoScreen.tsx:48` | Usuário vê protocolo `#SD250514-8K7D` fixo; não pode usar para rastrear pedido |
| Preço hard-coded "R$ 160,00" (Diarista) | CRÍTICO | `ConfirmarSolicitacaoScreen.tsx:168` | Usuário sempre vê R$ 160 no resumo, sem relação com o preço real da profissional |
| `valorEstimado` inexistente no backend | CRÍTICO | `MontadorSolicitacoes.tsx:140`, `schema.prisma` (ausência) | Montador sempre vê R$ 0,00 como valor do serviço |
| Status `INICIADO` não existe no enum | CRÍTICO | `DiaristaSolicitacoes.tsx:470`, `DiaristaDetalhe.tsx:332`, `EmpregadorDetalhe.tsx:50`, `schema.prisma:134-145` | Toda lógica condicional baseada em "INICIADO" nunca dispara com dados reais |
| Chat fecha em AGUARDANDO_FINALIZACAO | ALTO | `EmpregadorDetalhe.tsx:172` | Empregador perde acesso ao chat justamente quando pode precisar negociar finalização |
| `securityLevel` nunca populado pelo backend | ALTO | `DiaristaSolicitacoes.tsx:119`, `minhas/route.ts` (ausência) | Badge "Segurança reforçada" nunca exibe para a diarista |
| Caminho duplo de confirmação (frágil) | ALTO | `EmpregadorDetalhe.tsx:211-225`, `confirmar/route.ts`, `confirmar-finalizacao/route.ts` | Race condition: polling pode atualizar status entre render e clique, chamando endpoint errado |
| Gate de especialidades ausente para MONTADOR | MÉDIO | `RootNavigator.tsx:61-67` | Montador entra no app sem definir especialidades, ao contrário da diarista |
| Avaliação reversa ausente (profissional avalia empregador) | MÉDIO | `avaliar/route.ts:15-18` | Profissional não pode avaliar o empregador após o serviço |
| FINALIZADO sem CTA para profissional | MÉDIO | `DiaristaDetalhe.tsx:401-406`, `MontadorDetalheServico.tsx:230-237` | Dead-end: serviço finalizado mas profissional não tem nenhuma ação disponível |
| `precoFinal=0` (Montador) exibido como R$ 0,00 | MÉDIO | `CarteiraScreen.tsx:22`, `MontadorDetalheServico.tsx:173` | UI ambígua: "0" é sentinela "a orçar" mas exibe como zero monetário |
