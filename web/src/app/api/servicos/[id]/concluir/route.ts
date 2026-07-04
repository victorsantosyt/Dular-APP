import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertRole, assertStatus } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { confirmarFinalizacaoAtomic } from "@/lib/servicoEvento";
import { criarNotificacao } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

/**
 * Profissional sinaliza que finalizou o serviço.
 *
 * **Importante (T-14 Hotfix):** este endpoint NÃO faz mais a transição
 * direta `EM_ANDAMENTO → CONCLUIDO`. Para preservar a regra de dupla
 * confirmação e ao mesmo tempo manter compat com mobile legado, agora ele
 * **delega para a mesma lógica de `confirmar-finalizacao`**:
 *
 *  - `EM_ANDAMENTO`  → marca a confirmação do profissional → `AGUARDANDO_FINALIZACAO`
 *  - `AGUARDANDO_FINALIZACAO` → se o empregador já confirmou, vai para
 *    `CONCLUIDO`; caso contrário permanece em `AGUARDANDO_FINALIZACAO`
 *  - Mesma parte chamando duas vezes: idempotente (200 sem efeito).
 *
 * Isso evita que um profissional pule a confirmação do empregador chamando
 * `/concluir` direto.
 */
const STATUS_CONCLUIVEIS: ServicoStatus[] = ["EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"];

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    const { id } = await params;
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    const isDiarista = servico.diaristaId === auth.userId;
    const isMontador = servico.montadorId === auth.userId;
    if (!isDiarista && !isMontador) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, STATUS_CONCLUIVEIS);

    const papel = auth.role as UserRole;

    // Transição atômica (Serializable + retry) — mesma lógica compartilhada de
    // `confirmar-finalizacao`, corrigindo a corrida de dupla confirmação.
    const resultado = await confirmarFinalizacaoAtomic(servico.id, papel, auth.userId);
    if (resultado.idempotent) {
      return NextResponse.json({ ok: true, idempotent: true, servico });
    }

    const novoStatus = resultado.novoStatus;
    const updated = { ...servico, status: novoStatus };

    if (novoStatus === "CONCLUIDO") {
      // Notifica ambas as partes — empregador (destino habitual) e o próprio
      // profissional que disparou esta ação. Push para si mesmo cai no
      // aparelho via Expo Push API (best-effort).
      await criarNotificacao({
        userId: servico.clientId,
        type: "SERVICO_FINALIZADO",
        title: "Serviço finalizado",
        body: "Ambas as partes confirmaram a finalização do serviço.",
        servicoId: servico.id,
      });
      await criarNotificacao({
        userId: auth.userId,
        type: "SERVICO_FINALIZADO",
        title: "Serviço finalizado",
        body: "Confirmação dupla recebida. O serviço foi finalizado.",
        servicoId: servico.id,
      });
    } else {
      await criarNotificacao({
        userId: servico.clientId,
        type: "SERVICO_AGUARDANDO_FINALIZACAO",
        title: "Confirme a finalização",
        body: "O profissional marcou o serviço como finalizado. Confirme do seu lado.",
        servicoId: servico.id,
      });
    }

    return NextResponse.json({ ok: true, idempotent: false, servico: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
