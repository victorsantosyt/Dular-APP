import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { assertStatus } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { jaConfirmouFinalizacao, registrarEvento } from "@/lib/servicoEvento";
import { criarNotificacao } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * Endpoint de **dupla confirmação** de finalização.
 *
 * Funciona para ambas as partes:
 *   - empregador (clientId)
 *   - profissional (diaristaId / montadorId)
 *
 * Regras:
 *   - status EM_ANDAMENTO → primeira parte confirma → AGUARDANDO_FINALIZACAO
 *   - status AGUARDANDO_FINALIZACAO → outra parte confirma → CONCLUIDO
 *       (o caminho legado `confirmar` (empregador) + `avaliar` continua
 *        fechando o ciclo a partir de CONCLUIDO → CONFIRMADO → FINALIZADO)
 *   - chamadas duplicadas pelo mesmo papel são idempotentes (200 sem efeito)
 *
 * Nota técnica: enquanto não houver colunas dedicadas
 * `confirmadoPorEmpregador` / `confirmadoPorProfissional` em `Servico`,
 * usamos `ServicoEvento` como fonte da verdade da confirmação por papel.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const auth = requireAuth(req);
    const { id } = await params;

    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const isCliente = servico.clientId === auth.userId;
    const isDiarista = servico.diaristaId === auth.userId;
    const isMontador = servico.montadorId === auth.userId;
    const isProfissional = isDiarista || isMontador;

    if (!isCliente && !isProfissional) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    const papel: UserRole = isCliente ? "EMPREGADOR" : (auth.role as UserRole);

    assertStatus(servico.status as ServicoStatus, ["EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"]);

    const minhaConfirmacao = await jaConfirmouFinalizacao(servico.id, papel);
    if (minhaConfirmacao) {
      return NextResponse.json({
        ok: true,
        idempotent: true,
        confirmadoPorEmpregador: papel === "EMPREGADOR" ? true : await jaConfirmouFinalizacao(servico.id, "EMPREGADOR"),
        confirmadoPorProfissional:
          papel === "EMPREGADOR"
            ? await jaConfirmouFinalizacaoProfissional(servico.id)
            : true,
        servico,
      });
    }

    const outroJaConfirmou = isCliente
      ? await jaConfirmouFinalizacaoProfissional(servico.id)
      : await jaConfirmouFinalizacao(servico.id, "EMPREGADOR");

    const novoStatus: ServicoStatus = outroJaConfirmou ? "CONCLUIDO" : "AGUARDANDO_FINALIZACAO";

    const updated = await prisma.servico.update({
      where: { id },
      data: { status: novoStatus },
    });

    await registrarEvento(servico.id, servico.status as ServicoStatus, novoStatus, papel, auth.userId);

    const destinoId = isCliente ? servico.montadorId ?? servico.diaristaId : servico.clientId;
    if (destinoId) {
      if (novoStatus === "CONCLUIDO") {
        // Quando ambas as partes confirmaram, notifica os dois lados.
        // Quem está executando este endpoint (auth.userId) também recebe
        // a notificação in-app — fica explícito no histórico que o serviço
        // foi finalizado. Push remoto para si mesmo é redundante, mas o
        // helper trata isso (token único, mensagem chega no aparelho).
        await criarNotificacao({
          userId: destinoId,
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
          userId: destinoId,
          type: "SERVICO_AGUARDANDO_FINALIZACAO",
          title: "Confirme a finalização",
          body: isCliente
            ? "O empregador marcou o serviço como finalizado. Confirme do seu lado."
            : "O profissional marcou o serviço como finalizado. Confirme do seu lado.",
          servicoId: servico.id,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      idempotent: false,
      confirmadoPorEmpregador: papel === "EMPREGADOR" || (await jaConfirmouFinalizacao(servico.id, "EMPREGADOR")),
      confirmadoPorProfissional:
        papel !== "EMPREGADOR" || (await jaConfirmouFinalizacaoProfissional(servico.id)),
      servico: updated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "INVALID_STATUS" ? 409 : 500;
    if (msg === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}

async function jaConfirmouFinalizacaoProfissional(servicoId: string): Promise<boolean> {
  const [d, m] = await Promise.all([
    jaConfirmouFinalizacao(servicoId, "DIARISTA"),
    jaConfirmouFinalizacao(servicoId, "MONTADOR"),
  ]);
  return d || m;
}
