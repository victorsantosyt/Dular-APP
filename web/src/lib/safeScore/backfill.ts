import { prisma } from '@/lib/prisma'
import { getFaixa } from '@/lib/safeScore'
import { scoreToTier, semearDoLegado } from '@/lib/safeScore/applyEvent'
import { SCORE_BLOQUEIO } from '@/lib/safeScore/corte'

/**
 * Backfill do SafeScore V2 a partir do legado — PR B, etapa 1.
 *
 * Regra decidida: `SafeScoreProfile.currentScore` = `SafeScore.score` ATUAL.
 * Não recalcula pela soma dos eventos: isso apagaria ajustes feitos fora de
 * `aplicarEvento` (o banco local tem um usuário semeado com 620 por SQL cru).
 * Esses ajustes não somem — aparecem no relatório de divergências.
 *
 * O planejamento é puro (testável sem banco); coleta e execução ficam em
 * funções separadas.
 */

const SCORE_PADRAO = 500
// O corte do Guardian e das buscas; aqui só se relata quem cruzaria esse limite.
const LIMIAR_SCORE_BAIXO = SCORE_BLOQUEIO

export type LinhaUsuario = {
  userId: string
  /** null = usuário sem SafeScore legado. */
  scoreLegado: number | null
  eventosLegado: number
  somaPesosLegado: number
  /** null = usuário sem SafeScoreProfile. */
  scoreV2: number | null
  tierV2: string | null
}

export type Acao = 'CRIAR' | 'ATUALIZAR' | 'NADA' | 'SEM_LEGADO'

export type AcaoPlanejada = {
  userId: string
  acao: Acao
  de: number | null
  para: number | null
  tierDe: string | null
  tierPara: string | null
}

export type Divergencia = {
  userId: string
  scoreLegado: number
  esperadoPelosEventos: number
  diferenca: number
  eventos: number
  /** Score em 0 ou 1000: o limite do legado pode explicar parte da diferença. */
  noLimite: boolean
}

export type MudancaScoreBaixo = {
  userId: string
  scoreHoje: number
  scoreDepois: number
  baixoHoje: boolean
  baixoDepois: boolean
}

export type Plano = {
  acoes: AcaoPlanejada[]
  contagem: Record<Acao, number>
  divergencias: Divergencia[]
  mudancasScoreBaixo: MudancaScoreBaixo[]
  /** Legado < 400 mas lido hoje ≥ 400: pode ter sido liberado por engano. */
  liberadosIndevidamente: MudancaScoreBaixo[]
  /** Legado ≥ 400 mas lido hoje < 400: pode ter sido barrado por engano. */
  bloqueadosIndevidamente: MudancaScoreBaixo[]
  faixas: { hoje: Record<string, number>; depois: Record<string, number> }
  tiers: { hoje: Record<string, number>; depois: Record<string, number> }
}

/**
 * O score que as leituras usam HOJE. Todas fazem dual-read com o V2 PRIMEIRO
 * (getScoreAndTier, diaristas/buscar, montadores, montador/me, usuarios/score):
 * perfil V2 → legado → 500. Quem tem perfil já é lido pelo V2.
 */
export function scoreLidoHoje(l: LinhaUsuario): number {
  return l.scoreV2 ?? l.scoreLegado ?? SCORE_PADRAO
}

function tierLidoHoje(l: LinhaUsuario): string {
  return l.tierV2 ?? scoreToTier(l.scoreLegado ?? SCORE_PADRAO)
}

/** Depois do backfill, o V2 passa a valer o legado onde o legado existe. */
export function scoreDepoisDoBackfill(l: LinhaUsuario): number {
  return l.scoreLegado ?? l.scoreV2 ?? SCORE_PADRAO
}

function contar(valores: string[]): Record<string, number> {
  const r: Record<string, number> = {}
  for (const v of valores) r[v] = (r[v] ?? 0) + 1
  return r
}

