# PLANO DE CORREÇÃO PRIORIZADO — PILOTO 100 EMPREGADORES / 30 DIAS
**Data:** 2026-06-18 · **Branch:** `fix/piloto-blockers-p0p1`
**Critério de prioridade:** impacto direto no funil do empregador (achar → contratar → serviço acontece → confiança/segurança).
**Esforço:** S ≈ <2h · M ≈ meio dia · L ≈ 1–2 dias (dev).

---

## P0 — Bloqueiam o piloto (sem isso, não roda)

| ID | Problema | Correção | Domínio | Esforço |
|---|---|---|---|---|
| **P0-1** | Oferta invisível: busca exige `VERIFICADO`/`verificado` e auto-verify é QA-only → supply 0 | **Auto-verificação segura** em produção (flag `KYC_AUTO_VERIFY`): promove a VERIFICADO quando perfil completo + documentos enviados + SafeScore não bloqueado + sem REPROVADO admin; com auditoria e revogável. Mantém kill-switch e override admin. | backend | **L** |
| **P0-2** | Bairro exact-match bloqueia contratação de quem aparece na busca | Normalizar bairro no `POST /api/servicos` (mesma normalização da busca) antes do `findUnique`; 400 só se realmente ausente | backend | **S–M** |
| **P0-3** | Preço "R$ 160,00" hardcoded na confirmação | Exibir preço real do perfil (ou "A combinar"/"A orçar"); nunca literal fixo. Threading do preço pelo ServiceFlow | frontend | **M** |
| **P0-4** | Protocolo/tempo fake na tela de sucesso | Usar `servicoId` real (protocolo derivado) + timestamp real | frontend | **S** |
| **P0-5** | Cards da Home com dados inventados (anos=3, "Próxima de você", "Disponível") | Usar dado real quando existir; omitir o que não vier da API. Sem dado falso | frontend | **S** |
| **P0-6** | `enderecoCompleto` exposto em qualquer status | Filtrar por status (só após aceite, p/ participante) em `GET /api/servicos/[id]`, espelhando `/minhas` | backend | **S** |

## P1 — Confiabilidade/confiança (endurecimento do piloto)

| ID | Problema | Correção | Domínio | Esforço |
|---|---|---|---|---|
| **P1-7** | Disponibilidade da diarista ignorada na contratação | Validar data/turno contra `Disponibilidade` no `POST /api/servicos` (se vazia, tratar como disponível) | backend | **M** |
| **P1-8** | Chat fecha em `AGUARDANDO_FINALIZACAO` | Incluir `AGUARDANDO_FINALIZACAO` (e `CONCLUIDO`) em `chatLiberado` | frontend | **S** |
| **P1-9** | Montador exibe "R$ 0,00" | Exibir "A orçar" quando `precoFinal=0`/sem valor. *(Fluxo completo de orçamento pós-aceite fica como follow-up L.)* | frontend | **S** |
| **P1-10** | Avaliações (comentários) não expostas ao empregador | Endpoint público retorna `avaliacoes.itens` (comentário) + perfil exibe | backend+frontend | **M** |
| **P1-11** | Montador reprovado em loop (sem `REPROVADO`) | Derivar `REPROVADO` do registro KYC existente em `getMontadorVerificationStatus` → CTA de reenvio aparece | backend | **S–M** |
| **P1-12** | Drift de schema `DiaristaProfile.genero` | Alinhar `schema.prisma` à coluna existente (sem perda de dados) | database | **S** |

## Fora do top-10 do piloto (adiados conscientemente)
- Paywall/`useRestricoes` quebrado → *falha aberto*, não impede uso (afeta receita) — corrigir antes do lançamento aberto.
- `requireRole` por JWT, rate-limit in-memory → dívida de segurança; P0 **pré-lançamento aberto**, não pré-piloto controlado.
- `EmpregadorMinhas` morta, `INICIADO` branch morto → não quebram o loop.

## Auto-verificação segura — design (P0-1)
- **Gatilho:** ao completar perfil / enviar documentos (já chamado em `diarista/me`, `montador/me`, `verificacoes`).
- **Critérios p/ promover a VERIFICADO:** (1) perfil completo; (2) documentos obrigatórios presentes; (3) SafeScore ≥ limite e sem SHADOW_BAN/hardBan; (4) **nunca** reverter um REPROVADO de admin.
- **Controles compensatórios:** registro de auditoria (auto + timestamp + critérios), **revogável** por admin, kill-switch via env, Guardian como segunda barreira. Documentos são **exigidos presentes** mas não têm conteúdo validado automaticamente — tradeoff consciente, adequado a piloto controlado com revisão amostral.
- **Dimensionamento KYC:** com auto-verify seguro ligado, a aprovação manual vira **exceção/spot-check**, não gargalo — sustenta 100 empregadores sem fila humana.
