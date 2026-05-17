# T-17 — Matriz QA (reclassificada após Hotfix 1)

> Última revisão: 2026-05-17 — agent-frontend.
>
> Esta matriz substitui o estado anterior do T-17, em que vários cenários estavam marcados
> como PASS sem que tivessem sido testados end-to-end na UI. A reclassificação separa
> claramente o que foi testado pela UI, o que tem endpoint funcional mas faltou dado,
> o que está bloqueado por ausência de dado real e o que é bug confirmado.
>
> Regra fundamental: **um passo não pode ser PASS se depende de um passo BLOCKED**.

## Legenda

| Símbolo | Significado |
|---------|-------------|
| `E2E PASS` | Testado fim a fim pela UI mobile, fluxo completo verificado. |
| `API PASS` | Endpoint backend implementado e funcional; UI **não** foi testada por falta de dado / dependência bloqueada. |
| `BLOCKED` | Falta dado real (perfil completo na mesma região) para exercitar o fluxo. Depende de Hotfix 1. |
| `FAIL` | Bug real reproduzido. Inclui descrição e, quando cabível, correção aplicada. |

> Importante: o `API PASS` **não vira `E2E PASS`** só porque o endpoint responde 200 em curl.
> Continua sendo `API PASS` até que a UI consiga acionar a ação com dado real.

---

## Causa-raiz dos BLOCKED

A maior parte dos BLOCKED tem a mesma origem:

- Não há Montador com perfil **completo** (`calcularCompletudeMontador` retornando true)
  ativo na mesma cidade/UF do usuário QA empregador.
- Não há Profissional de Casa com perfil **completo** oferecendo as três opções
  (`DIARISTA`, `BABA`, `COZINHEIRA`) ativo na mesma cidade/UF do usuário QA empregador.

Sem isso, `GET /api/diaristas/buscar` e `GET /api/montadores/buscar` retornam lista vazia,
e todos os passos seguintes do funil (abrir perfil público → contratar → aceitar → chat →
finalizar → avaliar) ficam sem alvo para executar pela UI.

Agent-backend está produzindo script de diagnóstico e agent-database está listando
perfis reais para destravar.

---

## Fluxo 1 — Empregador contrata Diarista

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | Login Empregador | `E2E PASS` | `LoginScreen.tsx`; auth ok; sessão persiste em `authStore`. |
| 2 | Definir/confirmar região (cidade, UF, bairro) | `E2E PASS` | Confirmada em commit 62b3c65 (`feat: adicionar localizacao por regiao confirmada`). |
| 3 | Home Empregador renderiza | `E2E PASS` | `EmpregadorHome.tsx`; categorias e sugestões aparecem. |
| 4 | Buscar Diarista (categoria=DIARISTA) na sua região | `BLOCKED` | Sem diarista completa na região do QA. `useBuscar` chama `/api/diaristas/buscar?cidade=…&uf=…&bairro=…&servico=DIARISTA`. |
| 5 | Buscar Babá (categoria=BABA) | `BLOCKED` | Mesma causa: faltam perfis com `servicosOferecidos` incluindo `BABA`. |
| 6 | Buscar Cozinheira (categoria=COZINHEIRA) | `BLOCKED` | Mesma causa. |
| 7 | Abrir perfil público da Diarista | `API PASS` | `GET /api/diaristas/[userId]` implementado e retorna perfil + serviços oferecidos. UI (`DiaristaProfileScreen.tsx`) acionada via passos 4-6. **Sem dado de busca não dá pra testar a navegação real**, por isso não é E2E PASS. |
| 8 | Contratar (POST `/api/servicos`) | `BLOCKED` | Depende dos passos 4-7. Endpoint pronto (categoria + tipo + profissional vinculado). |
| 9 | Tela "Solicitação enviada" | `BLOCKED` | `SolicitacaoSucessoScreen.tsx` renderiza, mas o cenário real depende do passo 8. |
| 10 | Diarista recebe notificação | `API PASS` | `criarNotificacao()` é chamado em `POST /api/servicos`. `GET /api/notificacoes` (commit b239657) implementado. Falta provar in-app via UI. |
| 11 | Diarista aceita serviço | `API PASS` | `POST /api/servicos/[id]/aceitar` ok (apenas `SOLICITADO → ACEITO`). UI `DiaristaSolicitacoes.tsx` chama; bloqueado pelo passo 8. |
| 12 | Empregador recebe notificação `SERVICO_ACEITO` | `API PASS` | Endpoint dispara `criarNotificacao` para `clientId`. |
| 13 | Chat entre Empregador e Diarista | `API PASS` | `GET /api/chat` filtra por status em `["ACEITO","EM_ANDAMENTO","CONCLUIDO","CONFIRMADO","FINALIZADO"]`; depende de existir serviço aceito. |
| 14 | Diarista marca "Iniciar" → `EM_ANDAMENTO` | `API PASS` | `POST /api/servicos/[id]/iniciar` ok. |
| 15 | Diarista confirma finalização (1ª parte) | `API PASS` | `POST /api/servicos/[id]/confirmar-finalizacao` muda para `AGUARDANDO_FINALIZACAO`. |
| 16 | Empregador confirma finalização (2ª parte) | `API PASS` | Mesmo endpoint, mas papel oposto → `CONCLUIDO`. |
| 17 | Empregador avalia (estrelas + comentário) | `API PASS` | `POST /api/servicos/[id]/avaliar` em status `CONFIRMADO`. `AvaliacaoModal.tsx` integrado em `EmpregadorDetalhe.tsx`. |