export function planejarBackfill(linhas: LinhaUsuario[]): Plano {
  const acoes: AcaoPlanejada[] = linhas.map((l) => {
    if (l.scoreLegado === null) {
      // Sem legado não há o que copiar. O perfil V2 que existir segue como está
      // — e já é o que as leituras usam.
      return { userId: l.userId, acao: 'SEM_LEGADO', de: l.scoreV2, para: l.scoreV2, tierDe: l.tierV2, tierPara: l.tierV2 }
    }
    const tierPara = scoreToTier(l.scoreLegado)
    const acao: Acao =
      l.scoreV2 === null
        ? 'CRIAR'
        : l.scoreV2 !== l.scoreLegado || l.tierV2 !== tierPara
          ? 'ATUALIZAR'
          : 'NADA'
    return { userId: l.userId, acao, de: l.scoreV2, para: l.scoreLegado, tierDe: l.tierV2, tierPara }
  })

  const contagem: Record<Acao, number> = { CRIAR: 0, ATUALIZAR: 0, NADA: 0, SEM_LEGADO: 0 }
  for (const a of acoes) contagem[a.acao]++

  const divergencias: Divergencia[] = []
  for (const l of linhas) {
    if (l.scoreLegado === null) continue
    const esperado = SCORE_PADRAO + l.somaPesosLegado
    if (l.scoreLegado !== esperado) {
      divergencias.push({
        userId: l.userId,
        scoreLegado: l.scoreLegado,
        esperadoPelosEventos: esperado,
        diferenca: l.scoreLegado - esperado,
        eventos: l.eventosLegado,
        noLimite: l.scoreLegado === 0 || l.scoreLegado === 1000,
      })
    }
  }

  const mudancasScoreBaixo: MudancaScoreBaixo[] = []
  for (const l of linhas) {
    const hoje = scoreLidoHoje(l)
    const depois = scoreDepoisDoBackfill(l)
    const baixoHoje = hoje < LIMIAR_SCORE_BAIXO
    const baixoDepois = depois < LIMIAR_SCORE_BAIXO
    if (baixoHoje !== baixoDepois) {
      mudancasScoreBaixo.push({ userId: l.userId, scoreHoje: hoje, scoreDepois: depois, baixoHoje, baixoDepois })
    }
  }

  return {
    acoes,
    contagem,
    divergencias,
    mudancasScoreBaixo,
    // "Depois" é o legado: quem é baixo no legado e não é baixo na leitura de
    // hoje (V2) está liberado sem dever estar.
    liberadosIndevidamente: mudancasScoreBaixo.filter((m) => !m.baixoHoje && m.baixoDepois),
    bloqueadosIndevidamente: mudancasScoreBaixo.filter((m) => m.baixoHoje && !m.baixoDepois),
    faixas: {
      hoje: contar(linhas.map((l) => getFaixa(scoreLidoHoje(l)).label)),
      depois: contar(linhas.map((l) => getFaixa(scoreDepoisDoBackfill(l)).label)),
    },
    tiers: {
      hoje: contar(linhas.map(tierLidoHoje)),
      depois: contar(linhas.map((l) => scoreToTier(scoreDepoisDoBackfill(l)))),
    },
  }
}

/** Todo usuário que tenha ao menos um dos dois ledgers. */
export async function coletarLinhas(): Promise<LinhaUsuario[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string
      scoreLegado: number | null
      eventosLegado: bigint | number
      somaPesosLegado: bigint | number
      scoreV2: number | null
      tierV2: string | null
    }>
  >`
    SELECT u.id AS "userId",
           s.score AS "scoreLegado",
           COALESCE(e.qtd, 0) AS "eventosLegado",
           COALESCE(e.soma, 0) AS "somaPesosLegado",
           p."currentScore" AS "scoreV2",
           p.tier::text AS "tierV2"
    FROM "User" u
    LEFT JOIN "SafeScore" s ON s."userId" = u.id
    LEFT JOIN (
      SELECT "safeScoreId", count(*) AS qtd, sum(peso) AS soma
      FROM "ScoreEvento"
      GROUP BY "safeScoreId"
    ) e ON e."safeScoreId" = s.id
    LEFT JOIN "SafeScoreProfile" p ON p."userId" = u.id
    WHERE s.id IS NOT NULL OR p.id IS NOT NULL
    ORDER BY u.id
  `
  return rows.map((r) => ({
    userId: r.userId,
    scoreLegado: r.scoreLegado,
    eventosLegado: Number(r.eventosLegado),
    somaPesosLegado: Number(r.somaPesosLegado),
    scoreV2: r.scoreV2,
    tierV2: r.tierV2,
  }))
}

