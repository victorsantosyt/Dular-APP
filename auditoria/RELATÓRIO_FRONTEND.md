# Auditoria Frontend — Dular Mobile (React Native/Expo)
**Data:** 2026-06-18
**Auditor:** Sub-Agente 5 — Auditor de Frontend
**Escopo:** /dular-mobile/src/screens, /navigation, /hooks, /api, /stores

---

## 1. Resumo Executivo

O frontend do app Dular apresenta arquitetura de navegação sólida nos três fluxos principais (Empregador, Diarista, Montador), mas carrega dívidas técnicas relevantes: uma tela registrada em `routes.ts` mas inacessível no navigator ativo (`EmpregadorMinhas`); divergência de contrato crítica entre `useRestricoes` e o backend (`/api/me/restrictions` devolve `{ restrictions: [...] }` mas o hook espera `{ plano, limites, uso }`); dados hardcoded de avaliação e experiência na camada de UI; e dois hooks legados (`useAgendamentosEmpregador`, `useAgendamentosDiarista`) que NÃO são usados pelas telas principais — que consomem a API diretamente, gerando duplicidade de código e possível inconsistência de estado. O fluxo de navegação de `ReportIncident` do Diarista passou param `servicoId` mas o tipo em `DiaristaTabParamList` não declara esse parâmetro. O navigator do Montador não registra `VerificacaoDocs` porém a tela navega para lá.

---

## 2. Inventário de Navigators e Rotas

### 2.1 OnboardingNavigator (NativeStack)
| Rota | Tela | Alcançável? |
|------|------|-------------|
| Splash | SplashScreen | Sim (initialRoute) |
| Welcome | WelcomeScreen | Sim |
| Benefits | BenefitsScreen | Sim |
| Security | SecurityScreen | Sim |
| Start | StartScreen | Sim |
| RoleSelect | RoleSelectScreen | Sim |
| Login | LoginScreen | Sim |

### 2.2 EmpregadorNavigator (BottomTab — 27 telas)
| Rota | Tela | Alcançável? |
|------|------|-------------|
| Home | EmpregadorHome | Sim (tab) |
| Buscar | BuscarScreen | Sim (tab) |
| Agendamentos | AgendamentosEmpregadorScreen | Sim (tab) |
| SolicitarServico | EmpregadorServiceFlowNavigator | Sim (tab) |
| Mensagens | MensagensEmpregadorScreen | Sim (tab) |
| Notificacoes | NotificacoesEmpregadorScreen | Sim |
| ChatAberto | ChatAbertoScreen | Sim (via Mensagens/Notificacoes) |
| Perfil | EmpregadorPerfil | Sim (tab) |
| ProfissionalPerfil | DiaristaProfileScreen | Sim |
| DiaristaProfile | DiaristaProfileScreen | Sim |
| MontadorPublicProfile | MontadorPublicProfile | Sim |
| DetalheServico | EmpregadorDetalhe | Sim |
| EmpregadorDetalhe | EmpregadorDetalhe | Sim |
| Paywall | PaywallScreen | Sim |
| VerificacaoDocs | VerificacaoDocs | Sim |
| ReportIncident | ReportIncident | Sim |
| SosFlow | SosFlowScreen | Sim |
| SafeScore | SafeScoreScreen | Sim |
| Termos | Termos | Sim |
| Privacidade | Privacidade | Sim |
| Favoritos | FavoritosEmpregadorScreen | Sim |
| Historico | HistoricoEmpregadorScreen | Sim |
| CategoriasTodas | CategoriasTodasScreen | Sim |
| DadosConta | DadosContaScreen | Sim |
| Suporte | Suporte | Sim |
| ProfissionaisSugeridos | ProfissionaisSugeridosScreen | Sim |
| AcoesRapidas | AcoesRapidasEmpregadorScreen | Sim |
| ProfissionaisDestaque | ProfissionaisDestaqueScreen | Sim |
| **EmpregadorMinhas** | **EmpregadorMinhas** | **NÃO — ver item 3.1** |

