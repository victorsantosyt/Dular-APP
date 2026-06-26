/**
 * MontadorEspecialidadesGateScreen — gate pós-login das especialidades do montador.
 *
 * Mesmo padrão do NichosGateScreen (diarista) e do GeneroGateScreen: renderizado
 * pelo RootNavigator quando a conta JÁ está autenticada, o role é MONTADOR e
 * `user.especialidades` ainda está vazio. Ao confirmar, grava no BACKEND (fonte
 * de verdade, PATCH /api/montador/me) e atualiza o authStore; o RootNavigator
 * então troca automaticamente para o app do montador. Aparece UMA vez (conta nova).
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui";
import { EspecialidadeOptionCard } from "@/components/EspecialidadeOptionCard";
import { atualizarPerfilMontador } from "@/api/montadorApi";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { MONTADOR_ESPECIALIDADES, type MontadorEspecialidadeId } from "@/types/montador";
import { colors, radius, spacing, typography } from "@/theme";

export function MontadorEspecialidadesGateScreen() {
  // Cor por gênero do perfil (rosa/verde), não o roxo genérico.
  const theme = useProfileTheme("MONTADOR");
  const setUser = useAuth((state) => state.setUser);
  const [selected, setSelected] = useState<MontadorEspecialidadeId[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const canContinue = selected.length > 0 && !saving;

  const toggle = (id: MontadorEspecialidadeId) => {
    if (saving) return;
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const confirm = async () => {
    if (!canContinue) return;
    setSaving(true);
    try {
      // Backend é a fonte de verdade. PATCH com especialidades.
      const res = await atualizarPerfilMontador({ especialidades: selected });
      const next = Array.isArray(res?.perfil?.especialidades)
        ? (res.perfil.especialidades as MontadorEspecialidadeId[])
        : selected;
      // Atualiza o user persistido → RootNavigator sai do gate e entra no app.
      setUser((current) => (current ? { ...current, especialidades: next } : current));
    } catch {
      Alert.alert("Não foi possível salvar", "Tente novamente em instantes.");
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleBlock}>
          <Text style={[s.title, { color: theme.primaryDark }]}>Quais serviços você oferece?</Text>
          <Text style={s.subtitle}>
            Marque tudo que você realmente faz. Você só recebe pedidos dos serviços
            selecionados — pode ajustar depois no seu perfil.
          </Text>
        </View>

        <View style={s.options}>
          {MONTADOR_ESPECIALIDADES.map((item) => (
            <EspecialidadeOptionCard
              key={item.id}
              label={item.label}
              active={selectedSet.has(item.id)}
              disabled={saving}
              onPress={() => toggle(item.id)}
              theme={theme}
            />
          ))}
        </View>

        <View style={s.noteRow}>
          <AppIcon name="Lock" size={14} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={s.noteText}>Seus dados são protegidos e não são compartilhados.</Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={s.footer}>
        <Pressable
          onPress={confirm}
          disabled={!canContinue}
          style={({ pressed }) => [
            s.primaryButton,
            { backgroundColor: theme.primary },
            !canContinue && s.primaryButtonDisabled,
            pressed && canContinue && s.pressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.primaryButtonText}>Continuar</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </SafeAreaView>
  );
}

export default MontadorEspecialidadesGateScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.72,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xxl,
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