export type Forense = {
  userId: string
  perfilV2CriadoEm: Date | null
  primeiroEventoV2Em: Date | null
  eventosV2: number
  /** Serviços criados como cliente desde que o perfil V2 existe. */
  servicosCriadosComoCliente: number
  /** Serviços em que atuou como profissional, mexidos desde que o perfil V2 existe (fora de SOLICITADO). */
  servicosComoProfissional: number
}

/**
 * Auditoria só de leitura para quem a leitura de hoje trata diferente do
 * legado: desde quando o perfil V2 manda na leitura, e o que a pessoa fez nesse
 * período que o score deveria ter barrado ou permitido.
 */
export async function coletarForense(userIds: string[]): Promise<Forense[]> {
  if (userIds.length === 0) return []
  const rows = await prisma.$queryRaw<
    Array<{
      userId: string
      perfilV2CriadoEm: Date | null
      primeiroEventoV2Em: Date | null
      eventosV2: bigint | number
      servicosCriadosComoCliente: bigint | number
      servicosComoProfissional: bigint | number
    }>
  >`
    SELECT u.id AS "userId",
           p."createdAt" AS "perfilV2CriadoEm",
           (SELECT min(e."createdAt") FROM "SafeScoreEvent" e WHERE e."userId" = u.id) AS "primeiroEventoV2Em",
           (SELECT count(*) FROM "SafeScoreEvent" e WHERE e."userId" = u.id) AS "eventosV2",
           (SELECT count(*) FROM "Servico" s
             WHERE s."clientId" = u.id AND p."createdAt" IS NOT NULL AND s."createdAt" >= p."createdAt") AS "servicosCriadosComoCliente",
           (SELECT count(*) FROM "Servico" s
             WHERE (s."diaristaId" = u.id OR s."montadorId" = u.id)
               AND p."createdAt" IS NOT NULL AND s."updatedAt" >= p."createdAt"
               AND s.status <> 'SOLICITADO') AS "servicosComoProfissional"
    FROM "User" u
    LEFT JOIN "SafeScoreProfile" p ON p."userId" = u.id
    WHERE u.id = ANY(${userIds})
    ORDER BY u.id
  `
  return rows.map((r) => ({
    userId: r.userId,
    perfilV2CriadoEm: r.perfilV2CriadoEm,
    primeiroEventoV2Em: r.primeiroEventoV2Em,
    eventosV2: Number(r.eventosV2),
    servicosCriadosComoCliente: Number(r.servicosCriadosComoCliente),
    servicosComoProfissional: Number(r.servicosComoProfissional),
  }))
}

export type ResultadoBackfill = {
  semeados: number
  semMudanca: number
  falhas: Array<{ userId: string; erro: string }>
}

export async function executarBackfill(plano: Plano): Promise<ResultadoBackfill> {
  const resultado: ResultadoBackfill = { semeados: 0, semMudanca: 0, falhas: [] }
  for (const a of plano.acoes) {
    if (a.acao !== 'CRIAR' && a.acao !== 'ATUALIZAR') continue
    try {
      // Relê o legado logo antes de semear: estreita a janela para um evento que
      // chegue entre o relatório e a escrita.
      const legado = await prisma.safeScore.findUnique({ where: { userId: a.userId }, select: { score: true } })
      if (!legado) {
        resultado.falhas.push({ userId: a.userId, erro: 'SafeScore legado sumiu entre o plano e a escrita' })
        continue
      }
      const r = await semearDoLegado(a.userId, legado.score)
      if (r.status === 'semeado') resultado.semeados++
      else resultado.semMudanca++
    } catch (e) {
      resultado.falhas.push({ userId: a.userId, erro: e instanceof Error ? e.message : String(e) })
    }
  }
  return resultado
}

