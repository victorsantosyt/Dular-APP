import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { assertStatus } from "@/lib/regrasServico";
import { ServicoStatus } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import {
  aplicarEventoV2NaTransacao,
  aplicarLegadoESuspensao,
  type EventoPreparado,
} from "@/lib/safeScore";
import { buscarPoliticaAtiva } from "@/lib/safeScore/applyEvent";
import { criarNotificacao } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  let id: string | undefined;
  try {
    const auth = await requireAuthAtivo(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json({ ok: false, error: "Apenas empregador pode confirmar." }, { status: 403 });
    }

    ({ id } = await params);
    const servico = await prisma.servico.findUnique({ where: { id } });
    if (!servico) return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });

    if (servico.clientId !== auth.userId) {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
    }

    assertStatus(servico.status as ServicoStatus, ["CONCLUIDO"]);

    const profissionalId = servico.montadorId ?? servico.diaristaId;

    // Status e score V2 na MESMA transação. Antes o status virava CONFIRMADO
    // e só depois os eventos eram gravados: uma falha no score deixava o
    // serviço confirmado, sem evento, e sem retentativa possível (a rota
    // exige CONCLUIDO). Agora a falha no V2 reverte o status junto.
    //
    // CAS no status: duas confirmações simultâneas não passam as duas — a
    // segunda espera a trava da linha e já encontra CONFIRMADO.
    //
    // Só o V2 (autoritativo) fica dentro da transação. O legado e a
    // auto-suspensão saem para depois do commit: eles não precisam de
    // atomicidade com o status, e mantê-los aqui dentro (V2 + legado, por
    // até 2 usuários) chegava a ~20 idas ao banco na mesma transação — o
    // suficiente para encostar no timeout padrão do Prisma sob concorrência
    // e derrubar as requisições perdedoras com timeout em vez do 409
    // esperado.
    const eventos: EventoPreparado[] = [];

    const updated = await prisma.$transaction(async (tx) => {
      const cas = await tx.servico.updateMany({
        where: { id, status: "CONCLUIDO" },
        data: { status: "CONFIRMADO" },
      });
      if (cas.count === 0) throw new Error("INVALID_STATUS");

      const politica = await buscarPoliticaAtiva(tx);

      eventos.push(
        await aplicarEventoV2NaTransacao(
          tx,
          servico.clientId,
          "SERVICO_CONCLUIDO",
          servico.id,
          "Serviço confirmado pelo empregador.",
          politica,
        ),
      );
      if (profissionalId) {
        eventos.push(
          await aplicarEventoV2NaTransacao(
            tx,
            profissionalId,
            "SERVICO_CONCLUIDO",
            servico.id,
            "Serviço confirmado pelo empregador.",
            politica,
          ),
        );
      }

      return tx.servico.findUniqueOrThrow({ where: { id } });
    });

    // Fora da transação: se isto falhar, loga e segue — o status já
    // confirmou e o V2 (autoritativo) já commitou. Não derruba a confirmação
    // que o empregador já viu acontecer.
    //
    // Gap conhecido: se o legado falhar aqui, a auto-suspensão <200 baseada no
    // legado NÃO roda para este evento. É o mesmo gap já registrado como
    // decisão pendente (substituto da auto-suspensão no V2, pré-requisito para
    // remover a escrita legada). Sem retentativa por enquanto.
    for (const evento of eventos) {
      try {
        await aplicarLegadoESuspensao(evento);
      } catch (e) {
        console.error("[confirmar] falha ao gravar legado/suspensao do SafeScore", {
          userId: evento.userId,
          servicoId: servico.id,
          error: e,
        });
      }
    }

    await registrarEvento(servico.id, servico.status as ServicoStatus, "CONFIRMADO", auth.role, auth.userId);

    if (profissionalId) {
      await criarNotificacao({
        userId: profissionalId,
        type: "SERVICO_CONFIRMADO",
        title: "Serviço confirmado",
        body: "O empregador confirmou a conclusão do serviço.",
        servicoId: servico.id,
      });
    }

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;

    const msg = error instanceof Error ? error.message : "Erro";
    if (msg === "INVALID_STATUS") {
      return NextResponse.json(
        { ok: false, error: "Serviço não está mais aguardando confirmação." },
        { status: 409 },
      );
    }

    // Uma requisição perdedora pode falhar por timeout/espera de lock (não
    // pela nossa checagem INVALID_STATUS) quando a vencedora demora a
    // liberar a linha. Antes de responder 500, reconsulta o status real: se
    // já mudou, é conflito de concorrência (409), não erro de servidor.
    if (id) {
      try {
        const atual = await prisma.servico.findUnique({ where: { id }, select: { status: true } });
        if (atual && atual.status !== "CONCLUIDO") {
          console.warn("[confirmar] timeout/erro tratado como conflito de concorrência", {
            servicoId: id,
            statusAtual: atual.status,
            erroOriginal: error instanceof Error ? error.message : error,
          });
          return NextResponse.json(
            { ok: false, error: "Serviço não está mais aguardando confirmação." },
            { status: 409 },
          );
        }
      } catch {
        // Falha ao reconsultar não deve mascarar o erro original.
      }
    }

    // O erro real vai só para o log: mensagem do Prisma cita transação,
    // timeout e tabela.
    console.error("[confirmar] erro inesperado", { servicoId: id, error });
    return NextResponse.json(
      { ok: false, error: "Não foi possível confirmar o serviço. Tente novamente." },
      { status: 500 },
    );
  }
}