> **Nota:** `EmpregadorMinhas` consta em `routes.ts:15` (EMPREGADOR_STACK_ROUTES.MINHAS = "EmpregadorMinhas") mas NÃO está registrada no `EmpregadorNavigator`. Qualquer `navigation.navigate(EMPREGADOR_STACK_ROUTES.MINHAS, ...)` falha silenciosamente em produção.

### 2.3 DiaristaNavigator (BottomTab — 18 telas)
| Rota | Tela | Alcançável? |
|------|------|-------------|
| Home | DiaristaHomeScreen | Sim (tab) |
| Agendamentos | AgendamentosDiaristaScreen | Sim (tab) |
| Novo | ServicosDiaristaScreen | Sim (tab) |
| Mensagens | MensagensDiaristaScreen | Sim (tab) |
| Notificacoes | DiaristaNotificacoes | Sim |
| ChatAberto | ChatAbertoScreen | Sim |
| Perfil | DiaristaPerfil | Sim (tab) |
| ProfissionalPerfil | DiaristaPerfil (!) | Sim — mas renderiza DiaristaPerfil, não um perfil externo |
| DetalheServico | DiaristaDetalhe | Sim |
| DiaristaDetalhe | DiaristaDetalhe | Sim |
| Paywall | PaywallScreen | Sim |
| Seguranca | SegurancaScreen | Sim |
| Carteira | DiaristaCarteira | Sim |
| VerificacaoDocs | VerificacaoDocs | Sim |
| SafeScore | SafeScoreScreen | Sim |
| SosFlow | SosFlowScreen | Sim |
| ReportIncident | ReportIncident | Sim |
| Suporte | Suporte | Sim |
| Termos | Termos | Sim |
| Privacidade | Privacidade | Sim |

### 2.4 MontadorNavigator (BottomTab — 17 telas)
| Rota | Tela | Alcançável? |
|------|------|-------------|
| MontadorHome | MontadorHome | Sim (tab) |
| MontadorAgenda | MontadorAgenda | Sim (tab) |
| MontadorSolicitacoes | MontadorSolicitacoes | Sim (tab) |
| MontadorMensagens | MontadorMensagens | Sim (tab) |
| MontadorPerfil | MontadorPerfil | Sim (tab) |
| MontadorNotificacoes | MontadorNotificacoes | Sim |
| MontadorDetalheSolicitacao | MontadorDetalheSolicitacao | Sim |
| MontadorDetalheServico | MontadorDetalheServico | Sim |
| MontadorChat | ChatScreen | Sim |
| VerificacaoDocs | VerificacaoDocs | Sim |
| Carteira | CarteiraScreen | Sim |
| SafeScore | SafeScoreScreen | Sim |
| SosFlow | SosFlowScreen | Sim |
| ReportIncident | ReportIncident | Sim |
| Suporte | Suporte | Sim |
| Termos | Termos | Sim |
| Privacidade | Privacidade | Sim |

### 2.5 EmpregadorServiceFlowNavigator (NativeStack — sub-navigator de SolicitarServico)
Rotas: `EscolherServico → EscolherData → EnderecoServico → ObservacoesServico → ConfirmarSolicitacao → SolicitacaoSucesso`. Todas alcançáveis sequencialmente.

### 2.6 Telas Legacy (inacessíveis — diretório _legacy)
- `screens/_legacy/EditBairros.tsx`
- `screens/_legacy/EditDados.tsx`
- `screens/_legacy/EditDisponibilidade.tsx`
- `screens/_legacy/EditPrecos.tsx`
- `screens/_legacy/SegurancaScreen.tsx`

Nenhuma dessas telas está registrada em qualquer navigator. São componentes mortos.

---

## 3. Rotas Quebradas / Telas Inacessíveis

