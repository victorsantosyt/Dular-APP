import { NextResponse } from "next/server";

// `checkoutComOperacao`: esta versão grava a operação do checkout (prova de
// origem). O build de produção consulta isto para saber se o código no ar é
// o anterior e registrar a janela de legado (scripts/janela-legado-checkout.mjs).
export async function GET() {
  return NextResponse.json({ ok: true, status: "ok", ts: new Date().toISOString(), checkoutComOperacao: true });
}
