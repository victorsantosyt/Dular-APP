/**
 * EditPrices — Editar preços da diarista
 * Tokens Dular 100% aplicados. Lógica preservada.
 */

import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { getDiaristaMe, updateDiaristaPrecos } from "@/api/perfilApi";
import { apiMsg } from "@/utils/apiMsg";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers ───────────────────────────────────────────────────────────────────

const asNumber = (v: any) => {
  const n = Number(String(v || "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// ── PriceField ────────────────────────────────────────────────────────────────

function PriceField({
  label,
  subtitle,
  icon,
  value,
  onChange,
}: {
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={f.wrap}>
      <View style={f.header}>
        <View style={f.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.green} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={f.label}>{label}</Text>
          <Text style={f.sub}>{subtitle}</Text>
        </View>
        <View style={f.inputWrap}>
          <Text style={f.currency}>R$</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            style={f.input}
            placeholderTextColor={colors.sub}
            placeholder="0"
          />
        </View>
      </View>
    </View>
  );
}

const f = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    ...shadow.card,
  },
  header:  { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 38, height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
  },
  label:    { fontSize: 14, fontWeight: "800", color: colors.ink },
  sub:      { ...typography.sub, marginTop: 1 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cardStrong,
    minWidth: 80,
    gap: 4,
  },
  currency: { fontSize: 13, fontWeight: "700", color: colors.sub },
  input: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.ink,
    minWidth: 52,
    textAlign: "right",
    padding: 0,
  },
});

// ── Componente principal ──────────────────────────────────────────────────────

export default function EditPrices({ navigation }: any) {
  const [precoLeve,   setPrecoLeve]   = useState("150");
  const [precoPesada, setPrecoPesada] = useState("220");
  const [loading,        setLoading]        = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setError(null);
      setInitialLoading(true);
      const data = await getDiaristaMe();
      if (data?.precoLeve   != null) setPrecoLeve(String(data.precoLeve / 100));
      if (data?.precoPesada != null) setPrecoPesada(String(data.precoPesada / 100));
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar preços."));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setLoading(true);
      await updateDiaristaPrecos({
        precoLeve:   Math.round(asNumber(precoLeve)   * 100),
        precoPesada: Math.round(asNumber(precoPesada) * 100),
      });
      Alert.alert("Salvo", "Preços atualizados com sucesso.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar preços."));
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen title="Editar preços">
      {initialLoading ? (
        <View style={s.card}>
          <Text style={s.loadingText}>Carregando...</Text>
        </View>
      ) : error ? (
        <View style={[s.card, { gap: 10 }]}>
          <Text style={s.errorTitle}>Não foi possível carregar.</Text>
          <Text style={s.errorSub}>{error}</Text>
          <DButton title="Tentar novamente" onPress={load} variant="outline" />
        </View>
      ) : (
        <>
          <Text style={s.hint}>Os valores são cobrados por serviço completo.</Text>

          <PriceField
            label="Faxina leve"
            subtitle="Limpeza de rotina"
            icon="sparkles-outline"
            value={precoLeve}
            onChange={setPrecoLeve}
          />
          <PriceField
            label="Faxina pesada"
            subtitle="Limpeza completa e detalhada"
            icon="flash-outline"
            value={precoPesada}
            onChange={setPrecoPesada}
          />

          {/* Preview */}
          <View style={s.previewCard}>
            <Ionicons name="eye-outline" size={15} color={colors.greenDark} />
            <Text style={s.previewText}>
              Leve: R$ {precoLeve || "0"} · Pesada: R$ {precoPesada || "0"}
            </Text>
          </View>

          <DButton
            title={loading ? "Salvando..." : "Salvar preços"}
            onPress={save}
            loading={loading}
          />
        </>
      )}
    </Screen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    gap: 8,
    ...shadow.card,
  },
  loadingText: { ...typography.sub, textAlign: "center" },
  errorTitle:  { fontSize: 14, fontWeight: "800", color: colors.danger },
  errorSub:    { ...typography.sub },
  hint:        { ...typography.sub },

  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
  },
  previewText: { fontSize: 13, fontWeight: "700", color: colors.greenDark },
});
