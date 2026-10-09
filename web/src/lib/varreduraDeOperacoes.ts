import { varrerOperacoes } from "@/lib/trocaDePlano";

/**
 * Retomada AUTÔNOMA das operações Stripe gravadas (lib/trocaDePlano): roda no
 * boot do servidor — depois de uma queda, o primeiro processo novo retoma o
 * que ficou no meio, sem esperar pedido do usuário nem evento — e em seguida
 * em intervalo, enquanto o processo vive.
 *
 * Chamado só pelo `src/instrumentation.ts`, no runtime Node e por import
 * dinâmico: este módulo puxa o Prisma, que o bundle do Edge não aceita.
 *
 * Em produção serverless o intervalo é melhor esforço (a instância pode ser
 * congelada entre requisições). A hora marcada vem do cron da plataforma
 * (`/api/cron/reconciliar-stripe`, em `vercel.json`); o boot de cada instância
 * nova, os eventos da Stripe (reenviados por até 3 dias) e a rota de operações
 * completam a cobertura.
 */

const ATRASO_INICIAL_MS = 5_000;
const INTERVALO_MS = 5 * 60_000;

const estado = globalThis as unknown as { __varreduraStripe?: { rodando: boolean } };

async function rodada() {
  const atual = estado.__varreduraStripe!;
  if (atual.rodando) return;
  atual.rodando = true;
  try {
    const { examinadas, falhas } = await varrerOperacoes();
    if (examinadas > 0) console.info("[varredura-stripe] operações examinadas:", examinadas, "falhas:", falhas);
  } catch (err) {
    console.error("[varredura-stripe] rodada interrompida; as operações seguem gravadas:", err);
  } finally {
    atual.rodando = false;
  }
}

/** Uma vez por processo. Sem banco ou sem Stripe configurados, não faz nada. */
export function iniciarVarreduraDeOperacoes(): void {
  if (estado.__varreduraStripe) return;
  if (!process.env.DATABASE_URL || !process.env.STRIPE_SECRET_KEY) return;
  estado.__varreduraStripe = { rodando: false };
  setTimeout(() => void rodada(), ATRASO_INICIAL_MS).unref?.();
  setInterval(() => void rodada(), INTERVALO_MS).unref?.();
}