function linhaDistribuicao(titulo: string, hoje: Record<string, number>, depois: Record<string, number>): string[] {
  const chaves = [...new Set([...Object.keys(hoje), ...Object.keys(depois)])].sort()
  return [
    titulo,
    ...chaves.map((k) => `  ${k.padEnd(18)} hoje=${String(hoje[k] ?? 0).padStart(4)}  depois=${String(depois[k] ?? 0).padStart(4)}`),
  ]
}

function iso(d: Date | null): string {
  return d ? new Date(d).toISOString() : '—'
}

export function formatarRelatorio(
  plano: Plano,
  opcoes: { host: string; modo: string; forense?: Forense[] },
): string[] {
  const l: string[] = []
  l.push('=== SafeScore — backfill do V2 a partir do legado ===')
  l.push(`Banco: ${opcoes.host}   Modo: ${opcoes.modo}`)
  l.push('')
  l.push(`Usuários com algum ledger: ${plano.acoes.length}`)
  l.push(`  CRIAR perfil V2:     ${plano.contagem.CRIAR}`)
  l.push(`  ATUALIZAR perfil V2: ${plano.contagem.ATUALIZAR}`)
  l.push(`  NADA (já igual):     ${plano.contagem.NADA}`)
  l.push(`  SEM_LEGADO (V2 só):  ${plano.contagem.SEM_LEGADO}`)
  l.push('')
  l.push(...linhaDistribuicao('Faixa lida (hoje × depois):', plano.faixas.hoje, plano.faixas.depois))
  l.push(...linhaDistribuicao('Tier (hoje × depois):', plano.tiers.hoje, plano.tiers.depois))
  l.push('')
  l.push(`score_baixo (< ${LIMIAR_SCORE_BAIXO}) que MUDA entre a leitura de hoje e a de depois: ${plano.mudancasScoreBaixo.length}`)
  const forense = new Map((opcoes.forense ?? []).map((f) => [f.userId, f]))
  const secao = (titulo: string, lista: MudancaScoreBaixo[]) => {
    l.push(`  ${titulo}: ${lista.length}`)
    for (const m of lista) {
      l.push(`    ${m.userId}  legado=${m.scoreDepois}  lido hoje (V2)=${m.scoreHoje}`)
      const f = forense.get(m.userId)
      if (f) {
        l.push(
          `      perfil V2 desde ${iso(f.perfilV2CriadoEm)} · 1º evento V2 ${iso(f.primeiroEventoV2Em)} · eventos V2=${f.eventosV2}` +
            ` · serviços criados como cliente desde então=${f.servicosCriadosComoCliente}` +
            ` · como profissional desde então=${f.servicosComoProfissional}`,
        )
      }
    }
  }
  secao(`Possivelmente LIBERADOS por engano (legado < ${LIMIAR_SCORE_BAIXO}, lido hoje ≥ ${LIMIAR_SCORE_BAIXO})`, plano.liberadosIndevidamente)
  secao(`Possivelmente BARRADOS por engano (legado ≥ ${LIMIAR_SCORE_BAIXO}, lido hoje < ${LIMIAR_SCORE_BAIXO})`, plano.bloqueadosIndevidamente)
  l.push('')
  l.push(`Divergências SafeScore.score × 500 + soma dos eventos: ${plano.divergencias.length}`)
  for (const d of plano.divergencias) {
    l.push(
      `  ${d.userId}  legado=${d.scoreLegado}  esperado=${d.esperadoPelosEventos}  diferença=${d.diferenca > 0 ? '+' : ''}${d.diferenca}  eventos=${d.eventos}${d.noLimite ? '  (no limite 0/1000)' : ''}`,
    )
  }
  const mudancas = plano.acoes.filter((a) => a.acao === 'CRIAR' || a.acao === 'ATUALIZAR')
  if (mudancas.length) {
    l.push('')
    l.push('Perfis V2 que mudam:')
    for (const a of mudancas) {
      l.push(`  ${a.acao.padEnd(9)} ${a.userId}  ${a.de ?? '—'} (${a.tierDe ?? '—'}) → ${a.para} (${a.tierPara})`)
    }
  }
  return l
}
