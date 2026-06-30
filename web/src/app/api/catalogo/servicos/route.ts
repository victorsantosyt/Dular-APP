import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    tipos: [
      {
        tipo: "FAXINA",
        label: "Faxina",
        categorias: [
          { categoria: "FAXINA_LEVE", label: "Faxina leve" },
          { categoria: "FAXINA_PESADA", label: "Faxina pesada" },
          { categoria: "FAXINA_COMPLETA", label: "Faxina completa" },
        ],
      },
      {
        tipo: "BABA",
        label: "Babá",
        categorias: [
          { categoria: "BABA_DIURNA", label: "Babá diurna" },
          { categoria: "BABA_NOTURNA", label: "Babá noturna" },
          { categoria: "BABA_INTEGRAL", label: "Babá integral" },
        ],
      },
      {
        tipo: "COZINHEIRA",
        label: "Cozinheira",
        categorias: [
          { categoria: "COZINHEIRA_DIARIA", label: "Cozinheira diária" },
          { categoria: "COZINHEIRA_EVENTO", label: "Cozinheira para evento" },
        ],
      },
      // PASSA_ROUPA removido do catálogo: não é ofertável pela diarista
      // (ServicoOferecido = DIARISTA/BABA/COZINHEIRA) nem contratável pelo
      // empregador (sem nicho de preço). Os apps mantêm exibição defensiva
      // de serviços PASSA_ROUPA legados/seed, mas não o oferecem como opção.
    ],
  });
}
