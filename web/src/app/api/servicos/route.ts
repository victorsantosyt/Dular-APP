import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { criarServicoSchema } from "@/lib/schemas/servicos";
import { criarNotificacao } from "@/lib/notifications";
import { calcularCompletudeMontador } from "@/lib/montadorProfile";
import {
  isDiaristaProfileCompleteForServico,
  nichoFromTipo,
  nichoFromCategoria,
} from "@/lib/diaristaProfile";
import {
  VerificacaoObrigatoriaError,
  verificacaoErrorResponseBody,
} from "@/lib/profileVerification";
import {
  assertGuardianCanCreateServico,
  assertGuardianProfessionalCanReceiveServico,
  GuardianBlockedError,
  guardianErrorResponseBody,
} from "@/lib/safeScoreGuardian";
import { checkFeatureAccess } from "@/lib/featureGate";

export const dynamic = "force-dynamic";

// Status considerados "ativos" para fins de bloqueio de duplicidade.
// Status encerrados (NÃO bloqueiam nova contratação):
//   CONCLUIDO, CONFIRMADO, FINALIZADO, CANCELADO, RECUSADO, RASCUNHO.
// Observação: `PENDENTE` foi removido — nunca foi valor formal do enum
// `ServicoStatus` (T-14 Hotfix).
const ACTIVE_SERVICE_STATUSES = [
  "SOLICITADO",
  "ACEITO",
  "EM_ANDAMENTO",
  "AGUARDANDO_FINALIZACAO",
] as const;

// Mantido como alias para legibilidade nos callers existentes.
const ACTIVE_MONTADOR_SERVICE_STATUSES = ACTIVE_SERVICE_STATUSES;

