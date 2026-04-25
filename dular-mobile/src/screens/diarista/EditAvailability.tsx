/**
 * EditAvailability — Editar disponibilidade da diarista
 * Tokens Dular 100% aplicados. Lógica preservada.
 */

import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { getDiaristaMe, updateDiaristaDisponibilidade } from "@/api/perfilApi";
import { apiMsg } from "@/utils/apiMsg";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Constantes ────────────────────────────────────────────────────────────────

const DAYS   = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const TURNOS = [
  { key: "MANHA", label: "Manhã",  icon: "sunny-outline"  },
  { key: "TARDE", label: "Tarde",  icon: "partly-sunny-outline" },
] as const;

// ── Componente ────────────────────────────────────────────────────────────────

export default function EditAvailability({ navigation }: any) {
  const [dias,   setDias]   = useState<string[]>(["SEG", "QUI"]);
  const [turnos, setTurnos] = useState<string[]>(["MANHA", "TARDE"]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const busyRef = useRef(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data   = await getDiaristaMe();
      const agenda = Array.isArray(data?.agenda) ? data.agenda : [];
      const diasSet   = new Set<string>();
      const turnosSet = new Set<string>();
      agenda.forEach((s: any) => {
        const d = DAYS[s.diaSemana];
        if (d) diasSet.add(d);
        if (s.turno) turnosSet.add(String(s.turno));
      });
      if (diasSet.size)   setDias(Array.from(diasSet));
      if (turnosSet.size) setTurnos(Array.from(turnosSet));
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar disponibilidade."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      const slots: any[] = [];
      dias.forEach((d) => {
        const diaSemana = DAYS.indexOf(d);
        if (diaSemana < 0) return;
        turnos.forEach((t) => {
          if (t !== "MANHA" && t !== "TARDE") return;
          slots.push({ diaSemana, turno: t, ativo: true });
        });
      });
      await updateDiaristaDisponibilidade({ slots });
      Alert.alert("Sucesso", "Disponibilidade atualizada.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar disponibilidade."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen title="Disponibilidade">
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
          {/* ── Dias ── */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Ionicons name="calendar-outline" size={16} color={colors.green} />
              <Text style={s.sectionTitle}>Dias disponíveis</Text>
            </View>
            <View style={s.chipRow}>
              {DAYS.map((d) => {
                const active = dias.includes(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => toggle(dias, setDias, d)}
                    style={({ pressed }) => [s.dayChip, active && s.dayChipOn, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={[s.dayChipText, active && s.dayChipTextOn]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Turnos ── */}
          <View style={s.card}>
            <View style={s.sectionHeader}>
              <Ionicons name="time-outline" size={16} color={colors.green} />
              <Text style={s.sectionTitle}>Turnos</Text>
            </View>
            <View style={s.turnoRow}>
              {TURNOS.map(({ key, label, icon }) => {
                const active = turnos.includes(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggle(turnos, setTurnos, key)}
                    style={({ pressed }) => [s.turnoBtn, active && s.turnoBtnOn, pressed && { opacity: 0.75 }]}
                  >
                    <Ionicons name={icon as any} size={20} color={active ? "#FFF" : colors.sub} />
                    <Text style={[s.turnoBtnText, active && s.turnoBtnTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ── Resumo ── */}
          {dias.length > 0 && turnos.length > 0 && (
            <View style={s.resumoCard}>
              <Ionicons name="checkmark-circle" size={16} color={colors.greenDark} />
              <Text style={s.resumoText}>
                {dias.join(", ")} · {turnos.map((t) => (t === "MANHA" ? "Manhã" : "Tarde")).join(" e ")}
              </Text>
            </View>
          )}

          <DButton
            title={saving ? "Salvando..." : "Salvar disponibilidade"}
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
    gap: 12,
    ...shadow.card,
  },
  loadingText: { ...typography.sub, textAlign: "center" },
  errorTitle:  { fontSize: 14, fontWeight: "800", color: colors.danger },
  errorSub:    { ...typography.sub },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:  { fontSize: 13, fontWeight: "700", color: colors.ink },

  // Dias
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardStrong,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  dayChipOn:      { backgroundColor: colors.green, borderColor: colors.green },
  dayChipText:    { fontSize: 12, fontWeight: "700", color: colors.ink },
  dayChipTextOn:  { color: "#FFF" },

  // Turnos
  turnoRow: { flexDirection: "row", gap: 10 },
  turnoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.btn,
    backgroundColor: colors.cardStrong,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  turnoBtnOn:       { backgroundColor: colors.green, borderColor: colors.green },
  turnoBtnText:     { fontSize: 14, fontWeight: "700", color: colors.sub },
  turnoBtnTextOn:   { color: "#FFF" },

  // Resumo
  resumoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
  },
  resumoText: { fontSize: 13, fontWeight: "600", color: colors.greenDark, flex: 1 },
});
