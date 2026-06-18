# AUDITORIA FINAL — DULAR
**Auditor Principal** · consolidação dos 7 sub-relatórios · **Data:** 2026-06-18
**Base:** exclusivamente código real (`web/` Next.js+Prisma, `dular-mobile/` Expo). Achados-chave **validados por leitura direta do código** pelo Auditor Principal. Nenhum comportamento assumido.

Relatórios-fonte: [Backend](RELATÓRIO_BACKEND.md) · [Empregador](RELATÓRIO_EMPREGADOR.md) · [Diarista](RELATÓRIO_DIARISTA.md) · [Montador](RELATÓRIO_MONTADOR.md) · [Frontend](RELATÓRIO_FRONTEND.md) · [Fluxos](RELATÓRIO_FLUXOS.md) · [Maturidade](RELATÓRIO_MATURIDADE.md)

---

## 1. Resumo executivo

O Dular é um marketplace de serviços domésticos (3 perfis: **Empregador**, **Diarista**, **Montador**) com backend Next.js/Prisma e app Expo. A arquitetura é **coerente e bem estruturada**: máquina de estados de serviço completa, Guardian/SafeScore, gates de onboarding, e o **ciclo técnico de contratação fecha** (busca → perfil → criação de `Servico` → notificação → aceite → execução → conclusão → avaliação).

Porém, a auditoria encontrou problemas que atingem **diretamente o funil principal** e não apenas bordas:

1. **A oferta não existe em produção sem operação manual.** A busca só lista profissionais `VERIFICADO`/`verificado`, e a auto-verificação é **exclusiva de QA** (`AUTO_VERIFY_PROFILES`). Sem uma equipe de KYC aprovando manualmente, **nenhuma diarista e nenhum montador aparece** — o marketplace nasce vazio.
2. **A tela de contratação mostra dados falsos.** Preço fixo "R$ 160,00" e protocolo "#SD250514-8K7D" hardcoded — mata a confiança no momento mais sensível.
3. **Bloqueio silencioso de contratação** por divergência de bairro (busca normaliza, criação exige match exato).
4. **Montador financeiramente incompleto** (preço sempre R$ 0,00, sem fluxo de orçamento) e **preso em loop** quando reprovado.

**Veredito:** produto em estágio de **piloto assistido / beta fechado**, não de lançamento aberto. Nota geral **2/5**.

---

## 2. Estado atual do produto

| Camada | Situação real |
|---|---|
| Onboarding + Auth | Funciona (OAuth, JWT, gates de gênero e serviços). |
| Cadastro de perfis | Os 3 perfis cadastram e persistem. |
| Busca/Matching | Motor funciona; **gargalo de oferta** por KYC manual + filtros legados. |
| Contratação | Cria `Servico` real, mas com **dados falsos na UI** e **bloqueios silenciosos**. |
| Ciclo do serviço | Máquina de estados completa e operável (aceite→conclusão→avaliação). |
| Avaliação | Empregador→profissional funciona; sem avaliação reversa; comentários não expostos. |
| Pagamentos | Stripe/planos existem, mas **paywall quebrado** e pagamento in-app é placeholder. |
| Admin/KYC | Painel existe; processo operacional ausente; montador sem estado `REPROVADO`. |

---

## 3. Funcionalidades CONCLUÍDAS (operam ponta a ponta)

- **Autenticação OAuth + gates pós-login** (gênero; serviços da diarista). `RootNavigator.tsx`
- **Cadastro/edição dos 3 perfis** com persistência (`/api/me`, `/api/diarista/me`, `/api/montador/me`).
- **Criação de serviço** Empregador→profissional (`POST /api/servicos`) com notificação e ChatRoom.
- **Máquina de estados do serviço**: SOLICITADO→ACEITO→EM_ANDAMENTO→AGUARDANDO_FINALIZACAO→CONCLUIDO→CONFIRMADO→FINALIZADO, com endpoints para todas as transições + cancelamento + reagendamento.
- **Avaliação** Empregador→profissional (persiste, recomputa nota média, alimenta SafeScore).
- **Busca por localização** com Guardian e completude (engine correto).
- **Portfólio do montador** (upload/remoção S3) no próprio perfil.

---

## 4. Funcionalidades INCOMPLETAS / parciais

- **Verificação/KYC**: sem processo automatizado em produção; auto-verify é QA-only.
- **Orçamento do montador (GAP T-07)**: serviço nasce `precoFinal=0`; **não há endpoint nem tela** para definir o preço pós-aceite.
- **Monetização / paywall**: contrato `useRestricoes`↔backend incompatível; limites de plano nunca bloqueiam; pagamento in-app = placeholder "em breve".
- **Avaliação**: nota única replicada nas 4 dimensões; sem avaliação profissional→empregador; comentários não expostos ao empregador.
- **Disponibilidade da diarista**: cadastrada e exibida, mas **não validada** na contratação (decorativa).
- **"Profissionais em destaque"**: sem critério real — alias da busca geral.
- **Gate de especialidades do montador**: ausente (diarista tem; montador entra sem).
- **`EmpregadorMinhas`**: tela completa, porém **não registrada** no navigator.

