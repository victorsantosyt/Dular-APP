import { Text, TextInput } from "react-native";

/**
 * Fonte do app: Plus Jakarta Sans.
 *
 * Humanista de terminações levemente arredondadas — acolhedora sem parecer
 * infantil — e desenhada para interface, então segura bem corpo pequeno em
 * tela densa. Vem como TTF no pacote, então renderiza igual no iOS e no
 * Android (a fonte do sistema não: era San Francisco num, Roboto/Inter no
 * outro, com métricas diferentes).
 *
 * ── O problema que este módulo resolve ────────────────────────────────────
 *
 * No Android o React Native NÃO sintetiza peso para fonte customizada: cada
 * peso é um arquivo com nome próprio. Um `fontWeight: "800"` num estilo
 * qualquer simplesmente não tem efeito — o texto sai no peso do arquivo que
 * estiver em `fontFamily`.
 *
 * O app tem centenas de `fontWeight` espalhados pelas telas. Reescrever todos
 * para carregar o nome do arquivo certo seria uma varredura enorme e, pior,
 * qualquer estilo novo escrito depois voltaria a quebrar em silêncio — no
 * simulador iOS tudo pareceria certo.
 *
 * Então a tradução peso → arquivo acontece uma vez só, aqui, interceptando o
 * render de `Text` e `TextInput`. Todo `fontWeight` existente continua
 * valendo, nos dois sistemas, sem tocar em nenhuma tela.
 */

export const FAMILIA_POR_PESO = {
  "200": "PlusJakartaSans_200ExtraLight",
  "300": "PlusJakartaSans_300Light",
  "400": "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold", // não existe 900 na família
  normal: "PlusJakartaSans_400Regular",
  bold: "PlusJakartaSans_700Bold",
} as const;

export const FONTE_PADRAO = FAMILIA_POR_PESO["400"];

/** Nome do arquivo para um `fontWeight` de estilo RN. */
export function familiaParaPeso(peso: unknown): string {
  if (peso == null) return FONTE_PADRAO;
  return (FAMILIA_POR_PESO as Record<string, string>)[String(peso)] ?? FONTE_PADRAO;
}

type EstiloTexto = { fontWeight?: unknown; fontFamily?: unknown } | null | undefined;

/**
 * Achata o `style` (que pode ser objeto, array ou array aninhado) só o
 * suficiente para descobrir o peso e se a tela já pediu uma família própria.
 */
function lerEstilo(style: unknown): { peso?: unknown; temFamilia: boolean } {
  let peso: unknown;
  let temFamilia = false;

  const visitar = (v: unknown) => {
    if (!v) return;
    if (Array.isArray(v)) {
      v.forEach(visitar);
      return;
    }
    if (typeof v !== "object") return;
    const e = v as EstiloTexto;
    if (e?.fontWeight != null) peso = e.fontWeight;
    if (e?.fontFamily != null) temFamilia = true;
  };

  visitar(style);
  return { peso, temFamilia };
}

let aplicada = false;

/**
 * Liga a fonte no app inteiro. Idempotente — chamar duas vezes não empilha
 * interceptações (o Fast Refresh reexecuta o módulo).
 */
export function aplicarFonteGlobal() {
  if (aplicada) return;
  aplicada = true;

  for (const Componente of [Text, TextInput] as unknown as {
    render?: (...args: unknown[]) => unknown;
  }[]) {
    const renderOriginal = Componente.render;
    if (typeof renderOriginal !== "function") continue;

    Componente.render = function (...args: unknown[]) {
      const elemento = renderOriginal.apply(this, args) as {
        props?: { style?: unknown };
      } & Record<string, unknown>;

      const { peso, temFamilia } = lerEstilo(elemento?.props?.style);
      // Respeita quem já escolheu uma família (ícones em fonte, por exemplo).
      if (temFamilia) return elemento;

      return {
        ...elemento,
        props: {
          ...elemento.props,
          style: [{ fontFamily: familiaParaPeso(peso) }, elemento?.props?.style],
        },
      };
    };
  }
}
