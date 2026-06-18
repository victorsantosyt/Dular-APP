# RELATÓRIO DE MATURIDADE — DULAR
**Auditor Principal (consolidação do SUB-AGENTE 7)**
**Data:** 2026-06-18
**Base:** código real (web/ + dular-mobile/), achados validados por spot-check direto no código.

## Escala
`0` inexistente · `1` protótipo · `2` parcialmente funcional · `3` funcional · `4` quase pronto p/ produção · `5` pronto p/ produção

---

## Quadro de maturidade por módulo

| Módulo | Nota | Classificação | Justificativa (evidência) |
|---|---|---|---|
| **Autenticação** | **3** | Funcional | OAuth Google/Apple + JWT + gates pós-login (gênero/serviços) funcionam. Dívidas de segurança: `requireRole` valida role do **JWT, não do banco** (revogação só vale após expiração de 7 dias) `requireAuth.ts:53-62`; rate-limit **in-memory** inútil em serverless `rateLimit.ts:1-7`; Apple via catchall NextAuth (sem rota dedicada). |
| **Perfis** | **3** | Funcional | Os 3 perfis têm cadastro/edição persistindo no backend. Problemas: **drift de schema** `DiaristaProfile.genero` existe no banco mas não em `schema.prisma:196` (só `User.genero`); montador reprovado sem estado `REPROVADO`; completude divergente mobile×backend; dados hardcoded em cards. |
| **Busca / Matching** | **3** | Funcional | Motor sólido (localização, filtros, Guardian) `diaristas/buscar/route.ts`. Mas: **só lista profissionais `VERIFICADO`** (linha 132) e a auto-verificação é **QA-only** (`autoVerificacao.ts:24`); disponibilidade não filtra; busca por `tipo` usa tabela legada `DiaristaHabilidade` (dual-source); "Profissionais em destaque" é alias da busca geral. |
| **Contratação** | **2** | Parcialmente funcional | O loop **cria** o `Servico` ponta a ponta, mas a tela engana o usuário: **preço "R$ 160,00" hardcoded** `ConfirmarSolicitacaoScreen.tsx:168`; **protocolo fake** `SolicitacaoSucessoScreen.tsx:47`; **bairro exact-match** bloqueia contratação de quem aparece na busca `servicos/route.ts:356-360`; montador cria `precoFinal=0` sem fluxo de orçamento. |
| **Serviços (ciclo de vida)** | **3** | Funcional | Máquina de estados completa (10 status) com todos os endpoints de transição `schema.prisma:134-145`. Mas: status `INICIADO` usado no mobile não existe no enum (branch morto); dois endpoints "confirmar" confusos; chat fecha em `AGUARDANDO_FINALIZACAO`; `FINALIZADO` é dead-end p/ o profissional; sem avaliação reversa. |
| **Avaliações** | **3** | Funcional | Empregador→profissional funciona ponta a ponta (tela→endpoint→persistência→recompute stats→SafeScore) `avaliar/route.ts`. Limitações: nota única replicada nas 4 dimensões; comentários **não expostos** ao empregador no perfil público; sem avaliação do profissional→empregador. |
| **Administração / KYC** | **2** | Parcialmente funcional | Painel admin com `approve`/`reprove` e `requireAdmin` validando no banco. Mas **não há processo operacional automatizado**; reprovação de **montador não persiste `REPROVADO`** (só `verificado:false`) `reprove/route.ts:96-98`, deixando o montador em loop de espera. |
| **Segurança** | **2** | Parcialmente funcional | Existem mecanismos reais (Guardian/SafeScore, requireAuth, SOS/checkin). Mas: role do JWT sem revalidação; **`enderecoCompleto` exposto** em qualquer status `servicos/[id]/route.ts:36-43`; rate-limit inútil; score de qualquer usuário consultável por qualquer logado; default de score 500 deixa novos usuários passarem pelo Guardian. |
| **Pagamentos / Monetização** | **1** | Protótipo | Stripe/checkout e planos existem como endpoints, mas o **paywall não funciona**: `useRestricoes` espera `{plano,limites,uso}` e o backend retorna `{restrictions:[]}` `useRestricoes.ts:44`; pagamento in-app é placeholder "em breve"; montador sem preço final no contrato. |
| **Escalabilidade** | **2** | Parcialmente funcional | `take:300` sem paginação; polling de 5s sem dedupe/cache; rate-limit não distribuído; `Servico`+`ChatRoom` sem transação; `Decimal` serializado como string. Suporta MVP pequeno, não escala como está. |
| **Frontend / Navegação** | **3** | Funcional | 4 navegadores sólidos, cobertura boa de loading/error/empty na maioria das telas. Dívidas: `EmpregadorMinhas` registrada em `routes.ts` mas **não no navigator** (tela morta); `ProfissionalPerfil` da diarista renderiza o próprio perfil; componentes duplicados; telas `_legacy` mortas. |

---

## Nota geral do produto: **2 / 5 — Parcialmente funcional (protótipo avançado)**

O esqueleto do marketplace existe e o ciclo técnico fecha em ambiente de QA. Em produção, porém, o produto **não opera sozinho**: a oferta depende de KYC manual não-automatizado e o funil de contratação exibe dados falsos e tem bloqueios silenciosos. É um produto em estágio de **beta fechado/piloto assistido**, não de lançamento aberto.

### Como subir cada nota (resumo)
- **Contratação 2→4:** remover preço/protocolo hardcoded; corrigir match de bairro (normalizar no `create`); implementar orçamento do montador.
- **KYC/Admin 2→4:** processo de aprovação operacional + estado `REPROVADO` para montador.
- **Segurança 2→4:** role do banco em `requireRole`; rate-limit distribuído; filtrar `enderecoCompleto` por status.
- **Monetização 1→3:** alinhar contrato `useRestricoes`↔backend.
