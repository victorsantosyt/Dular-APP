import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, typography } from "@/theme";

/**
 * Barra de filtros das Agendas — a mesma na diarista e no montador.
 *
 * Dois problemas que ela resolve:
 *
 * 1. O chip selecionado nas pontas ficava CORTADO pela borda arredondada da
 *    barra: dava para tocar, mas metade da palavra sumia. Agora a barra rola
 *    sozinha até deixá-lo inteiro à vista.
 * 2. Os chips eram largos demais e a fileira estourava a linha. Diminuíram, e
 *    o conteúdo rola na horizontal em vez de quebrar.
 */

export type ItemFiltro<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  itens: ItemFiltro<T>[];
  ativo: T;
  onChange: (id: T) => void;
  theme: ProfileTheme;
};

export function BarraFiltros<T extends string>({ itens, ativo, onChange, theme }: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const posicoes = useRef<Record<string, { x: number; largura: number }>>({});
  const [larguraVisivel, setLarguraVisivel] = useState(0);

  // Traz o selecionado para dentro da área visível. Centraliza quando dá, e nas
  // pontas encosta na borda — sem nunca deixá-lo pela metade.
  const revelar = useCallback(
    (id: string) => {
      const p = posicoes.current[id];
      if (!p || larguraVisivel <= 0) return;
      const alvo = p.x + p.largura / 2 - larguraVisivel / 2;
      scrollRef.current?.scrollTo({ x: Math.max(0, alvo), animated: true });
    },
    [larguraVisivel],
  );

  useEffect(() => {
    revelar(ativo);
  }, [ativo, revelar]);

  return (
    <View style={[s.barra, { borderColor: theme.border, backgroundColor: theme.primarySoft }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.linha}
        onLayout={(e) => setLarguraVisivel(e.nativeEvent.layout.width)}
      >
        {itens.map((item) => {
          const selecionado = item.id === ativo;
          return (
            <Pressable
              key={item.id}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                posicoes.current[item.id] = { x, largura: width };
                if (selecionado) revelar(item.id);
              }}
              onPress={() => onChange(item.id)}
              style={({ pressed }) => [
                s.chip,
                selecionado
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: colors.surface, borderColor: theme.primarySoft },
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text
                style={[s.texto, { color: selecionado ? colors.white : colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default BarraFiltros;

const s = StyleSheet.create({
  barra: {
    borderRadius: radius.full,
    borderWidth: 1,
    padding: 4,
    // Recorta o conteúdo na curva da barra: sem isto o chip em rolagem
    // aparecia por fora da moldura.
    overflow: "hidden",
  },
  linha: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  texto: { ...typography.caption, fontWeight: "700" },
});
