import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { api } from "@/lib/api";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { plural } from "@/utils/formatters";

type Props = {
  /** Cor do perfil (verde na diarista, etc.). */
  cor: string;
  corSuave: string;
  /**
   * Quantos serviços o profissional já concluiu. A barra só nasce depois do
   * PRIMEIRO serviço finalizado: antes disso ela não informa nada útil e só
   * empurraria plano para quem ainda não usou o app.
   */
  concluidos: number;
};

/**
 * Acompanhamento do limite do plano gratuito — uma linha fina abaixo da
 * carteira, mostrando quanto falta para o teto.
 *
 * Some sozinha quando o profissional assina: a fonte é `plan` de
 * /api/me/subscription, e qualquer coisa diferente de "FREE" esconde a barra.
 * Só aparece para quem tem paywall (diarista e montador) — o empregador não
 * tem plano e nunca chega aqui, porque a barra é montada nas homes deles.
 */
export function LimitePlanoBarra({ cor, corSuave, concluidos }: Props) {
  const navigation = useNavigation<any>();
  const [plano, setPlano] = useState<string | null>(null);
  const [uso, setUso] = useState<{ used: number; limit: number | null } | null>(null);

  // Ao focar, não só na montagem: o profissional volta para a home depois de
  // aceitar um serviço ou de assinar, e a barra precisa refletir isso.
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      api
        .get<{ plan?: string; usage?: { solicitacoesMes?: { used: number; limit: number | null } } }>(
          "/api/me/subscription",
        )
        .then((res) => {
          if (!vivo) return;
          setPlano(res.data?.plan ?? "FREE");
          setUso(res.data?.usage?.solicitacoesMes ?? null);
        })
        .catch(() => undefined); // sem dado, a barra simplesmente não aparece
      return () => {
        vivo = false;
      };
    }, []),
  );

  const limite = uso?.limit ?? null;
  const usados = uso?.used ?? 0;

  // Três condições, todas necessárias: já concluiu ao menos um serviço, está
  // no gratuito, e existe um teto conhecido para comparar.
  if (concluidos < 1 || plano !== "FREE" || limite == null) return null;

  const restantes = Math.max(0, limite - usados);
  const proporcao = limite > 0 ? Math.min(1, usados / limite) : 0;
  const estourou = restantes === 0;

  return (
    <Pressable
      onPress={() => navigation.navigate("Paywall", {})}
      accessibilityRole="button"
      accessibilityLabel={
        estourou
          ? "Limite do plano gratuito atingido. Ver planos."
          : `Restam ${restantes} de ${limite} serviços no plano gratuito. Ver planos.`
      }
      style={s.raiz}
    >
      <View style={s.linhaTexto}>
        <Text style={s.rotulo} numberOfLines={1}>
          {estourou
            ? "Limite do plano gratuito atingido"
            : `Restam ${plural(restantes, "serviço", "serviços")} no plano gratuito`}
        </Text>
        <Text style={[s.contador, { color: estourou ? colors.danger : colors.textSecondary }]}>
          {usados}/{limite}
        </Text>
      </View>

      <View style={[s.trilho, { backgroundColor: corSuave }]}>
        <View
          style={[
            s.preenchimento,
            { width: `${proporcao * 100}%`, backgroundColor: estourou ? colors.danger : cor },
          ]}
        />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  raiz: { gap: 6, paddingHorizontal: 2 },
  linhaTexto: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rotulo: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  contador: { ...typography.caption, fontWeight: "700", fontVariant: ["tabular-nums"] },
  // Linha fina: acompanha sem competir com a carteira logo acima.
  trilho: { height: 4, borderRadius: radius.sm, overflow: "hidden" },
  preenchimento: { height: "100%", borderRadius: radius.sm },
});
