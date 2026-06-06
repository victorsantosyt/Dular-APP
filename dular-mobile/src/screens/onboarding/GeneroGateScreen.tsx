/**
 * GeneroGateScreen — gate pós-login da identidade de gênero (FASE 3, subset seguro).
 *
 * Renderizado pelo RootNavigator quando a conta JÁ está autenticada mas ainda
 * não tem gênero (`user.genero == null`). Não pertence ao OnboardingNavigator e
 * não usa navegação do stack: ao escolher, grava no BACKEND (fonte de verdade,
 * backfill "set once") e atualiza o authStore — o RootNavigator então troca
 * automaticamente para o app do role.
 *
 * Não altera o fluxo de login/OAuth. Para contas que já têm gênero, esta tela
 * nunca aparece.
 */
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui";
import { colors, typography } from "@/theme/tokens";
import { useAuth, type Genero } from "@/stores/authStore";
import { getProfileTheme } from "@/theme/profileTheme";
import { updateGenero } from "@/api/perfilApi";

type GeneroOptionProps = {
  label: string;
  accent: string;
  softBg: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
};

function GeneroOption({ label, accent, softBg, loading, disabled, onPress }: GeneroOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.option,
        { borderColor: accent + "40" },
        pressed && { backgroundColor: softBg, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.85 },
      ]}
    >
      <View style={[s.optionIcon, { backgroundColor: softBg }]}>
        <AppIcon name="User" size={26} color={accent} strokeWidth={2.1} />
      </View>
      <Text style={s.optionLabel}>{label}</Text>
      {loading ? (
        <ActivityIndicator color={accent} />
      ) : (
        <AppIcon name="ChevronRight" size={20} color={colors.textMuted} strokeWidth={2.2} />
      )}
    </Pressable>
  );
}

export function GeneroGateScreen() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const setSelectedGenero = useAuth((state) => state.setSelectedGenero);
  const [saving, setSaving] = useState<Genero | null>(null);

  const masculinoTheme = getProfileTheme({ role: user?.role ?? "MONTADOR", genero: "MASCULINO" });
  const femininoTheme = getProfileTheme({ role: user?.role ?? "DIARISTA", genero: "FEMININO" });

  const choose = async (genero: Genero) => {
    if (saving) return;
    setSaving(genero);
    try {
      // Backend é a fonte de verdade (backfill "set once").
      await updateGenero(genero);
      setSelectedGenero(genero);
      // Atualiza o user persistido → RootNavigator sai do gate e entra no app.
      setUser((current) => (current ? { ...current, genero } : current));
    } catch {
      Alert.alert("Não foi possível salvar", "Tente novamente em instantes.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.content}>
        <Text style={s.title}>Como você quer configurar sua experiência?</Text>
        <Text style={s.subtitle}>
          Isso personaliza as cores e a comunicação do seu perfil. Você escolhe apenas uma vez.
        </Text>

        <View style={s.options}>
          <GeneroOption
            label="Homem"
            accent={masculinoTheme.primary}
            softBg={masculinoTheme.primarySoft}
            loading={saving === "MASCULINO"}
            disabled={!!saving}
            onPress={() => choose("MASCULINO")}
          />
          <GeneroOption
            label="Mulher"
            accent={femininoTheme.primary}
            softBg={femininoTheme.primarySoft}
            loading={saving === "FEMININO"}
            disabled={!!saving}
            onPress={() => choose("FEMININO")}
          />
        </View>

        <View style={s.noteRow}>
          <AppIcon name="Lock" size={14} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={s.noteText}>Seus dados são protegidos e não são compartilhados.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default GeneroGateScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    color: colors.textPrimary,
    ...typography.hero,
    fontWeight: "700",
    letterSpacing: -0.7,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.bodySmMedium,
    fontWeight: "400",
    textAlign: "center",
    marginBottom: 36,
  },
  options: {
    gap: 14,
    marginBottom: 32,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.title,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    color: colors.textMuted,
    ...typography.caption,
  },
});
