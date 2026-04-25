/**
 * EditNeighborhoods — Editar bairros de atendimento
 * Tokens Dular 100% aplicados. Lógica preservada.
 */

import { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { getDiaristaMe, updateDiaristaBairros } from "@/api/perfilApi";
import { apiMsg } from "@/utils/apiMsg";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Componente ────────────────────────────────────────────────────────────────

export default function EditNeighborhoods({ navigation }: any) {
  const [bairrosTxt, setBairrosTxt] = useState("");
  const [cidade, setCidade]         = useState("Cuiabá");
  const [uf, setUf]                 = useState("MT");
  const [loading,  setLoading]      = useState(true);
  const [saving,   setSaving]       = useState(false);
  const [error,    setError]        = useState<string | null>(null);
  const busyRef = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data    = await getDiaristaMe();
      const bairros = Array.isArray(data?.bairros)
        ? data.bairros.map((b: any) => b?.bairro?.nome || b?.nome).filter(Boolean)
        : [];
      if (bairros.length) setBairrosTxt(bairros.join("\n"));
      const first = data?.bairros?.[0]?.bairro;
      if (first?.cidade) setCidade(first.cidade);
      if (first?.uf)     setUf(first.uf);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar bairros."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      const norm = (s: string) =>
        (s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const list  = bairrosTxt.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
      const dedup = Array.from(new Map(list.map((b) => [norm(b), b])).values());
      await updateDiaristaBairros({ cidade, uf, bairros: dedup });
      Alert.alert("Sucesso", "Bairros atualizados.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar bairros."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  // Bairros parseados para preview
  const previewList = bairrosTxt
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen title="Bairros de atendimento">
      {loading ? (
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
          {/* Cidade/UF readonly */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Ionicons name="location-outline" size={16} color={colors.green} />
              <Text style={s.sectionTitle}>Cidade de atuação</Text>
            </View>
            <View style={s.cityRow}>
              <View style={[s.fieldBox, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Cidade</Text>
                <Text style={s.fieldValue}>{cidade}</Text>
              </View>
              <View style={[s.fieldBox, { width: 64 }]}>
                <Text style={s.fieldLabel}>UF</Text>
                <Text style={s.fieldValue}>{uf}</Text>
              </View>
            </View>
          </View>

          {/* Input de bairros */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Ionicons name="map-outline" size={16} color={colors.green} />
              <Text style={s.sectionTitle}>Bairros</Text>
            </View>
            <Text style={s.hint}>Um bairro por linha ou separado por vírgula.</Text>
            <TextInput
              value={bairrosTxt}
              onChangeText={setBairrosTxt}
              style={s.textArea}
              multiline
              placeholder={"Centro\nSanta Rosa\nJardim Itália"}
              placeholderTextColor={colors.sub}
              textAlignVertical="top"
            />
          </View>

          {/* Preview chips */}
          {previewList.length > 0 && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Pré-visualização</Text>
              <View style={s.chips}>
                {previewList.map((b) => (
                  <View key={b} style={s.chip}>
                    <Text style={s.chipText}>{b}</Text>
                  </View>
                ))}
                {bairrosTxt.split(/\n|,/).filter((s) => s.trim()).length > 8 && (
                  <View style={s.chip}>
                    <Text style={s.chipText}>
                      +{bairrosTxt.split(/\n|,/).filter((s) => s.trim()).length - 8} mais
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <DButton
            title={saving ? "Salvando..." : "Salvar bairros"}
            onPress={save}
            loading={saving}
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
    gap: 10,
    ...shadow.card,
  },
  loadingText: { ...typography.sub, textAlign: "center" },
  errorTitle:  { fontSize: 14, fontWeight: "800", color: colors.danger },
  errorSub:    { ...typography.sub },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:  { fontSize: 13, fontWeight: "700", color: colors.ink },
  hint:          { ...typography.sub },

  cityRow: { flexDirection: "row", gap: 10 },
  fieldBox: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.cardStrong,
    gap: 2,
  },
  fieldLabel: { fontSize: 11, fontWeight: "600", color: colors.sub },
  fieldValue: { fontSize: 14, fontWeight: "700", color: colors.ink },

  textArea: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.cardStrong,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    minHeight: 140,
    lineHeight: 22,
  },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.greenDark },
});