### 3.1 CRÍTICO — EmpregadorMinhas não registrada no navigator
- **Evidência:** `routes.ts:15` define `MINHAS: "EmpregadorMinhas"`, mas o `EmpregadorNavigator.tsx` (linhas 101–139) **não registra nenhuma `Tab.Screen name="EmpregadorMinhas"`**.
- `EmpregadorMinhas.tsx:131` chama `navigation.navigate(EMPREGADOR_STACK_ROUTES.DETALHE, ...)`, o que funciona; porém a própria tela `EmpregadorMinhas` nunca pode ser alcançada. Qualquer código que fizesse `navigation.navigate("EmpregadorMinhas")` quebraria.
- O arquivo `EmpregadorMinhas.tsx` está completo (FlashList, polling, ações), mas é **inacessível em runtime**.

### 3.2 ALTO — DiaristaDetalhe navega para "ReportIncident" com `{ servicoId }` mas o tipo não declara esse param
- **Evidência:** `DiaristaDetalhe.tsx:362` chama `navigation.navigate("ReportIncident", { servicoId: svc.id })`.
- `DiaristaTabParamList` em `DiaristaNavigator.tsx:41` define `ReportIncident: undefined` — sem params.
- `ReportIncident.tsx:146` lê `route?.params?.servicoId` com `any`, o que funciona em runtime mas viola o contrato de tipo e pode mascarar erros futuros.
- O mesmo não ocorre no Montador (que define `ReportIncident: { servicoId?: string; ... } | undefined`).

### 3.3 MÉDIO — ProfissionalPerfil no DiaristaNavigator renderiza DiaristaPerfil (não um perfil externo)
- **Evidência:** `DiaristaNavigator.tsx:57–58` — `ProfissionalPerfilScreen` renderiza `DiaristaPerfil`, que é o perfil do próprio usuário. A rota `ProfissionalPerfil: { id: string }` sugere exibir o perfil de outro usuário, mas a implementação é `DiaristaPerfil onLogout`.
- Impacto: qualquer `navigation.navigate("ProfissionalPerfil", { id: "..." })` abre o perfil próprio da diarista, não o perfil do id passado.

### 3.4 BAIXO — SosFlowScreen navega para "ReportIncident" sem params no Diarista
- **Evidência:** `SosFlowScreen.tsx:192` — `nav.navigate("ReportIncident")` sem params.
- No Diarista, `DiaristaTabParamList` define `ReportIncident: undefined`, então é compatível. No Empregador, `EmpregadorTabParamList` define `ReportIncident: undefined`, também OK. Consistente, mas leva ao fluxo sem `serviceId`, exigindo que o usuário selecione manualmente o outro usuário.

---

## 4. Chamadas de API Problemáticas

### 4.1 CRÍTICO — useRestricoes consume endpoint com contrato incorreto
- **Evidência:** `useRestricoes.ts:44` — `const res = await api.get<Restricoes>("/api/me/restrictions")` e usa `res.data` com tipo `Restricoes = { plano, limites: { servicosMes, aceiteMes }, uso: { servicosMes, aceiteMes } }`.
- **Backend real:** `web/src/app/api/me/restrictions/route.ts:37` — retorna `{ restrictions: UserRestriction[] }` (array de objetos com `id, type, reason, expiresAt, createdAt`). Não há `plano`, `limites`, nem `uso` nessa resposta.
- **Impacto:** `restricoes` sempre será `null` (ou um objeto sem as chaves esperadas) → `atingiuLimite()` retorna sempre `false` → o Paywall nunca é acionado via `usePaywallGuard`. O guard falha **aberto** silenciosamente (intencional por design de fallback na linha 20, mas baseado em dado incorreto).
- **Hooks afetados:** `usePaywallGuard.ts:13` e indiretamente `EmpregadorHome`, `DiaristaSolicitacoes`.