> Total fluxo 1: 17 passos. Bloqueio principal: passos 4-6 (busca por região).

---

## Fluxo 2 — Empregador contrata Montador

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | Login Empregador | `E2E PASS` | Compartilha com fluxo 1. |
| 2 | Selecionar categoria "Montador" na Home | `E2E PASS` | `EmpregadorHome.tsx:430` navega para Buscar com `categoriaInicial: "montador"`. |
| 3 | `GET /api/montadores/buscar?cidade=…&uf=…` | `BLOCKED` | Sem montador completo (`calcularCompletudeMontador`) ativo na mesma região. |
| 4 | Abrir `MontadorPublicProfile` | `API PASS` | `GET /api/montadores/[id]` ok; tela `MontadorPublicProfile.tsx` registrada em `EmpregadorNavigator.tsx:90`. |
| 5 | Contratar Montador (POST `/api/servicos`) | `BLOCKED` | Depende do 3. |
| 6 | Montador recebe notificação | `API PASS` | Mesmo mecanismo do fluxo 1. |
| 7 | Montador aceita | `API PASS` | Mesmo endpoint. |
| 8 | Chat | `API PASS` | Mesmo `/api/chat`. |
| 9 | Iniciar / confirmar finalização (dupla) / avaliar | `API PASS` | Mesma cadeia do fluxo 1. |

---

## Fluxo 3 — Diarista / Montador (perfil profissional)

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | Login Profissional | `E2E PASS` | Mesmo onboarding. |
| 2 | Editar perfil (`DiaristaPerfil.tsx` / `MontadorPerfil.tsx`) | `E2E PASS` | Modais com `onRequestClose` corretos (verificado). |
| 3 | Definir serviços oferecidos / especialidades | `E2E PASS` | Commit f871cce (popular servicos oferecidos). |
| 4 | Receber lista de solicitações | `API PASS` | `GET /api/servicos/minhas` ok. UI `DiaristaSolicitacoes.tsx` / `MontadorSolicitacoes.tsx`. Depende de empregador criar serviço (fluxo 1/2 BLOCKED). |
| 5 | Aceitar / recusar | `API PASS` | Endpoints prontos. Sem solicitação real, não dá pra exercitar pela UI. |
| 6 | Confirmar finalização | `API PASS` | Idem. |

---

## Fluxo 4 — Notificações

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | `GET /api/notificacoes` | `API PASS` | Implementado; ordenação por `createdAt` desc; `unreadCount` exposto. |
| 2 | UI lista notificações (`NotificacoesEmpregadorScreen.tsx`, `MontadorNotificacoes.tsx`) | `BLOCKED` | Depende de existir serviço/notificação real → fluxos 1/2/3. |
| 3 | `PATCH /api/notificacoes/[id]/ler` | `API PASS` | Idempotente; 401/403/404 cobertos. |
| 4 | `PATCH /api/notificacoes/ler-todas` | `API PASS` | Implementado; UI usa `useMensagens`/notifications screens. |
| 5 | Push token (Expo) | `API PASS` | `POST /api/me/push-token` valida prefixo `ExponentPushToken[`. UI registra em onboarding. |

