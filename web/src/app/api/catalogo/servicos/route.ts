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
      {
        tipo: "PASSA_ROUPA",
        label: "Passa roupa",
        categorias: [
          { categoria: "PASSA_ROUPA_BASICO", label: "Passa roupa básico" },
          { categoria: "PASSA_ROUPA_COMPLETO", label: "Passa roupa completo" },
        ],
      },
    ],
  });
}
