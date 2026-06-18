# RELATÓRIO DE AUDITORIA — PERFIL EMPREGADOR

**Data:** 2026-06-18  
**Auditor:** Sub-Agente 2 (read-only)  
**Escopo:** Fluxo completo do Empregador no app Dular  

---

## 1. RESUMO EXECUTIVO

O fluxo de contratação do Empregador está **parcialmente funcional**: o caminho crítico (busca → perfil → contratar → `POST /api/servicos` → Servico criado no banco) existe e é executável ponta a ponta. A avaliação também está implementada ponta a ponta. Porém há **dois dados mockados/hardcoded críticos** na tela de confirmação, **uma falha de cobertura no detalhamento do montador** e **um bairro de atendimento hardcoded** na Home que pode enganar o usuário sobre a localização real da profissional.

---

## 2. MAPA DE TELAS DO EMPREGADOR

| Tela | Arquivo | O que faz | Endpoint consumido | Status |
|---|---|---|---|---|
| EmpregadorHome | `dular-mobile/src/screens/empregador/EmpregadorHome.tsx` | Home com profissionais sugeridos, categorias e ações rápidas | `GET /api/diaristas/buscar` | FUNCIONAL (com dados mockados) |
| BuscarScreen | `dular-mobile/src/screens/empregador/BuscarScreen.tsx` | Busca diaristas e montadores por localização/categoria | `GET /api/diaristas/buscar` + `useBuscar` hook (montadores) | FUNCIONAL |
| DiaristaProfileScreen | `dular-mobile/src/screens/empregador/DiaristaProfileScreen.tsx` | Perfil público da diarista + botão Contratar | `GET /api/diaristas/[id]` via `useDiaristaPublico` | FUNCIONAL |
| MontadorPublicProfile | `dular-mobile/src/screens/empregador/MontadorPublicProfile.tsx` | Perfil público do montador + botão Contratar | `GET /api/montadores/[id]` | FUNCIONAL (parcialmente) |
| SolicitarServicoScreen | `dular-mobile/src/screens/empregador/service-flow/SolicitarServicoScreen.tsx` | Seleção de categoria/serviço no flow | Sem chamada de API | FUNCIONAL |
| EscolherDataScreen | `dular-mobile/src/screens/empregador/service-flow/EscolherDataScreen.tsx` | Calendário + horário | Sem chamada de API | FUNCIONAL |
| EnderecoServicoScreen | `dular-mobile/src/screens/empregador/service-flow/EnderecoServicoScreen.tsx` | Endereço pré-preenchido do perfil | Sem chamada de API | FUNCIONAL |
| ObservacoesServicoScreen | `dular-mobile/src/screens/empregador/service-flow/ObservacoesServicoScreen.tsx` | Observações e chips | Sem chamada de API | FUNCIONAL |
| ConfirmarSolicitacaoScreen | `dular-mobile/src/screens/empregador/service-flow/ConfirmarSolicitacaoScreen.tsx` | Resumo + confirmar → cria serviço | `POST /api/servicos` | FUNCIONAL COM DADOS MOCKADOS |
| SolicitacaoSucessoScreen | `dular-mobile/src/screens/empregador/service-flow/SolicitacaoSucessoScreen.tsx` | Tela de sucesso após contratação | Nenhum | DADOS MOCKADOS |
| AgendamentosEmpregadorScreen | `dular-mobile/src/screens/empregador/AgendamentosEmpregadorScreen.tsx` | Lista serviços ativos com filtros | `GET /api/servicos/minhas` | FUNCIONAL |
| EmpregadorDetalhe | `dular-mobile/src/screens/empregador/EmpregadorDetalhe.tsx` | Detalhe do serviço, CTA de finalização, avaliação | `GET /api/servicos/minhas` + `/confirmar-finalizacao` + `/confirmar` + `/cancelar` + `/[id]/avaliar` | FUNCIONAL |
| EmpregadorPerfil | `dular-mobile/src/screens/empregador/EmpregadorPerfil.tsx` | Perfil do empregador, verificação, localização, edição | `GET /api/me` + `PATCH /api/me` + `POST /api/localizacao` | FUNCIONAL |
| FavoritosEmpregadorScreen | `dular-mobile/src/screens/empregador/FavoritosEmpregadorScreen.tsx` | Lista favoritos | `GET /api/empregador/favoritos` | FUNCIONAL |
| HistoricoEmpregadorScreen | `dular-mobile/src/screens/empregador/HistoricoEmpregadorScreen.tsx` | Lista serviços encerrados | `GET /api/servicos/minhas` | FUNCIONAL |
| MensagensEmpregadorScreen | `dular-mobile/src/screens/empregador/MensagensEmpregadorScreen.tsx` | Lista conversas | `useMensagens` hook | FUNCIONAL |
| NotificacoesEmpregadorScreen | `dular-mobile/src/screens/empregador/NotificacoesEmpregadorScreen.tsx` | Lista notificações | `useNotificacoes` hook | FUNCIONAL |
| AcoesRapidasEmpregadorScreen | `dular-mobile/src/screens/empregador/AcoesRapidasEmpregadorScreen.tsx` | Atalhos de navegação | Nenhum (só navegação) | FUNCIONAL (nav only) |
| CategoriasTodasScreen | `dular-mobile/src/screens/empregador/CategoriasTodasScreen.tsx` | Grid de todas as categorias | Nenhum | FUNCIONAL (nav only) |
| ProfissionaisSugeridosScreen | `dular-mobile/src/screens/empregador/ProfissionaisSugeridosScreen.tsx` | Versão expandida de sugeridos | `useBuscar` | FUNCIONAL |
| ProfissionaisDestaqueScreen | `dular-mobile/src/screens/empregador/ProfissionaisDestaqueScreen.tsx` | "Profissionais em destaque" | `useBuscar` (sem critério de destaque real) | FUNCIONAL (sem critério dedicado) |
| DadosContaScreen | `dular-mobile/src/screens/empregador/DadosContaScreen.tsx` | Dados pessoais da conta | `GET/PATCH /api/me` | FUNCIONAL |