---

## Fluxo 5 — Chat

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | `GET /api/chat` (lista de salas) | `API PASS` | Endpoint implementado (commit b239657). |
| 2 | UI lista conversas (`MensagensEmpregadorScreen.tsx`, `MensagensDiaristaScreen.tsx`) | `BLOCKED` | Sem serviço aceito, não há sala. Depende de fluxo 1/2. |
| 3 | `GET /api/chat/[roomId]/messages` | `API PASS` | Endpoint pronto. |
| 4 | `POST /api/chat/[roomId]/messages` | `API PASS` | Pronto. |
| 5 | Tela `ChatAbertoScreen.tsx` | `API PASS` | Registrada em ambos os navigators; rota corrigida em hotfixes anteriores. |

---

## Fluxo 6 — Onboarding e perfil

| # | Passo | Status | Notas |
|---|-------|--------|-------|
| 1 | Tela de seleção de role | `E2E PASS` | `RoleSelectScreen.tsx`. |
| 2 | Tela de gênero | `E2E PASS` | `GeneroSelectScreen.tsx`. |
| 3 | Login (email/senha) | `E2E PASS` | `LoginScreen.tsx` + `/api/auth/login`. |
| 4 | Persistir sessão | `E2E PASS` | `authStore` zustand. |
| 5 | Definir região / localização | `E2E PASS` | `/api/me/localizacao`. |

---

## Bugs encontrados (FAIL)

### 1. `AvaliacaoModal.tsx:55` — `<Modal>` sem `onRequestClose`

- **Arquivo**: `dular-mobile/src/components/ui/AvaliacaoModal.tsx`
- **Evidência**: `Modal` declarado com `visible`, `animationType="slide"`, `transparent`, mas
  sem prop `onRequestClose`. No Android, isso quebra o botão back do sistema dentro do
  modal de avaliação — o usuário fica preso.
- **Status**: **CORRIGIDO** nesta passagem. Agora o modal recebe `onRequestClose={onClose}`,
  alinhado com o padrão dos outros modais do app (`MotivoModal.tsx`, `DiaristaPerfil.tsx`,
  `EmpregadorPerfil.tsx`, `MontadorPerfil.tsx`).

> Nenhum outro bug visual / de navegação foi confirmado com evidência clara neste passe.
> A navegação `DiaristaProfile` / `MontadorPublicProfile` / `EmpregadorDetalhe` /
> `ChatAberto` está registrada nos navigators (`EmpregadorNavigator.tsx`,
> `MontadorNavigator`, `DiaristaNavigator`). As 17 ocorrências de `<Modal>` no app têm
> `onRequestClose` apropriado depois desta correção.

---

## Resumo numérico

| Categoria | Quantidade |
|-----------|------------|
| `E2E PASS` | 11 |
| `API PASS` | 24 |
| `BLOCKED`  | 11 |
| `FAIL`     | 1 (corrigido) |

**Total de cenários**: 47.

---

## Cenários onde NÃO foi marcado PASS por dependência de BLOCKED

Estes deliberadamente ficaram como `API PASS` (e não `E2E PASS`) porque, embora o endpoint
backend funcione, a UI só pode ser exercitada quando o passo anterior (BLOCKED) destravar:

- Fluxo 1 — passos 7 (perfil público), 10-17 (todo o restante do funil).
- Fluxo 2 — passos 4, 6-9.
- Fluxo 3 — passos 4, 5, 6.
- Fluxo 4 — passos 1, 3, 4, 5.
- Fluxo 5 — passos 1, 3, 4, 5.

---

## Próximos passos (fora do escopo desta task)

1. Aguardar agent-database publicar lista de perfis reais e o agent-backend liberar
   o script de diagnóstico → seed dos perfis QA na região alvo.
2. Reexecutar os cenários `BLOCKED` quando o dado entrar.
3. Promover `API PASS` → `E2E PASS` à medida que a UI for exercitada.