### 4.2 MÉDIO — DiaristaProfileScreen acessa /api/servicos/minhas para verificar serviço ativo do ponto de vista do Empregador
- **Evidência:** `DiaristaProfileScreen.tsx:120–126` — filtra `servico.diarista?.id === diaristaId` na lista de `/api/servicos/minhas` do empregador logado.
- Funciona para o caso de uso, mas a abordagem carrega **todos os serviços** do empregador para encontrar um serviço ativo de uma diarista específica. Não há endpoint dedicado no backend para isso (diferente do montador que tem `/api/montadores/[id]/servico-ativo`).
- O `MontadorPublicProfile.tsx` usa `/api/montadores/${montadorId}` e verifica `activeService` na resposta — mais eficiente.

### 4.3 MÉDIO — MontadorPublicProfile busca serviço ativo via endpoint que pode não existir
- **Evidência:** `MontadorPublicProfile.tsx:81` — `api.get("/api/montadores/${montadorId}")` com `.catch(() => null)` — trata erros silenciosamente.
- O backend tem `web/src/app/api/montadores/[id]/route.ts`. Confirmado existir.
- Mas o campo `activeService` na resposta é esperado em `ServicoAtivoResponse` — não há evidência de que `/api/montadores/[id]` retorna esse campo. Há uma rota separada `/api/montadores/[id]/servico-ativo/route.ts` que não é usada. O código lê `res.data.montador?.activeService` sem chamar a sub-rota específica.

### 4.4 BAIXO — Dois clientes HTTP paralelos (api vs apiService)
- **Evidência:** `useAgendamentosEmpregador.ts:2,98` e `useAgendamentosDiarista.ts:2,76` — importam `apiService` de `@/services/api`.
- `services/api.ts:1,7` — o `apiService` é apenas um wrapper do mesmo axios `api` de `@/lib/api`, recebendo `_token` como parâmetro ignorado (linha 7: `_token?: string | null`).
- Não causa falha funcional, mas é uma abstração desnecessária. Os dois hooks também não são consumidos pelas telas principais (EmpregadorHome, AgendamentosEmpregadorScreen, DiaristaHomeScreen usam diretamente `fetchServicosMinhas` de `sharedFetcher`) — são hooks órfãos.

### 4.5 BAIXO — ReportIncident acessa /api/servicos/${serviceId} para resolver usuário
- **Evidência:** `ReportIncident.tsx:194` — `api.get("/api/servicos/${serviceId}")`.
- Backend `web/src/app/api/servicos/[id]/route.ts` existe. OK.
- Mas a resposta esperada em `resolveReportedUser()` busca `servico?.cliente` e `servico?.diarista` — o contrato backend precisa retornar esses campos (NÃO VERIFICÁVEL sem ler o backend profundamente).

---

## 5. Cobertura de Loading / Error / Empty States