---

## 3. FLUXO DE CONTRATAÇÃO PASSO A PASSO

### 3.1 Fluxo Diarista (verificado que TERMINA)

```
1. Empregador abre BuscarScreen (BuscarScreen.tsx)
   → GET /api/diaristas/buscar?cidade=X&uf=Y&bairro=Z
   → Backend: filtra ativo+verificado+completude+Guardian → retorna lista

2. Toca em "Ver perfil" → navega para DiaristaProfile (DiaristaProfileScreen.tsx)
   → GET /api/diaristas/[diaristaId] via useDiaristaPublico
   → Exibe bio, preços, áreas, segurança, SafeScore

3. Toca em "Contratar" → verifica diarista.perfilCompleto
   → navigation.navigate("SolicitarServico", { categoriaInicial, tipoInicial: "DIARISTA", profissionalId, profissionalNome })
   → Abre EmpregadorServiceFlowNavigator com ServiceFlowProvider

4. SolicitarServicoScreen: seleção de categoria (pré-selecionada pelo step 3)
   → updateDraft({ categoria, tipo })

5. EscolherDataScreen: calendário + horário
   → updateDraft({ dataISO, horario })

6. EnderecoServicoScreen: pré-preenche cidade/UF/bairro do authUser
   → pede rua + numero
   → updateDraft({ rua, numero, complemento, bairro, cidade, uf })

7. ObservacoesServicoScreen: observações e chips
   → updateDraft({ observacoes, chips })

8. ConfirmarSolicitacaoScreen: chama prepararPayload(draft) → CriarServicoPayload
   → Checa empregadorVerificado (local) e verifica GUARDIAN_BLOCKED
   → POST /api/servicos { tipo, dataISO, turno, cidade, uf, bairro,
                          diaristaUserId, enderecoCompleto, observacoes }
   → Backend: assertGuardianCanCreateServico → checkFeatureAccess →
              valida campos → findActiveServiceBetween → prisma.servico.create
              → upsert ChatRoom → criarNotificacao
   → Retorna { ok: true, servicoId }

9. SolicitacaoSucessoScreen: exibe protocolo MOCK #SD250514-8K7D
   → Botão "Acompanhar solicitações" → navega para Agendamentos

STATUS: FLUXO COMPLETA. Servico.status = "SOLICITADO" criado no banco.
```

