import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/requireAuth";
import { criarServicoSchema } from "@/lib/schemas/servicos";

export async function POST(req: Request) {
  try {
    const auth = requireAuth(req);
    if (auth.role !== "CLIENTE") {
      return NextResponse.json({ ok: false, error: "Apenas cliente pode solicitar." }, { status: 403 });
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
    };
    if (categoria && !CAT_BY_TIPO[tipo]?.includes(categoria)) {
      return NextResponse.json({ ok: false, error: "Categoria inválida para este tipo." }, { status: 400 });
    }

    const diarista = await prisma.user.findUnique({ where: { id: diaristaUserId } });
    if (!diarista || diarista.role !== "DIARISTA" || diarista.status !== "ATIVO") {
      return NextResponse.json({ ok: false, error: "Diarista inválido." }, { status: 400 });
    }

    const prof = await prisma.diaristaProfile.findUnique({ where: { userId: diaristaUserId } });
    if (!prof || prof.verificacao !== "VERIFICADO") {
      return NextResponse.json({ ok: false, error: "Diarista não verificado." }, { status: 400 });
    }

    const bairroDb = await prisma.bairro.findUnique({
      where: { nome_cidade_uf: { nome: bairro, cidade, uf } },
    });
    if (!bairroDb) {
      return NextResponse.json({ ok: false, error: "Bairro não cadastrado." }, { status: 400 });
    }

    const atende = await prisma.diaristaBairro.findFirst({
      where: { diaristaId: prof.id, bairroId: bairroDb.id },
    });
    if (!atende) {
      return NextResponse.json({ ok: false, error: "Diarista não atende esse bairro." }, { status: 400 });
    }

    const habilidade = await prisma.diaristaHabilidade.findFirst({
      where: {
        diaristaId: diaristaUserId,
        tipo,
        ...(categoria ? { categoria } : {}),
      },
    });
    if (!habilidade) {
      return NextResponse.json({ ok: false, error: "Diarista não atende esse serviço." }, { status: 400 });
    }

    const isFaxina = tipo === "FAXINA";
    const isPesada = categoria === "FAXINA_PESADA" || categoria === "FAXINA_COMPLETA";
    const precoFinal = isFaxina ? (isPesada ? prof.precoPesada : prof.precoLeve) : prof.precoLeve;
    if (!precoFinal || precoFinal <= 0) {
      return NextResponse.json({ ok: false, error: "Diarista sem preço configurado." }, { status: 400 });
    }

    const data = new Date(dataISO);
    if (isNaN(data.getTime())) {
      return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
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
        enderecoCompleto: null, // só libera após ACEITO
        observacoes: observacoes ?? null,
        temPet: temPet ?? false,
        quartos3Mais: quartos3Mais ?? false,
        banheiros2Mais: banheiros2Mais ?? false,
        precoFinal,
        clientId: auth.userId,
        diaristaId: diaristaUserId,
      },
    });

    return NextResponse.json({ ok: true, servicoId: servico.id });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Erro";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
