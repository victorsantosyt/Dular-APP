import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { cleanupRateLimit, rateLimit, rateLimitRetryAfterMs } from "@/lib/rateLimit";
import { getRequestIp } from "@/lib/requestIp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Opinião sobre o APP, vinda de dentro dele.
 *
 * SOMENTE ESCRITA. A leitura é do painel (lib/adminFeedback.ts) — não existe GET
 * aqui e não deve passar a existir: a lista é de todo mundo, e quem manda um
 * feedback não tem por que ler o dos outros.
 */
const TIPOS = ["SUGESTAO", "PROBLEMA", "ELOGIO", "OUTRO"] as const;

const feedbackSchema = z.object({
  tipo: z.enum(TIPOS).default("SUGESTAO"),
  // Mínimo de 5 para barrar "oi" e toque acidental; 1000 porque o que passa
  // disso é conversa, e conversa é com o suporte.
  mensagem: z.string().trim().min(5).max(1000),
  // A nota é opcional de propósito: exigir estrela transformaria um desabafo em
  // formulário, e quem quer só escrever desistiria.
  nota: z.coerce.number().int().min(1).max(5).optional(),
  origem: z.string().trim().max(60).optional(),
  appVersao: z.string().trim().max(30).optional(),
  plataforma: z.string().trim().max(20).optional(),
});

export async function POST(req: Request) {
  try {
    const auth = await requireAuthAtivo(req);

    // Texto livre autenticado: sem teto, um laço de retry no app (ou alguém
    // irritado tocando "Enviar") vira centenas de linhas iguais na fila da
    // operação. O limite é por usuário, não por IP — casa e escritório
    // compartilham IP.
    cleanupRateLimit();
    const rl = rateLimit({ key: `feedback:${auth.userId}`, limit: 5, windowMs: 10 * 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Você enviou várias mensagens seguidas. Tente de novo daqui a pouco.",
          retryAfterMs: rateLimitRetryAfterMs(rl.resetAt),
        },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Escreva pelo menos algumas palavras sobre o que aconteceu." },
        { status: 400 },
      );
    }

    const { tipo, mensagem, nota, origem, appVersao, plataforma } = parsed.data;

    const feedback = await prisma.feedback.create({
      data: {
        userId: auth.userId,
        tipo,
        mensagem,
        nota: nota ?? null,
        origem: origem ?? null,
        appVersao: appVersao ?? null,
        plataforma: plataforma ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // O IP entra no log, não na tabela: serve para investigar abuso agora e não
    // há por que guardá-lo junto de uma opinião pelos próximos anos.
    if (process.env.NODE_ENV === "development") {
      console.log(`[feedback] ${tipo} de ${auth.userId} (${getRequestIp(req)})`);
    }

    return NextResponse.json({ ok: true, id: feedback.id }, { status: 201 });
  } catch (e: any) {
    const sessao = respostaDeSessao(e);
    if (sessao) return sessao;
    return NextResponse.json(
      { ok: false, error: "Não foi possível enviar agora. Tente novamente." },
      { status: 500 },
    );
  }
}