**Onde pode quebrar:**
- Passo 6: se o empregador não tiver cidade/UF salvo no perfil → Alert bloqueante (`EnderecoServicoScreen.tsx:44-46`). Não continua sem localização.
- Passo 8: se bairro não estiver cadastrado no banco → backend retorna 400 "Bairro não cadastrado" (`route.ts:359`). Usuário vê o erro mas não pode prosseguir sem o bairro cadastrado.
- Passo 8: se precoFinal ≤ 0 para diaristas que não são `valorACombinar` → backend retorna 400 (`route.ts:438-443`). Bloqueia contratatação silenciosamente se a profissional não configurou preço.

---

## 4. TELAS SEM BACKEND / DADOS MOCKADOS

### 4.1 CRÍTICO — Valor estimado hardcoded em ConfirmarSolicitacaoScreen

**Arquivo:** `dular-mobile/src/screens/empregador/service-flow/ConfirmarSolicitacaoScreen.tsx:168`

```tsx
<Text ...>{isMontador ? "A orçar" : "R$ 160,00"}</Text>
```

O campo "Valor estimado" exibido ao usuário antes de confirmar a contratação é **fixo em R$ 160,00** para qualquer diarista, independente do preço real cadastrado no perfil da profissional. O `precoFinal` real só é calculado no backend após o POST. O usuário não vê o valor correto antes de confirmar.

### 4.2 CRÍTICO — Protocolo de sucesso mockado em SolicitacaoSucessoScreen

**Arquivo:** `dular-mobile/src/screens/empregador/service-flow/SolicitacaoSucessoScreen.tsx:47`

```tsx
<Text style={s.protocolValue}>#SD250514-8K7D</Text>
<Text ...>Enviado há 1 min</Text>
```

O número de protocolo `#SD250514-8K7D` e o texto "Enviado há 1 min" são **hardcoded**. O `servicoId` retornado pelo backend em `criarServico()` é passado para a rota `SolicitacaoSucesso` via `navigation.navigate("SolicitacaoSucesso", { servicoId: result.servicoId })` (`ConfirmarSolicitacaoScreen.tsx:76`), mas a tela de sucesso **não usa esse servicoId** — exibe sempre o mesmo protocolo falso.

### 4.3 ALTO — Dados mockados no card de profissional na Home

**Arquivo:** `dular-mobile/src/screens/empregador/EmpregadorHome.tsx:63-73`

```tsx
function diaristaToProf(item: DiaristaItem): ProfData {
  return {
    ...
    anos: 3,                        // sempre "3 anos de experiência" — MOCKADO
    bairro: "Próxima de você",      // bairro sempre fixo — MOCKADO
    disponibilidade: "Disponível",  // sempre "Disponível" — MOCKADO
    online: item.verificacao === "VERIFICADO", // ok (usa dado real)
  };
}
```

Os campos `anos`, `bairro` e `disponibilidade` exibidos nos cards da Home são hardcoded. A API retorna dados reais mas esses campos não vêm do payload real.

### 4.4 MÉDIO — ProfissionaisDestaqueScreen sem critério de destaque real

**Arquivo:** `dular-mobile/src/screens/empregador/ProfissionaisDestaqueScreen.tsx:1-12`  
O comentário do próprio arquivo admite: "Como não há (ainda) um critério de destaque no backend, reaproveitamos o mesmo hook `useBuscar`". A seção "Profissionais em destaque" exibe os mesmos resultados da busca geral, apenas reordenados por rating localmente. Não há endpoint dedicado.

---

## 5. BUSCA — LOCALIZAÇÃO, FILTROS, ESTADOS

### 5.1 Localização real

- **BuscarScreen**: usa `useCurrentRegion` (GPS + permissão), salva via `POST /api/localizacao` e propaga para `useBuscar`. Localização real funciona.
- **EmpregadorHome**: usa `useGeoDefaults` + `expo-location` para geocodificar bairro (`EmpregadorHome.tsx:274-279`). Funciona, mas tem fallback para `user.cidadeAtual` do perfil.
- **Filtros**: filtro por categoria (diarista/montador/baba/cozinheira etc.) funciona via `selectedCat`. Filtro por nome/bairro é local (front-end) sobre a lista já retornada.

### 5.2 Estados de loading/empty/erro

