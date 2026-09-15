import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { requireAuthAtivo, respostaDeSessao } from "@/lib/contaAtiva";
import { assertRole } from "@/lib/regrasServico";
import { ServicoStatus, UserRole } from "@prisma/client";
import { registrarEvento } from "@/lib/servicoEvento";
import { criarNotificacao } from "@/lib/notifications";
import {
  VerificacaoObrigatoriaError,
  verificacaoErrorResponseBody,
} from "@/lib/profileVerification";
import {
  assertGuardianProfessionalCanAcceptServico,
  GuardianBlockedError,
  guardianErrorResponseBody,
} from "@/lib/safeScoreGuardian";
import { congelarPixSnapshot } from "@/lib/pagamentoPix";
import { checkFeatureAccessWith, type FeatureAccess } from "@/lib/featureGate";

type Params = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Corrida perdida dentro da transação: id inexistente, dono errado, ou o
 * status mudou entre a leitura e o CAS (aceite duplicado / concorrente). */
class AceitarFalhaError extends Error {
  constructor(
    code: "NOT_FOUND" | "FORBIDDEN" | "INVALID_STATUS",
    readonly statusAtual: ServicoStatus | null = null,
  ) {
    super(code);
  }
}

/** Limite do plano estourado, apurado dentro da mesma transação do CAS. */
class FeatureLimitError extends Error {
  constructor(readonly access: FeatureAccess) {
    super("LIMIT_EXCEEDED");
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const auth = await requireAuthAtivo(req);
    assertRole(auth.role as UserRole, ["DIARISTA", "MONTADOR"]);

    // T-18.6: gate via SafeScore Guardian (verificação + restrições + score).
    await assertGuardianProfessionalCanAcceptServico(
      auth.userId,
      auth.role as "DIARISTA" | "MONTADOR",
    );

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const enderecoCompleto =
      typeof body?.enderecoCompleto === "string"
        ? body.enderecoCompleto
        : typeof body?.endereco === "string"
          ? body.endereco
          : null;

    // Limite do plano do PROFISSIONAL + CAS do status, na MESMA transação.
    //
    // Antes: a contagem de uso (`checkFeatureAccess`) rodava solta, fora de
    // qualquer transação, e a escrita do aceite era um `update` por id sem
    // cláusula de status no WHERE — nem o limite nem o aceite em si eram
    // atômicos. Sob concorrência isso deixava passar dois bugs — identificados
    // em auditoria de código e reproduzidos localmente sob concorrência real
    // contra Postgres, sem confirmação em log de incidente de produção:
    // (1) o mesmo profissional passando de 5 para 9 serviços
    // aceitos no mês, porque requisições paralelas liam o mesmo `used` antes
    // de qualquer uma delas gravar; e (2) o mesmo serviço aceito duas vezes
    // por chamadas simultâneas (duas leituras de status=SOLICITADO seguidas
    // de dois updates, dois 200).
    //
    // A correção:
    //   1. `pg_advisory_xact_lock` chaveado no userId do profissional
    //      serializa só as requisições DELE — outros profissionais aceitando
    //      outros serviços não são afetados — então a releitura do uso do
    //      mês abaixo já não corre risco de ver um valor obsoleto por causa
    //      de outro `aceitar` dele em voo. O lock é liberado automaticamente
    //      no fim da transação (commit ou rollback).
    //   2. O `updateMany` com `status: "SOLICITADO"` no WHERE é o CAS de
    //      verdade para o serviço em si: só uma requisição concorrente
    //      consegue de fato mudar o status (Postgres serializa updates na
    //      mesma linha), as demais recebem `count === 0` e viram 409 — nunca
    //      dois 200 para o mesmo serviço, com ou sem o advisory lock.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${auth.userId}))`;

      const servico = await tx.servico.findUnique({ where: { id } });
      if (!servico) throw new AceitarFalhaError("NOT_FOUND");

      const isDiarista = servico.diaristaId === auth.userId;
      const isMontador = servico.montadorId === auth.userId;
      if (!isDiarista && !isMontador) throw new AceitarFalhaError("FORBIDDEN");

      if (servico.status !== "SOLICITADO") {
        throw new AceitarFalhaError("INVALID_STATUS", servico.status);
      }

      // Bloqueia tanto por estourar o limite do gratuito quanto por
      // assinatura vencida: `checkFeatureAccessWith` rebaixa CANCELED/EXPIRED
      // para FREE.
      const limitePlano = await checkFeatureAccessWith(tx, auth.userId, "SOLICITACOES_MES");
      if (!limitePlano.allowed) {
        throw new FeatureLimitError(limitePlano);
      }

      const { count } = await tx.servico.updateMany({
        where: { id, status: "SOLICITADO" },
        data: {
          status: "ACEITO",
          enderecoCompleto: enderecoCompleto ?? servico.enderecoCompleto ?? null,
        },
      });
      if (count !== 1) {
        // Perdeu a corrida entre a leitura acima e este updateMany. Relê
        // para reportar o status atual certo no 409.
        const atual = await tx.servico.findUnique({ where: { id }, select: { status: true } });
        throw new AceitarFalhaError("INVALID_STATUS", atual?.status ?? null);
      }

      return tx.servico.findUniqueOrThrow({ where: { id } });
    });

    // Garante ChatRoom no aceite. Em fluxos normais o room é criado em POST
    // /api/servicos, mas serviços antigos (pré-T-16) podem não ter sala — o
    // upsert é idempotente e mantém o chat acessível assim que o aceite é
    // confirmado. Fora da transação: best-effort, não pode derrubar o aceite.
    try {
      await prisma.chatRoom.upsert({
        where: { servicoId: updated.id },
        update: {},
        create: { servicoId: updated.id },
      });
    } catch (e) {
      console.error("[servicos/aceitar] erro garantindo chatRoom:", e);
    }

    // Congela o snapshot PIX na contratação (Sprint 0.X.1): os dados de
    // recebimento deste serviço ficam imutáveis a partir daqui. Best-effort:
    // se o profissional ainda não cadastrou chave, o congelamento acontece na
    // primeira geração do PIX — o aceite nunca falha por causa disso.
    try {
      await congelarPixSnapshot(updated.id, auth.userId);
    } catch (e) {
      console.error("[servicos/aceitar] erro congelando snapshot PIX:", e);
    }

    // O CAS acima só commita quando o status anterior era SOLICITADO — o
    // `fromStatus` abaixo é seguro sem precisar guardar o valor pré-update.
    await registrarEvento(updated.id, "SOLICITADO" as ServicoStatus, "ACEITO", auth.role as UserRole, auth.userId);

    await criarNotificacao({
      userId: updated.clientId,
      type: "SERVICO_ACEITO",
      title: "Sua solicitação foi aceita",
      body: "O profissional aceitou sua solicitação. Confira os detalhes.",
      servicoId: updated.id,
    });

    return NextResponse.json({ ok: true, servico: updated });
  } catch (error: unknown) {
    if (error instanceof GuardianBlockedError) {
      return NextResponse.json(guardianErrorResponseBody(error), {
        status: error.httpStatus,
      });
    }
    if (error instanceof VerificacaoObrigatoriaError) {
      return NextResponse.json(verificacaoErrorResponseBody(error), {
        status: error.httpStatus,
      });
    }
    if (error instanceof FeatureLimitError) {
      const { access } = error;
      return NextResponse.json(
        {
          ok: false,
          error: "LIMIT_EXCEEDED",
          message:
            access.plan === "FREE"
              ? "Você usou os serviços do plano gratuito neste mês. Assine para continuar aceitando."
              : "Você atingiu o limite do seu plano neste mês.",
          feature: "SOLICITACOES_MES",
          plan: access.plan,
          usage: { used: access.used, limit: access.limit },
        },
        { status: 403 },
      );
    }
    if (error instanceof AceitarFalhaError) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
      }
      // INVALID_STATUS — status atual exposto no 409 para o mobile
      // sincronizar a UI sem re-fetch separado.
      return NextResponse.json(
        {
          ok: false,
          error:
            error.statusAtual === "ACEITO"
              ? "Serviço já aceito."
              : "Serviço não pode ser aceito neste estado.",
          statusAtual: error.statusAtual,
        },
        { status: 409 },
      );
    }
    const msg = error instanceof Error ? error.message : "Erro";
    const code = msg === "FORBIDDEN" ? 403 : msg === "INVALID_STATUS" ? 409 : 500;
    const sessao = respostaDeSessao(error);
    if (sessao) return sessao;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
