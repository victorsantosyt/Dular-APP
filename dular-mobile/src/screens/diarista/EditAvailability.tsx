import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { dularColors } from "../../theme/dular";
import { DularButton } from "../../components/DularButton";
import { getDiaristaMe, updateDiaristaDisponibilidade } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";
import { Screen } from "../../components/Screen";

const DAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
const TURNOS = ["MANHA", "TARDE"];

export default function EditAvailability({ navigation }: any) {
  const [dias, setDias] = useState<string[]>(["SEG", "QUI"]);
  const [turnos, setTurnos] = useState<string[]>(["MANHA", "TARDE"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getDiaristaMe();
      const agenda = Array.isArray(data?.agenda) ? data.agenda : [];
      const diasSet = new Set<string>();
      const turnosSet = new Set<string>();
      agenda.forEach((s: any) => {
        const d = DAYS[s.diaSemana];
        if (d) diasSet.add(d);
        if (s.turno) turnosSet.add(String(s.turno));
      });
      if (diasSet.size) setDias(Array.from(diasSet));
      if (turnosSet.size) setTurnos(Array.from(turnosSet));
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar disponibilidade."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

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

  return (
    <Screen title="Disponibilidade">
      {loading ? (
        <Text style={{ color: dularColors.muted }}>Carregando...</Text>
      ) : error ? (
        <>
          <Text style={{ color: dularColors.danger, fontWeight: "800" }}>{error}</Text>
          <DularButton title="Tentar novamente" onPress={load} />
        </>
      ) : (
        <>
          <Text style={{ color: dularColors.muted }}>Selecione dias</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {DAYS.map((d) => {
              const active = dias.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggle(dias, setDias, d)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: active ? dularColors.primary : "#fff",
                    borderWidth: 1,
                    borderColor: active ? dularColors.primary : dularColors.border,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : dularColors.text, fontWeight: "700" }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={{ color: dularColors.muted, marginTop: 10 }}>Selecione turnos</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {TURNOS.map((t) => {
              const active = turnos.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => toggle(turnos, setTurnos, t)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: active ? dularColors.primary : "#fff",
                    borderWidth: 1,
                    borderColor: active ? dularColors.primary : dularColors.border,
                  }}
                >
                  <Text style={{ color: active ? "#fff" : dularColors.text, fontWeight: "700" }}>{t}</Text>
                </Pressable>
              );
            })}
          </View>

          <DularButton title={saving ? "Salvando..." : "Salvar"} onPress={save} loading={saving} />
        </>
      )}
    </Screen>
  );
}