- **BuscarScreen**: `DSkeletonCard` (loading), feedbackWrap com mensagem de erro + botão retry, empty state com mensagem contextual. Completo.
- **AgendamentosEmpregadorScreen**: loading inline, error com retry, empty state contextual. Completo.
- **DiaristaProfileScreen**: `ActivityIndicator` (loading), tela de erro com botão voltar. Completo.
- **FavoritosEmpregadorScreen**: skeleton, error com retry, empty state. Completo.

---

## 6. AVALIAÇÃO E ACOMPANHAMENTO — STATUS REAL

### 6.1 Avaliação (ponta a ponta — FUNCIONAL)

**Mobile → Backend → Banco:**

1. `EmpregadorDetalhe.tsx:156-159`: `podeAvaliar` = `!alreadyRated && statusRaw === "CONFIRMADO"` — exige status CONFIRMADO.
2. `AvaliacaoModal.tsx:43-49`: `POST /api/servicos/${servicoId}/avaliar` com `{ notaGeral, pontualidade, qualidade, comunicacao, comentario }` — 4 dimensões replicadas da nota única.
3. `web/src/app/api/servicos/[id]/avaliar/route.ts`: valida role EMPREGADOR, checa `servico.avaliacao` (409 se já avaliado), `assertStatus(["CONFIRMADO"])`, cria `Avaliacao` no banco, avança status para FINALIZADO, recomputa stats da diarista/montador, aplica evento SafeScore.

**Fluxo CONFIRMADO**: implementado. A avaliação persiste no banco de dados.

**Limitação:** O modal usa uma nota única replicada nas 4 dimensões (`AvaliacaoModal.tsx:46-49`). Não há campos separados de pontualidade, qualidade e comunicação expostos ao usuário. Funcionalmente correto mas perde granularidade.

### 6.2 Acompanhamento

- `EmpregadorDetalhe.tsx` faz polling a cada 5 segundos (`POLL_MS = 5000`) via `fetchServicosMinhas()`.
- Exibe CTA contextual por status: aguardar aceite, aceito, em andamento, aguardando confirmação, confirmado, cancelado/recusado.
- Reagendamento proposto pelo profissional: aceitar/recusar via `PATCH /api/servicos/${id}/reagendar`.
- Chat liberado apenas quando `["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(statusRaw)`.

**Bug**: `EmpregadorDetalhe.tsx:324` — label hardcoded "Diarista:" mesmo para serviços de Montador:
```tsx
<Text style={s.infoText}>Diarista: {svc.diarista?.nome ?? "Pendente"}</Text>
```
Para serviços de montador, `svc.diarista` é null, então exibe "Diarista: Pendente" ao invés do nome do montador.

---

## 7. INCONSISTÊNCIAS MOBILE × BACKEND

### 7.1 Preço em centavos

- Backend armazena `precoLeve`/`precoMedio`/`precoPesada` como `Int` em **centavos**. `precoBabaHora`/`precoCozinheiraBase` como `Decimal(10,2)` em **reais**.
- Mobile: `EmpregadorHome.tsx:151` divide por 100 (`prof.preco ?? 0) / 100`). Correto.
- `DiaristaProfileScreen.tsx:63`: divide por 100 para `DIARISTA`. Correto.
- `DiaristaProfileScreen.tsx:71-78`: usa `precoBabaHora` e `precoCozinheiraBase` diretamente (em reais). Correto.
- Backend `/api/servicos` `route.ts:431`: multiplica por 100 para BABA e COZINHEIRA antes de gravar `precoFinal`. Correto.
- **Sem inconsistência de unidades** verificada — contrato centavos/reais está documentado nos comentários e respeitado.

### 7.2 Campo `profissionalId` (userId vs profileId)

- Mobile envia `diaristaUserId` (userId do User) ou `montadorUserId` (userId do User).
- Backend: `prisma.user.findUnique({ where: { id: diaristaUserId } })` — busca por userId. Correto.
- `empregadorApi.ts:prepararPayload`: usa `draft.profissionalId` que vem da navegação com `diaristaId` (userId, não profileId).
- Na `DiaristaProfileScreen.tsx:88-89`: `diaristaId = route.params.diaristaId` e `handleContratar` passa `profissionalId: diaristaId`.
- `useDiaristaPublico` retorna `diarista.userId` que é o `User.id`. Correto.

