import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon, type AppIconName } from "@/components/ui";
import { PageDots } from "@/components/onboarding/PageDots";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { useAuthStore } from "@/stores/authStore";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { ServicoOferecido } from "@/types/diarista";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList, "NichosSelect">;

type NichoOption = {
  id: ServicoOferecido;
  title: string;
  subtitle: string;
  icon: AppIconName;
};

const OPTIONS: NichoOption[] = [
  {
    id: "DIARISTA",
    title: "Diarista",
    subtitle: "Limpeza, organização e rotina da casa.",
    icon: "BrushCleaning",
  },
  {
    id: "BABA",
    title: "Babá",
    subtitle: "Cuidados infantis com responsabilidade.",
    icon: "Baby",
  },
  {
    id: "COZINHEIRA",
    title: "Cozinheira",
    subtitle: "Preparo de refeições e apoio na cozinha.",
    icon: "ChefHat",
  },
];

export function NichosSelectScreen() {
  const navigation = useNavigation<Navigation>();
  const savedServicos = useAuthStore((state) => state.servicosOferecidos);
  const setServicosOferecidos = useAuthStore((state) => state.setServicosOferecidos);
  const [selected, setSelected] = useState<ServicoOferecido[]>(
    savedServicos.length > 0 ? savedServicos : ["DIARISTA"],
  );
  const canContinue = selected.length > 0;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (id: ServicoOferecido) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const continueToGenero = async () => {
    if (!canContinue) return;
    await setServicosOferecidos(selected);
    navigation.navigate("GeneroSelect");
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar para escolha de perfil"
          style={({ pressed }) => [s.backButton, pressed && s.pressed]}
        >
          <AppIcon name="ArrowLeft" size={20} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
        <PageDots total={3} active={1} />
        <View style={s.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleBlock}>
          <Text style={s.title}>Quais serviços você oferece?</Text>
          <Text style={s.subtitle}>
            Selecione todos os nichos que devem aparecer no seu perfil de Profissional de Casa.
          </Text>
        </View>

        <View style={s.options}>
          {OPTIONS.map((item) => {
            const active = selectedSet.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                style={({ pressed }) => [
                  s.optionCard,
                  active && s.optionCardActive,
                  pressed && s.pressed,
                ]}
              >
                <View style={[s.optionIcon, active && s.optionIconActive]}>
                  <AppIcon
                    name={item.icon}
                    size={22}
                    color={active ? colors.white : colors.primary}
                    strokeWidth={2.4}
                  />
                </View>
                <View style={s.optionText}>
                  <Text style={s.optionTitle}>{item.title}</Text>
                  <Text style={s.optionSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={[s.checkCircle, active && s.checkCircleActive]}>
                  {active ? <AppIcon name="Check" size={16} color={colors.white} strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={s.footer}>
        <Pressable
          onPress={continueToGenero}
          disabled={!canContinue}
          style={({ pressed }) => [
            s.primaryButton,
            !canContinue && s.primaryButtonDisabled,
            pressed && canContinue && s.pressed,
          ]}
        >
          <Text style={s.primaryButtonText}>Continuar</Text>
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default NichosSelectScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerSpacer: {
    width: 40,
  },
  pressed: {
    opacity: 0.72,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: spacing.xl,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    ...typography.h1,
    color: colors.primaryDark,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    fontWeight: "500",
    lineHeight: 21,
  },
  options: {
    gap: spacing.md,
  },
  optionCard: {
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.soft,
  },
  optionCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderSoft,
  },
  optionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavender,
  },
  optionIconActive: {
    backgroundColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  optionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
    lineHeight: 18,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.white,
    ...typography.bodyMedium,
    fontWeight: "800",
  },
});