---

## 5. Fluxos QUEBRADOS / com dead-ends

| Fluxo | Problema | Evidência |
|---|---|---|
| Confirmação de contratação (diarista) | Preço "R$ 160,00" fixo p/ qualquer profissional | `ConfirmarSolicitacaoScreen.tsx:168` |
| Sucesso da contratação | Protocolo `#SD250514-8K7D` e "Enviado há 1 min" fixos; `servicoId` real ignorado | `SolicitacaoSucessoScreen.tsx:47-49` |
| Contratação (criação) | Bairro com grafia ≠ da cadastrada → 400 "Bairro não cadastrado" sem orientação | `servicos/route.ts:356-360` |
| Montador — valor | `valorEstimado` não existe no backend → cai em `precoFinal=0` → "R$ 0,00" | `MontadorSolicitacoes.tsx:140`; schema sem o campo |
| Montador reprovado | `REPROVADO` não persiste (só `verificado:false`) → status vira `PENDENTE` → loop sem CTA de reenvio | `reprove/route.ts:96-98`; `montador/me/route.ts:171` |
| Chat | Fecha em `AGUARDANDO_FINALIZACAO` (empregador) — dead-end na negociação de finalização | `EmpregadorDetalhe.tsx:172` |
| `FINALIZADO` | Sem ação para o profissional (sem pagamento, sem avaliação reversa) | `DiaristaDetalhe.tsx:401-406` |
| Navegação | `EmpregadorMinhas` inacessível; `ProfissionalPerfil` da diarista abre o próprio perfil | `EmpregadorNavigator.tsx`; `DiaristaNavigator.tsx:55-58` |

---

## 6. Bugs críticos (validados pelo Auditor Principal)

1. **Oferta gated por KYC manual em produção** — `diaristas/buscar:132` e `montadores/buscar:74` exigem verificado; `autoVerificacao.ts:24` gateia auto-verify em `AUTO_VERIFY_PROFILES`. Em prod, sem aprovação manual, **supply = 0**.
2. **Preço "R$ 160,00" hardcoded** na confirmação — `ConfirmarSolicitacaoScreen.tsx:168`.
3. **Protocolo fake** na tela de sucesso — `SolicitacaoSucessoScreen.tsx:47`.
4. **Bairro exact-match bloqueia contratação** — `servicos/route.ts:356-360` vs busca normalizada.
5. **Montador reprovado em loop** (sem estado `REPROVADO`) — `reprove/route.ts:96-98`.
6. **Montador sem valor financeiro** (`valorEstimado` inexistente + `precoFinal=0` + sem fluxo de orçamento) — `MontadorSolicitacoes.tsx:140`, `servicos/route.ts:258`.
7. **Schema drift `DiaristaProfile.genero`** — coluna existe no banco (migration `20260508000000:29`) mas **não em `schema.prisma`** (só `User.genero:196`). `prisma migrate` pode dropar coluna; `schema.prisma` deixa de ser fonte de verdade.

---

## 7. Riscos de produção

**Segurança**
- `requireRole` confia no role do **JWT** (TTL 7d), não no banco → revogação não vale na hora `requireAuth.ts:53-62`.
- **`enderecoCompleto` exposto** em qualquer status (inclusive RECUSADO/CANCELADO) `servicos/[id]/route.ts:36-43`.
- **Rate-limit in-memory** inútil em serverless → brute-force/abuso `rateLimit.ts`.
- Score de qualquer usuário consultável por qualquer logado `usuarios/[id]/score`.
- Default de score 500 deixa usuário novo passar pelo Guardian `safeScoreGuardian.ts:118`.

**Confiabilidade/UX**
- Paywall nunca bloqueia (contrato quebrado) `useRestricoes.ts:44`.
- Dados hardcoded nos cards da Home (anos=3, "Próxima de você", "Disponível") `EmpregadorHome.tsx:65-68`.
- Label "Diarista: Pendente" em serviço de montador `EmpregadorDetalhe.tsx:324`.

**Escalabilidade**
- `take:300` sem paginação; polling 5s sem dedupe; `Servico`+`ChatRoom` sem transação; `Decimal` como string.

---

## 8. Ranking de gravidade (consolidado, deduplicado)