---

## 8. RISCOS PARA LANÇAMENTO (EMPREGADOR)

| # | Risco | Severidade |
|---|---|---|
| 1 | Valor estimado hardcoded "R$ 160,00" na tela de confirmação — usuário pensa que está pagando R$ 160 mas o valor real pode ser qualquer outro | CRÍTICO |
| 2 | Protocolo e tempo ("Enviado há 1 min", "#SD250514-8K7D") fixos na tela de sucesso — credibilidade do produto comprometida | CRÍTICO |
| 3 | Label "Diarista: Pendente" no EmpregadorDetalhe para serviços de montador — nome do montador nunca aparece na tela de detalhe | ALTO |
| 4 | Bairro hardcoded "Próxima de você" + anos "3" + disponibilidade "Disponível" nos cards da Home — induz o usuário a decisão com dados falsos | ALTO |
| 5 | Bairro do empregador precisa estar cadastrado no banco (`Bairro` table) para a contratação concluir — se o empregador mora em bairro não cadastrado, recebe 400 "Bairro não cadastrado" sem guidance para resolver | ALTO |
| 6 | Avaliação com nota única replicada nas 4 dimensões — dados de pontualidade/qualidade/comunicacao não refletem a avaliação real do usuário | MÉDIO |
| 7 | "Profissionais em destaque" é alias da busca geral sem critério de destaque | MÉDIO |
| 8 | Chat disponível apenas quando status = ACEITO/EM_ANDAMENTO — empregador não pode contatar profissional antes do aceite (pode causar abandono) | MÉDIO |

---

## 9. TABELA FINAL

| Item | Severidade | Evidência (arquivo:linha) | Impacto |
|---|---|---|---|
| Valor estimado hardcoded "R$ 160,00" na tela de confirmação | CRÍTICO | `dular-mobile/src/screens/empregador/service-flow/ConfirmarSolicitacaoScreen.tsx:168` | Usuário confirma sem saber o preço real |
| Protocolo de sucesso mockado `#SD250514-8K7D` + "Enviado há 1 min" | CRÍTICO | `dular-mobile/src/screens/empregador/service-flow/SolicitacaoSucessoScreen.tsx:47-50` | Credibilidade/rastreabilidade zero; `servicoId` real não é exibido |
| Label "Diarista:" hardcoded no EmpregadorDetalhe (falha para montador) | ALTO | `dular-mobile/src/screens/empregador/EmpregadorDetalhe.tsx:324` | Nome do montador nunca aparece na tela de detalhe |
| Campos `anos=3`, `bairro="Próxima de você"`, `disponibilidade="Disponível"` hardcoded na Home | ALTO | `dular-mobile/src/screens/empregador/EmpregadorHome.tsx:65-68` | Usuário decide com informação falsa de experiência e localização |
| Bairro não cadastrado no banco bloqueia contratação sem guia de resolução | ALTO | `web/src/app/api/servicos/route.ts:356-360` (backend) + `dular-mobile/src/api/empregadorApi.ts:prepararPayload` | UX ruim: erro 400 sem ação corretiva para o usuário |
| Avaliação usa nota única replicada em 4 dimensões | MÉDIO | `dular-mobile/src/components/ui/AvaliacaoModal.tsx:46-49` | Dados de dimensões (pontualidade/qualidade/comunicação) sem significado real |
| "Profissionais em destaque" sem critério de destaque real no backend | MÉDIO | `dular-mobile/src/screens/empregador/ProfissionaisDestaqueScreen.tsx:1-12` | Feature prometida entrega resultado idêntico à busca geral |
| Chat bloqueado antes do aceite da diarista | MÉDIO | `dular-mobile/src/screens/empregador/EmpregadorDetalhe.tsx:171-174` | Empregador não pode entrar em contato antes do aceite |
| `servicoId` ignorado na SolicitacaoSucessoScreen | CRÍTICO | `dular-mobile/src/screens/empregador/service-flow/SolicitacaoSucessoScreen.tsx` (prop recebida mas não usada) | Rastreabilidade perdida — usuário não vê ID do serviço criado |

---

*Auditoria finalizada em 2026-06-18. Todos os achados baseados em leitura de código real sem execução.*
