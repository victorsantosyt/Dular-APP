import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AppIcon } from "@/components/ui";
import type { CurrentRegion } from "@/hooks/useCurrentRegion";
import { colors, radius, spacing, typography } from "@/theme";

type Props = {
  title?: string;
  subtitle?: string;
  region: CurrentRegion;
  permissionStatus: "unknown" | "granted" | "denied";
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  primaryColor?: string;
  primarySoft?: string;
  confirmed?: boolean;
  confirmLabel?: string;
  onRegionChange: (region: CurrentRegion) => void;
  onRequestLocation: () => Promise<CurrentRegion | null | void> | CurrentRegion | null | void;
  onDetected?: (region: CurrentRegion) => void;
  onConfirm: (region: CurrentRegion) => void;
  onManual?: () => void;
};

export function LocationPermissionCard({
  title = "Use sua localização",
  subtitle = "Use sua localização para encontrar serviços e profissionais perto de você.",
  region,
  permissionStatus,
  loading,
  saving,
  error,
  primaryColor = colors.primary,
  primarySoft = colors.lavenderSoft,
  confirmed,
  confirmLabel = "Confirmar região",
  onRegionChange,
  onRequestLocation,
  onDetected,
  onConfirm,
  onManual,
}: Props) {
  const [editing, setEditing] = useState(false);
  const hasRegion = Boolean(region.cidade.trim() && region.uf.trim());
  const statusText =
    confirmed && hasRegion
      ? "Região confirmada"
      : permissionStatus === "denied"
        ? "Permissão negada"
        : hasRegion
          ? "Região detectada"
          : "Região pendente";

  const update = (patch: Partial<CurrentRegion>) => onRegionChange({ ...region, ...patch });
  const handleRequestLocation = async () => {
    const detected = await onRequestLocation();
    if (detected) {
      onDetected?.(detected);
    }
  };
  const handleManual = () => {
    setEditing((value) => !value);
    onManual?.();
  };

  return (
    <View style={s.card}>
      <View style={s.header}>
        <View style={[s.iconBox, { backgroundColor: primarySoft }]}>
          <AppIcon name="MapPin" size={19} color={primaryColor} strokeWidth={2.3} />
        </View>
        <View style={s.headerText}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={s.statusRow}>
        <Text style={[s.statusText, { color: confirmed ? primaryColor : colors.textSecondary }]}>{statusText}</Text>
        {loading ? <ActivityIndicator size="small" color={primaryColor} /> : null}
      </View>

      {hasRegion && !editing ? (
        <View style={[s.regionBox, { borderColor: primarySoft }]}>
          <Text style={s.regionMain}>
            {region.cidade}, {region.uf}
          </Text>
          {region.bairro ? <Text style={s.regionSub}>{region.bairro}</Text> : <Text style={s.regionSub}>Busca por cidade/UF</Text>}
        </View>
      ) : null}

      {editing || !hasRegion ? (
        <View style={s.form}>
          <TextInput
            value={region.cidade}
            onChangeText={(cidade) => update({ cidade })}
            placeholder="Cidade"
            placeholderTextColor={colors.textMuted}
            style={s.input}
          />
          <View style={s.formRow}>
            <TextInput
              value={region.uf}
              onChangeText={(uf) => update({ uf: uf.toUpperCase().slice(0, 2) })}
              placeholder="UF"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={2}
              style={[s.input, s.ufInput]}
            />
            <TextInput
              value={region.bairro}
              onChangeText={(bairro) => update({ bairro })}
              placeholder="Bairro opcional"
              placeholderTextColor={colors.textMuted}
              style={[s.input, s.bairroInput]}
            />
          </View>
        </View>
      ) : null}

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <View style={s.actions}>
        <Pressable onPress={handleRequestLocation} disabled={loading || saving} style={[s.secondaryButton, (loading || saving) && s.disabled]}>
          <Text style={[s.secondaryText, { color: primaryColor }]}>Usar minha localização</Text>
        </Pressable>
        <Pressable onPress={handleManual} disabled={saving} style={[s.secondaryButton, saving && s.disabled]}>
          <Text style={s.secondaryMuted}>{editing ? "Fechar edição" : hasRegion ? "Editar" : "Escolher região manualmente"}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => onConfirm(region)}
        disabled={!hasRegion || saving}
        style={[s.primaryButton, { backgroundColor: primaryColor }, (!hasRegion || saving) && s.disabled]}
      >
        {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={s.primaryText}>{confirmLabel}</Text>}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    lineHeight: 17,
  },
  statusRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusText: {
    ...typography.caption,
    fontWeight: "800",
  },
  regionBox: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  regionMain: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "800",
  },
  regionSub: {
    marginTop: 2,
    color: colors.textSecondary,
    ...typography.caption,
  },
  form: {
    gap: 10,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "600",
  },
  ufInput: {
    width: 74,
  },
  bairroInput: {
    flex: 1,
  },
  errorText: {
    color: colors.danger,
    ...typography.caption,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 12,
  },
  secondaryText: {
    ...typography.caption,
    fontWeight: "800",
  },
  secondaryMuted: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: colors.white,
    ...typography.bodySm,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.55,
  },
});