| Tela | Loading | Error | Empty |
|------|---------|-------|-------|
| EmpregadorHome | Sim (DSkeletonCard) | Sim (DErrorState) | Sim (DEmptyState) |
| BuscarScreen | Sim | Sim (diaristasError / montadoresError separados) | Sim |
| AgendamentosEmpregadorScreen | Sim (ActivityIndicator) | Sim (DErrorState) | Sim (empty pressable) |
| HistoricoEmpregadorScreen | Sim (DSkeletonCard) | Sim (DErrorState) | Sim (DEmptyState) |
| FavoritosEmpregadorScreen | Sim (DSkeletonCard) | NÃO — falha silenciosa | Sim (DEmptyState) |
| NotificacoesEmpregadorScreen | NÃO VERIFICÁVEL (usa NotificacoesView) | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL |
| MensagensEmpregadorScreen | NÃO VERIFICÁVEL (usa MensagensView) | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL |
| DiaristaHomeScreen | Sim (`agendamentosLoading`) | Parcial (agendamentosError não exibido em tela, apenas `refetch`) | Sim |
| AgendamentosDiaristaScreen | Sim | Sim (Alert) | Sim |
| DiaristaSolicitacoes | Sim (Animated) | Sim (Alert) | Sim (empty state interno) |
| DiaristaCarteira | Sim (DLoadingState) | Sim (DErrorState) | Sim (DEmptyState) |
| MontadorHome | Sim (DLoadingState) | Sim (DErrorState) | Sim (DEmptyState) |
| MontadorAgenda | Sim (DLoadingState) | Sim (DErrorState) | Sim (DEmptyState) |
| MontadorSolicitacoes | Sim | Sim | Sim |
| MontadorPerfil | Sim (DLoadingState) | Sim (DErrorState) | N/A |
| ChatAbertoScreen | Sim (ActivityIndicator) | Sim (texto inline) | Implícito (lista vazia) |
| ChatScreen (montador) | Sim | Sim (texto inline) | Implícito |
| EmpregadorMinhas | Sim | Sim (Alert) | Implícito (FlashList vazia) |
| EmpregadorDetalhe | Sim (poll) | Parcial (sem state visual) | N/A |
| DiaristaDetalhe | Sim | Parcial (sem state visual de erro em tela) | N/A |
| ProfissionaisDestaqueScreen | Sim (DSkeletonCard) | Sim (DErrorState) | Sim (DEmptyState) |
| ProfissionaisSugeridosScreen | Sim (DSkeletonCard) | Sim (DErrorState) | Sim (DEmptyState) |
| ReportIncident | Sim (ActivityIndicator p/ resolve user) | Sim (errorBox) | N/A |
| SafeScoreScreen | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL |
| SosFlowScreen | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL | NÃO VERIFICÁVEL |

**Observações:**
- `FavoritosEmpregadorScreen`: falha silenciosa no `catch {}` do `fetchFavoritos` — usuário não sabe que a lista não carregou.
- `DiaristaHomeScreen`: `agendamentosError` é recebido do hook mas não há feedback visual de erro na tela (nenhum DErrorState condicionado a ele).

---

## 6. Hooks / Estado — Dívidas Técnicas

### 6.1 ALTO — useRestricoes contrato incompatível com backend (ver 4.1)

### 6.2 MÉDIO — useAgendamentosEmpregador e useAgendamentosDiarista são hooks órfãos
- **Evidência:** `useAgendamentosEmpregador.ts` e `useAgendamentosDiarista.ts` — nenhum import desses hooks nas telas principais.
- As telas que fazem sentido (AgendamentosEmpregadorScreen, DiaristaHomeScreen) consomem `fetchServicosMinhas` diretamente ou via hook interno próprio.
- Esses dois hooks existem mas não são consumidos por nenhuma tela identificada na auditoria. São código morto.

### 6.3 MÉDIO — EmpregadorMinhas usa polling de 5s (setInterval) + useFocusEffect + useEffect inicial simultaneamente
- **Evidência:** `EmpregadorMinhas.tsx:101–107` — três carregamentos distintos: `useEffect` inicial, `useFocusEffect` no focus, e `setInterval` a cada 5s quando focado.
- Isso causa triplo request na montagem da tela (initial + focus + primeiro tick do intervalo podem ocorrer antes do primeiro response). A tela não está registrada no navigator (ver 3.1), mas o padrão deve ser corrigido.

### 6.4 MÉDIO — EmpregadorDetalhe usa polling de 5s sem dedupe
- **Evidência:** `EmpregadorDetalhe.tsx:44` — `POLL_MS = 5000`.
- Diferente de `sharedFetcher`, sem cache ou dedupe — cada instância faz requests independentes.

### 6.5 BAIXO — Hardcoded "anos: 3" e "Próxima de você" em EmpregadorHome
- **Evidência:** `EmpregadorHome.tsx:66–67` — `diaristaToProf()` preenche `anos: 3` e `bairro: "Próxima de você"` fixo para toda diarista sugerida.
- Dado real de experiência (`anosExperiencia`) existe na API (`DiaristaProfileMe.anosExperiencia`) mas não é mapeado.