async function findActiveMontadorService(montadorUserId: string) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status", "createdAt", "updatedAt"
    FROM "Servico"
    WHERE "montadorId" = ${montadorUserId}
      AND "status"::text IN (${Prisma.join(ACTIVE_MONTADOR_SERVICE_STATUSES)})
    ORDER BY "createdAt" DESC
    LIMIT 1
  `);

  return rows[0] ?? null;
}

async function findActiveServiceBetween(
  clientId: string,
  profissionalId: string,
  profissionalKind: "diarista" | "montador",
) {
  const rows = profissionalKind === "diarista"
    ? await prisma.$queryRaw<
        Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>
      >(Prisma.sql`
        SELECT "id", "status"::text AS "status", "createdAt", "updatedAt"
        FROM "Servico"
        WHERE "clientId" = ${clientId}
          AND "diaristaId" = ${profissionalId}
          AND "status"::text IN (${Prisma.join(ACTIVE_SERVICE_STATUSES)})
        ORDER BY "createdAt" DESC
        LIMIT 1
      `)
    : await prisma.$queryRaw<
        Array<{ id: string; status: string; createdAt: Date; updatedAt: Date }>
      >(Prisma.sql`
        SELECT "id", "status"::text AS "status", "createdAt", "updatedAt"
        FROM "Servico"
        WHERE "clientId" = ${clientId}
          AND "montadorId" = ${profissionalId}
          AND "status"::text IN (${Prisma.join(ACTIVE_SERVICE_STATUSES)})
        ORDER BY "createdAt" DESC
        LIMIT 1
      `);
  return rows[0] ?? null;
}

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "EMPREGADOR") {
      return NextResponse.json({ ok: false, error: "Apenas empregador pode solicitar." }, { status: 403 });
    }

    // T-18.6: gate via SafeScore Guardian. Compõe verificação documental,
    // restrições ativas, score/tier e role. Substitui o gate isolado de
    // T-18.5 (que só olhava DocumentVerification do empregador).
    await assertGuardianCanCreateServico(auth.userId);

    const solicitacoesAccess = await checkFeatureAccess(auth.userId, "SOLICITACOES_MES");
    if (!solicitacoesAccess.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "LIMIT_EXCEEDED",
          message: "Você atingiu o limite de solicitações do seu plano atual.",
          feature: "SOLICITACOES_MES",
          plan: solicitacoesAccess.plan,
          usage: {
            used: solicitacoesAccess.used,
            limit: solicitacoesAccess.limit,
          },
        },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = criarServicoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
    }

    const {
      tipo,
      categoria,
      dataISO,
      turno,
      cidade,
      uf,
      bairro,
      diaristaUserId,
      montadorUserId,
      enderecoCompleto,
      observacoes,
      temPet,
      quartos3Mais,
      banheiros2Mais,
    } = parsed.data;

    const CAT_BY_TIPO: Record<string, string[]> = {
      FAXINA: ["FAXINA_LEVE", "FAXINA_PESADA", "FAXINA_COMPLETA"],
      BABA: ["BABA_DIURNA", "BABA_NOTURNA", "BABA_INTEGRAL"],
      COZINHEIRA: ["COZINHEIRA_DIARIA", "COZINHEIRA_EVENTO"],
      PASSA_ROUPA: ["PASSA_ROUPA_BASICO", "PASSA_ROUPA_COMPLETO"],
      MONTADOR: [
        "MONTADOR_MONTAGEM",
        "MONTADOR_REPAROS",
        "MONTADOR_ELETRICA",
        "MONTADOR_HIDRAULICA",
        "MONTADOR_PINTURA",
        "MONTADOR_CARPINTARIA",
      ],
    };
    if (categoria && !CAT_BY_TIPO[tipo]?.includes(categoria)) {
      return NextResponse.json({ ok: false, error: "Categoria inválida para este tipo." }, { status: 400 });
    }

    const data = new Date(dataISO);
    if (isNaN(data.getTime())) {
      return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
    }

    // ─── Branch MONTADOR ─────────────────────────────────────────────────────
    if (tipo === "MONTADOR") {
      const profissionalId = montadorUserId ?? diaristaUserId;
      if (!profissionalId) {
        return NextResponse.json(
          { ok: false, error: "Informe montadorUserId." },
          { status: 400 },
        );
      }

      const userMontador = await prisma.user.findUnique({ where: { id: profissionalId } });
      if (!userMontador || userMontador.role !== "MONTADOR" || userMontador.status !== "ATIVO") {
        return NextResponse.json({ ok: false, error: "Montador inválido." }, { status: 400 });
      }

      // T-18.6: gate via SafeScore Guardian. Aplica verificação +
      // restrições + score; mantém alinhamento com /api/montadores/buscar.
      await assertGuardianProfessionalCanReceiveServico(profissionalId, "MONTADOR");

      const montadorPerfil = await prisma.montadorPerfil.findUnique({
        where: { userId: profissionalId },
      });
      const completudeMontador = montadorPerfil
        ? calcularCompletudeMontador({
            nome: userMontador.nome,
            bio: montadorPerfil.bio,
            especialidades: montadorPerfil.especialidades,
            cidade: montadorPerfil.cidade,
            estado: montadorPerfil.estado,
            bairros: montadorPerfil.bairros,
            atendeTodaCidade: montadorPerfil.atendeTodaCidade,
            ativo: montadorPerfil.ativo,
            userStatus: userMontador.status,
          })
        : null;
      if (!montadorPerfil || !completudeMontador?.completo) {
        return NextResponse.json(
          { ok: false, error: "Montador indisponível." },
          { status: 400 },
        );
      }

      const activeService = await findActiveMontadorService(profissionalId);
      if (activeService) {
        return NextResponse.json(
          {
            ok: false,
            error: "Montador já possui serviço ativo.",
            servicoId: activeService.id,
            status: activeService.status,
          },
          { status: 409 },
        );
      }

      const activeBetween = await findActiveServiceBetween(
        auth.userId,
        profissionalId,
        "montador",
      );
      if (activeBetween) {
        return NextResponse.json(
          {
            ok: false,
            error: "Já existe um serviço ativo com este profissional.",
            servicoId: activeBetween.id,
            status: activeBetween.status,
          },
          { status: 409 },
        );
      }

      // Montador não tem precificação pré-cadastrada: usa 0 como sentinela
      // "a orçar". O preço final é fechado após aceite/orçamento (fora do
      // escopo deste fluxo — ver GAP T-07: orçamento de Montador).
      const servico = await prisma.servico.create({
        data: {
          status: "SOLICITADO",
          tipo,
          categoria: categoria ?? null,
          data,
          turno,
          cidade,
          uf,
          bairro,
          enderecoCompleto: enderecoCompleto ?? null,
          observacoes: observacoes ?? null,
          temPet: false,
          quartos3Mais: false,
          banheiros2Mais: false,
          precoFinal: 0,
          clientId: auth.userId,
          montadorId: profissionalId,
        },
      });

      // Garante ChatRoom já na criação — chat fica visível assim que aceito,
      // mas a sala existir desde o início simplifica joins e evita corrida
      // entre aceite e primeira leitura. (Upsert é idempotente.)
      try {
        await prisma.chatRoom.upsert({
          where: { servicoId: servico.id },
          update: {},
          create: { servicoId: servico.id },
        });
      } catch (e) {
        console.error("[servicos] erro garantindo chatRoom:", e);
      }

      await criarNotificacao({
        userId: profissionalId,
        type: "SERVICO_SOLICITADO",
        title: "Nova solicitação de serviço",
        body: `Você recebeu um pedido de montagem em ${bairro}.`,
        servicoId: servico.id,
      });

      return NextResponse.json({ ok: true, servicoId: servico.id });
    }

    // ─── Branch DIARISTA (código original, não alterado) ─────────────────────
    if (!diaristaUserId) {
      return NextResponse.json(
        { ok: false, error: "Informe diaristaUserId." },
        { status: 400 },
      );
    }

    const diarista = await prisma.user.findUnique({ where: { id: diaristaUserId } });
    if (!diarista || diarista.role !== "DIARISTA" || diarista.status !== "ATIVO") {
      return NextResponse.json({ ok: false, error: "Diarista inválido." }, { status: 400 });
    }

    // T-18.6: gate via SafeScore Guardian. Mesma regra de
    // /api/diaristas/buscar + restrições/score.
    await assertGuardianProfessionalCanReceiveServico(diaristaUserId, "DIARISTA");

    const prof = await prisma.diaristaProfile.findUnique({
      where: { userId: diaristaUserId },
      include: {
        bairros: {
          select: {
            bairro: { select: { nome: true, cidade: true, uf: true } },
          },
        },
      },
    });
    if (!prof) {
      return NextResponse.json({ ok: false, error: "Diarista não verificado." }, { status: 400 });
    }

    // T-15: bloqueia contratação de profissional incompleta ou que não
    // oferece o serviço (nicho) requisitado. Mapeia tipo/categoria → nicho.
    const nicho = nichoFromTipo(tipo) ?? nichoFromCategoria(categoria ?? null);
    if (nicho) {
      const completudeDiarista = isDiaristaProfileCompleteForServico(
        {
          ativo: prof.ativo,
          bio: prof.bio,
          servicosOferecidos: prof.servicosOferecidos,
          cidade: prof.cidade,
          estado: prof.estado,
          atendeTodaCidade: prof.atendeTodaCidade,
          raioAtendimentoKm: prof.raioAtendimentoKm,
          precoLeve: prof.precoLeve,
          precoMedio: prof.precoMedio,
          precoPesada: prof.precoPesada,
          precoBabaHora: prof.precoBabaHora,
          precoCozinheiraBase: prof.precoCozinheiraBase,
          taxaMinima: prof.taxaMinima,
          valorACombinar: prof.valorACombinar,
          bairros: prof.bairros,
          user: { nome: diarista.nome, status: diarista.status },
        },
        nicho,
      );
      if (!completudeDiarista.completo) {
        return NextResponse.json(
          {
            ok: false,
            error: "Profissional não disponível para este serviço.",
            motivos: completudeDiarista.motivos,
          },
          { status: 400 },
        );
      }
    }

    const bairroDb = await prisma.bairro.findUnique({
      where: { nome_cidade_uf: { nome: bairro, cidade, uf } },
    });
    if (!bairroDb) {
      return NextResponse.json({ ok: false, error: "Bairro não cadastrado." }, { status: 400 });
    }

    // GAP-D1: Respeitar atendeTodaCidade=true. Perfis que atendem toda a
    // cidade não precisam de vínculo explícito ao bairro — espelha a lógica
    // de /api/diaristas/buscar (route.ts:158).
    if (!prof.atendeTodaCidade) {
      const atende = await prisma.diaristaBairro.findFirst({
        where: { diaristaId: prof.id, bairroId: bairroDb.id },
      });
      if (!atende) {
        return NextResponse.json({ ok: false, error: "Diarista não atende esse bairro." }, { status: 400 });
      }
    }

    // GAP-D2: `servicosOferecidos` é a fonte da verdade desde T-12+.
    // `DiaristaHabilidade` é legado e não é mais usada nem pelo helper de
    // completude (`isDiaristaProfileCompleteForServico`) nem pela busca.
    // Usamos `nichoFromTipo` (mesma função usada acima) para mapear
    // tipo→nicho. PASSA_ROUPA não tem nicho dedicado e cai no else, mantendo
    // o comportamento permissivo (sem bloqueio adicional aqui).
    if (nicho && !prof.servicosOferecidos.includes(nicho)) {
      return NextResponse.json(
        { ok: false, error: `Esta profissional não oferece ${nicho.toLowerCase()}.` },
        { status: 400 },
      );
    }

    const activeBetweenDiarista = await findActiveServiceBetween(
      auth.userId,
      diaristaUserId,
      "diarista",
    );
    if (activeBetweenDiarista) {
      return NextResponse.json(
        {
          ok: false,
          error: "Já existe um serviço ativo com este profissional.",
          servicoId: activeBetweenDiarista.id,
          status: activeBetweenDiarista.status,
        },
        { status: 409 },
      );
    }

    // GAP-D3: `precoFinal` precisa refletir o nicho real do serviço.
    // Antes, sempre usava `precoLeve`, o que quebrava BABA e COZINHEIRA.
    //
    // Convenção de unidades: TODOS os campos de preço estão em centavos.
    // - precoLeve/Medio/Pesada são Int (centavos) por definição do schema.
    // - precoBabaHora/precoCozinheiraBase são Decimal(10,2) mas o seed E2E
    //   e o restante do app já gravam valores em centavos (ex.: 5000 = R$ 50,00).
    //   Por segurança aplicamos Math.round(Number(...)) para coagir Decimal→Int.
    //
    // Quando `valorACombinar=true`, registramos 0 como sentinela "a combinar"
    // (preço negociado externamente — mesma convenção usada para Montador).
    let precoFinal = 0;
    if (prof.valorACombinar) {
      precoFinal = 0;
    } else if (tipo === "FAXINA") {
      if (categoria === "FAXINA_PESADA") {
        precoFinal = prof.precoPesada || prof.precoLeve;
      } else if (categoria === "FAXINA_COMPLETA") {
        precoFinal = prof.precoMedio || prof.precoPesada || prof.precoLeve;
      } else {
        precoFinal = prof.precoLeve;
      }
    } else if (tipo === "BABA") {
      precoFinal = Math.round(Number(prof.precoBabaHora ?? 0));
    } else if (tipo === "COZINHEIRA") {
      precoFinal = Math.round(Number(prof.precoCozinheiraBase ?? 0));
    } else {
      // PASSA_ROUPA e outros: fallback ao precoLeve (comportamento legado).
      precoFinal = prof.precoLeve;
    }

    if (!prof.valorACombinar && (!precoFinal || precoFinal <= 0)) {
      return NextResponse.json(
        { ok: false, error: "Profissional sem preço configurado para este serviço." },
        { status: 400 },
      );
    }

    const servico = await prisma.servico.create({
      data: {
        status: "SOLICITADO",
        tipo,
        categoria: categoria ?? null,
        data,
        turno,
        cidade,
        uf,
        bairro,
        enderecoCompleto: enderecoCompleto ?? null,
        observacoes: observacoes ?? null,
        temPet: temPet ?? false,
        quartos3Mais: quartos3Mais ?? false,
        banheiros2Mais: banheiros2Mais ?? false,
        precoFinal,
        clientId: auth.userId,
        diaristaId: diaristaUserId,
      },
    });

    // Garante ChatRoom já na criação. Ver comentário no branch MONTADOR.
    try {
      await prisma.chatRoom.upsert({
        where: { servicoId: servico.id },
        update: {},
        create: { servicoId: servico.id },
      });
    } catch (e) {
      console.error("[servicos] erro garantindo chatRoom:", e);
    }

    await criarNotificacao({
      userId: diaristaUserId,
      type: "SERVICO_SOLICITADO",
      title: "Nova solicitação de serviço",
      body: `Você recebeu um pedido de ${tipo.toLowerCase()} em ${bairro}.`,
      servicoId: servico.id,
    });

    return NextResponse.json({ ok: true, servicoId: servico.id });
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
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
