import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, BackCircleButton } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { getProfileTheme } from "@/theme/profileTheme";
import { CATEGORIAS } from "@/constants/categorias";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

/**
 * CategoriasTodasScreen — "Ver todos" da seção "Quem você precisa hoje?".
 * Lista TODAS as categorias do ecossistema (fonte única), cada uma abrindo a
 * busca correspondente. Identidade visual do empregador (roxo) no chrome.
 */

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const THEME = getProfileTheme({ role: "EMPREGADOR" });

export function CategoriasTodasScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.title}>Categorias</Text>
        <BackCircleButton onPress={() => navigation.navigate("Home")} color={THEME.icon} borderColor={THEME.border} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Todas as categorias de profissionais disponíveis. Toque para buscar.</Text>

        <View style={s.grid}>
          {CATEGORIAS.map((c) => (
            <Pressable
              key={c.key}
              onPress={() => navigation.navigate("Buscar", { categoriaInicial: c.key })}
              style={({ pressed }) => [s.card, pressed && s.pressed]}
            >
              <View style={[s.iconWrap, { backgroundColor: c.bg }]}>
                <AppIcon name={c.icon} size={24} color={c.fg} strokeWidth={2.1} />
              </View>
              <Text style={s.cardLabel} numberOfLines={1}>{c.label}</Text>
              <Text style={s.cardSub} numberOfLines={2}>{c.subtitle}</Text>
            </Pressable>
          ))}
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
    gap: 6,
    ...shadows.soft,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  cardLabel: { ...typography.bodySm, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  cardSub: { ...typography.caption, color: colors.textSecondary, fontWeight: "500", textAlign: "center" },
});