### 6.6 BAIXO — Hardcoded "avaliacao: '5,0'" em useAgendamentosDiarista
- **Evidência:** `useAgendamentosDiarista.ts:52` — `avaliacao: "5,0"` hardcoded para todos os agendamentos. Campo exibível na tela que renderiza esses dados (AgendamentosDiaristaScreen).

### 6.7 BAIXO — Dois stores authStore duplicados
- **Evidência:** `src/store/authStore.ts:1` — apenas re-exporta de `src/stores/authStore.ts`. Ambos os diretórios `store/` e `stores/` existem, com `store/authStore.ts` sendo wrapper. Confuso mas sem impacto funcional.

---

## 7. Dados Mockados / Hardcoded na UI

| Localização | Dado | Severidade |
|------------|------|-----------|
| `EmpregadorHome.tsx:66` | `anos: 3` (experiência fixa para todas diaristas) | MÉDIO |
| `EmpregadorHome.tsx:67` | `bairro: "Próxima de você"` (localização fixa) | MÉDIO |
| `useAgendamentosDiarista.ts:52` | `avaliacao: "5,0"` (nota fixa 5,0 para todos) | MÉDIO |
| `useAgendamentosEmpregador.ts:80` | `nota: "--"` e `idade: "--"` | BAIXO |
| `EmpregadorMinhas.tsx:178-179` | `"Pagamento in-app em breve."` (placeholder de feature) | BAIXO |

---

## 8. Componentes Mortos / Imports Potencialmente Problemáticos

### 8.1 Telas Legacy Inacessíveis
- `screens/_legacy/EditBairros.tsx`
- `screens/_legacy/EditDados.tsx`
- `screens/_legacy/EditDisponibilidade.tsx`
- `screens/_legacy/EditPrecos.tsx`
- `screens/_legacy/SegurancaScreen.tsx`

Nenhuma está importada por qualquer navigator ou tela. São código morto.

### 8.2 Imports com caminho relativo longo para shared/types
- **Evidência:** `DiaristaDetalhe.tsx:16`, `DiaristaSolicitacoes.tsx:21`, `EmpregadorMinhas.tsx:30`, `ChatScreen.tsx:23`, `EmpregadorDetalhe.tsx:17` — todos usam `"../../../../shared/types/servico"`.
- O diretório `shared/types/` existe (confirmado). Funcional, mas path relativo frágil; poderia ser alias `@/shared/...`.

### 8.3 EmpregadorMinhas importada mas não registrada no navigator
- **Evidência:** O arquivo `EmpregadorMinhas.tsx` existe e está completo, mas não consta em nenhum `Tab.Screen` do `EmpregadorNavigator`.

### 8.4 Componentes duplicados em /components e /components/ui
- `DButton` existe em `components/DButton.tsx` e `components/ui/DButton.tsx`.
- `DCard` existe em `components/DCard.tsx` e `components/ui/DCard.tsx`.
- `DInput` existe em `components/DInput.tsx` e `components/ui/DInput.tsx`.
- Ambos são importados em diferentes telas (`DiaristaDetalhe`, `EmpregadorDetalhe` usam `@/components/DButton`; outras telas usam `@/components/ui`). Risco de divergência de estilos.

---

## 9. Tabela Final de Achados

