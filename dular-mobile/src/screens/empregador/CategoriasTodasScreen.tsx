import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, type AppIconName, BackCircleButton } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { getProfileTheme } from "@/theme/profileTheme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

/**
 * CategoriasTodasScreen — tela do "Ver todos" da seção "Quem você precisa hoje?".
 * Lista todas as categorias de profissionais. As contratáveis abrem a busca;
 * as demais aparecem como "Em breve". Identidade visual do empregador (roxo).
 */

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type BuscarKey = "baba" | "cozinheira" | "diarista" | "montador";

const THEME = getProfileTheme({ role: "EMPREGADOR" });

type Categoria = {
  key: string;
  label: string;
  icon: AppIconName;
  /** Quando definido, a categoria é contratável e abre a busca. */
  buscar?: BuscarKey;
};

const CATEGORIAS: Categoria[] = [
  { key: "diarista", label: "Diarista", icon: "BrushCleaning", buscar: "diarista" },
  { key: "baba", label: "Babá", icon: "Baby", buscar: "baba" },
  { key: "cozinheira", label: "Cozinheira", icon: "ChefHat", buscar: "cozinheira" },
  { key: "montador", label: "Montador", icon: "Wrench", buscar: "montador" },
  { key: "faxineira", label: "Faxineira", icon: "Sparkles" },
  { key: "passadeira", label: "Passadeira de roupa", icon: "Shirt" },
  { key: "lavadeira", label: "Lavadeira de roupa", icon: "WashingMachine" },
  { key: "cuidadora", label: "Cuidadora", icon: "Heart" },
];

export function CategoriasTodasScreen() {
  const navigation = useNavigation<Navigation>();

  const abrir = (c: Categoria) => {
    if (c.buscar) navigation.navigate("Buscar", { categoriaInicial: c.buscar });
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.title}>Categorias</Text>
        <BackCircleButton onPress={() => navigation.navigate("Home")} color={THEME.icon} borderColor={THEME.border} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Todas as categorias de profissionais. As disponíveis abrem a busca; as demais chegam em breve.
        </Text>

        <View style={s.grid}>
          {CATEGORIAS.map((c) => {
            const disponivel = !!c.buscar;
            return (
              <Pressable
                key={c.key}
                onPress={() => abrir(c)}
                disabled={!disponivel}
                style={({ pressed }) => [s.card, !disponivel && s.cardSoon, pressed && disponivel && s.pressed]}
              >
                <View style={[s.iconWrap, !disponivel && s.iconWrapSoon]}>
                  <AppIcon
                    name={c.icon}
                    size={24}
                    color={disponivel ? THEME.primary : colors.textMuted}
                    strokeWidth={2.1}
                  />
                </View>
                <Text style={s.cardLabel} numberOfLines={2}>{c.label}</Text>
                {disponivel ? (
                  <View style={s.tagOk}>
                    <Text style={s.tagOkText}>Disponível</Text>
                  </View>
                ) : (
                  <View style={s.tagSoon}>
                    <Text style={s.tagSoonText}>Em breve</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default CategoriasTodasScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: 122, gap: 14 },
  intro: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    width: "47.5%",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
    ...shadows.soft,
  },
  cardSoon: { opacity: 0.7, backgroundColor: colors.background },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primarySoft,
  },
  iconWrapSoon: { backgroundColor: colors.skeletonBg },
  cardLabel: { ...typography.bodySm, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  tagOk: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: THEME.primarySoft,
  },
  tagOkText: { ...typography.caption, fontWeight: "700", color: THEME.textAccent },
  tagSoon: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.skeletonBg,
  },
  tagSoonText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
});