### CRÍTICO (bloqueiam lançamento)
| # | Achado | Evidência |
|---|---|---|
| C1 | Supply = 0 sem KYC manual (auto-verify QA-only) — diarista **e** montador | `autoVerificacao.ts:24`, `diaristas/buscar:132`, `montadores/buscar:74` |
| C2 | Preço "R$ 160,00" hardcoded na confirmação | `ConfirmarSolicitacaoScreen.tsx:168` |
| C3 | Protocolo/tempo fake na tela de sucesso | `SolicitacaoSucessoScreen.tsx:47-49` |
| C4 | Bairro exact-match bloqueia contratação silenciosamente | `servicos/route.ts:356-360` |
| C5 | Montador reprovado em loop (sem `REPROVADO`) | `reprove/route.ts:96-98`, `montador/me:171` |
| C6 | Montador sem valor financeiro / sem fluxo de orçamento | `MontadorSolicitacoes.tsx:140`, `servicos/route.ts:258` |
| C7 | Schema drift `DiaristaProfile.genero` (risco em migrate) | `schema.prisma:196` vs migration `...:29` |

### ALTO
`requireRole` por JWT (revogação 7d) · `enderecoCompleto` exposto por status · rate-limit inútil em serverless · paywall/`useRestricoes` quebrado · `EmpregadorMinhas` inacessível · dados hardcoded nos cards da Home · disponibilidade ignorada na contratação · comentários de avaliação não expostos · completude `bio` divergente (mobile ≥20 × backend não-vazio) · chat fecha em `AGUARDANDO_FINALIZACAO` · contrato `ativo`/`hasActiveService` (montador) frágil · dual SafeScore + default 500 · busca dual-source (`DiaristaHabilidade` legado × `servicosOferecidos`) · label "Diarista:" p/ montador.

### MÉDIO
Status `INICIADO` (branch morto — `EM_ANDAMENTO` cobre) · `ProfissionalPerfil` da diarista abre o próprio perfil · portfólio invisível no perfil público do montador · avaliação com nota única replicada · "Destaque" sem critério · gate de especialidades do montador ausente · sem avaliação reversa · `FINALIZADO` dead-end · `securityLevel` nunca populado · localização triplicada sem fonte única · `score` endpoint sem restrição de relação · componentes duplicados (DButton/DCard/DInput) · hooks órfãos de agendamentos.

### BAIXO
Telas `_legacy` mortas · `store/` × `stores/` duplicado · `Decimal`→string (mitigado no mobile) · `precoFinal` sem checagem de NaN na conversão BABA/COZINHEIRA · logs de debug · paths relativos longos p/ `shared/types`.

---

## 9. Tabela final

| Área | Status | Nota |
|---|---|---|
| Backend | Funcional, com dívidas de segurança e drift de schema | **3/5** |
| Empregador | Fluxo fecha, mas com dados falsos e bloqueios na contratação | **2/5** |
| Diarista | Estruturalmente pronta, **invisível** sem KYC + risco de bairro | **2/5** |
| Montador | Cadastro ok; **financeiro incompleto** + loop de reprovação | **2/5** |
| Contratação | Cria serviço, mas UX com mock e dead-ends | **2/5** |
| Serviços (ciclo) | Máquina de estados completa e operável | **3/5** |
| Segurança | Mecanismos reais, vulnerabilidades reais | **2/5** |
| **Produto Geral** | **Parcialmente funcional (piloto assistido)** | **2/5** |

---

## 10. "Se o Dular fosse lançado hoje, qual a probabilidade real de sucesso operacional?"

**Baixa — estimativa de ~15% a 25% de sucesso operacional**, com base exclusivamente no código.

**Por quê (cadeia causal no código):**
1. **Sem oferta:** a busca exige `VERIFICADO` e a verificação automática é QA-only. Sem uma operação de KYC ativa e ágil, o catálogo aparece **vazio** — o usuário empregador não encontra ninguém para contratar. Isso, sozinho, derruba a operação.
2. **Confiança quebrada no checkout:** quem chegar a contratar vê **preço falso (R$ 160)** e **protocolo falso** — exatamente onde a confiança é decisiva.
3. **Conversão bloqueada silenciosamente:** divergência de bairro retorna erro 400 sem caminho de correção, abortando contratações de profissionais que aparecem na busca.
4. **Montador não monetiza:** valor sempre R$ 0,00 e sem fluxo de orçamento; reprovado fica preso.

**O que muda o jogo:** o **núcleo técnico é recuperável** — a maioria dos críticos são correções pontuais (remover hardcodes, normalizar bairro no `create`, implementar orçamento do montador, persistir `REPROVADO`) somadas a **uma decisão operacional**: ativar e dimensionar o processo de verificação/KYC. Resolvidos os 7 críticos e estabelecido o KYC operacional, o produto migra de forma realista para a faixa de **piloto controlado com chance de sucesso moderada**.

> Conclusão: **a arquitetura está pronta para um piloto; o produto não está pronto para lançamento aberto.** O risco dominante não é técnico-estrutural — é a **dependência de KYC manual** + um punhado de **mocks/bloqueios no funil principal**.

---

*Auditoria read-only. Nenhum arquivo de código-fonte foi modificado. Achados críticos validados por leitura direta do código pelo Auditor Principal.*