| # | Item | Severidade | Evidência (arquivo:linha) | Impacto |
|---|------|-----------|--------------------------|---------|
| 1 | `EmpregadorMinhas` registrada em `routes.ts` mas ausente do `EmpregadorNavigator` | CRÍTICO | `routes.ts:15`, `EmpregadorNavigator.tsx:101–139` | Tela completamente inacessível em runtime; route key morta |
| 2 | `useRestricoes` espera `{ plano, limites, uso }` mas backend retorna `{ restrictions: [...] }` | CRÍTICO | `useRestricoes.ts:44`, `web/api/me/restrictions/route.ts:37` | Paywall guard sempre falha aberto; limites de plano nunca bloqueiam ação |
| 3 | `DiaristaTabParamList.ReportIncident: undefined` mas `DiaristaDetalhe` navega com `{ servicoId }` | ALTO | `DiaristaNavigator.tsx:41`, `DiaristaDetalhe.tsx:362` | Violação de contrato de tipo; risco de crash em builds com strict navigation typing |
| 4 | `ProfissionalPerfil` no DiaristaNavigator renderiza `DiaristaPerfil` (perfil próprio) ignorando `id` param | ALTO | `DiaristaNavigator.tsx:55–58` | Navegar para "ProfissionalPerfil" com id de outro usuário abre o perfil próprio da diarista |
| 5 | `DiaristaHomeScreen`: `agendamentosError` não tem feedback visual | MÉDIO | `DiaristaHomeScreen.tsx:141` | Falhas na carga de agendamentos são silenciosas para a diarista |
| 6 | `FavoritosEmpregadorScreen` falha silenciosa no fetch | MÉDIO | `FavoritosEmpregadorScreen.tsx` (catch {}) | Usuário não sabe que favoritos não carregaram |
| 7 | `EmpregadorHome.tsx`: `anos: 3` e `"Próxima de você"` hardcoded | MÉDIO | `EmpregadorHome.tsx:66–67` | Informação falsa exibida em cards de profissionais sugeridos |
| 8 | `useAgendamentosDiarista.ts`: `avaliacao: "5,0"` hardcoded | MÉDIO | `useAgendamentosDiarista.ts:52` | Nota 5,0 exibida para todos os agendamentos independente da avaliação real |
| 9 | `MontadorPublicProfile` não usa endpoint dedicado `/api/montadores/[id]/servico-ativo` | MÉDIO | `MontadorPublicProfile.tsx:81`, `web/api/montadores/[id]/servico-ativo/route.ts` | Campo `activeService` pode não existir na resposta de `/api/montadores/[id]`; serviço ativo não exibido corretamente |
| 10 | `useAgendamentosEmpregador` e `useAgendamentosDiarista` são hooks órfãos (não consumidos por telas) | MÉDIO | `useAgendamentosEmpregador.ts`, `useAgendamentosDiarista.ts` | Código morto; duplicação de lógica que pode divergir do fluxo real |
| 11 | `EmpregadorMinhas` usa triple-load (useEffect + useFocusEffect + setInterval) | MÉDIO | `EmpregadorMinhas.tsx:101–107` | Excesso de requests na montagem da tela |
| 12 | Componentes duplicados: DButton, DCard, DInput em `/components` e `/components/ui` | MÉDIO | `components/DButton.tsx`, `components/ui/DButton.tsx` | Risco de inconsistência visual entre telas |
| 13 | Imports com path relativo `../../../../shared/types/servico` | BAIXO | `DiaristaDetalhe.tsx:16`, `EmpregadorMinhas.tsx:30`, etc. | Path frágil; falha silenciosa se estrutura mover |
| 14 | 5 telas legacy em `screens/_legacy/` sem nenhum navigator | BAIXO | `screens/_legacy/*.tsx` | Código morto; confusão de manutenção |
| 15 | `store/authStore.ts` duplica `stores/authStore.ts` via re-export | BAIXO | `src/store/authStore.ts:1` | Confusão estrutural; sem impacto funcional |
| 16 | `EmpregadorMinhas.tsx:178–179`: placeholder "Pagamento in-app em breve" hardcoded | BAIXO | `EmpregadorMinhas.tsx:178–179` | Feature incompleta exposta na UI |

---

*Fim do Relatório de Auditoria Frontend — Dular Mobile*
