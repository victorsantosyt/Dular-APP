import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cidade = searchParams.get("cidade");
  const uf = searchParams.get("uf");

  if (!cidade || !uf) {
    return NextResponse.json({ ok: false, error: "Informe cidade e uf." }, { status: 400 });
  }

  try {
    const bairros = await prisma.bairro.findMany({
      where: { cidade, uf },
      orderBy: { nome: "asc" },
      take: 300,
    });

    return NextResponse.json({ ok: true, bairros });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
