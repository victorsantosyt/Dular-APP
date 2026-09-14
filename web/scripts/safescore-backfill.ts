/**
 * Backfill do SafeScore V2 a partir do legado (PR B, etapa 1).
 *
 *   npm run safescore:backfill                                  # dry-run: só lê e relata
 *   npm run safescore:backfill -- --aplicar --host=<host>       # escreve
 *
 * `--aplicar` exige `--host=` igual ao host do DATABASE_URL. Rodar contra o
 * banco errado (local achando que é produção, e o contrário) já aconteceu neste
 * projeto; o host tem que ser digitado, não deduzido.
 *
 * Idempotente: rodar de novo sobre o mesmo estado não grava nada. Sai com
 * código 1 se alguma escrita falhar ou se, depois de aplicar, sobrar perfil V2
 * diferente do legado.
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import {
  coletarLinhas,
  executarBackfill,
  formatarRelatorio,
  planejarBackfill,
} from '../src/lib/safeScore/backfill'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL não definido.')
    process.exitCode = 1
    return
  }
  const host = new URL(url).hostname
  const args = process.argv.slice(2)
  const aplicar = args.includes('--aplicar')

  if (aplicar) {
    const confirmado = args.find((a) => a.startsWith('--host='))?.slice('--host='.length)
    if (confirmado !== host) {
      console.error(`--aplicar exige --host=${host} (o host do DATABASE_URL). Recebido: ${confirmado ?? '(nada)'}.`)
      process.exitCode = 1
      return
    }
  }

  const plano = planejarBackfill(await coletarLinhas())
  console.log(formatarRelatorio(plano, { host, modo: aplicar ? 'APLICAR' : 'DRY-RUN' }).join('\n'))

  if (!aplicar) {
    console.log(`\nDRY-RUN: nenhuma escrita. Para aplicar: npm run safescore:backfill -- --aplicar --host=${host}`)
    return
  }

  const r = await executarBackfill(plano)
  console.log(`\nAplicado: ${r.semeados} semeado(s), ${r.semMudanca} sem mudança, ${r.falhas.length} falha(s).`)
  for (const f of r.falhas) console.log(`  FALHA ${f.userId}: ${f.erro}`)

  const pos = planejarBackfill(await coletarLinhas())
  const pendentes = pos.contagem.CRIAR + pos.contagem.ATUALIZAR
  console.log(`Verificação pós-backfill: ${pendentes} usuário(s) com V2 ainda diferente do legado.`)

  if (r.falhas.length > 0 || pendentes > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
