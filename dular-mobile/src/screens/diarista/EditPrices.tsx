import { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { dularColors } from "../../theme/dular";
import { DularButton } from "../../components/DularButton";
import { getDiaristaMe, updateDiaristaPrecos } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";
import { Screen } from "../../components/Screen";

export default function EditPrices({ navigation }: any) {
  const [precoLeve, setPrecoLeve] = useState("150");
  const [precoPesada, setPrecoPesada] = useState("220");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setInitialLoading(true);
      const data = await getDiaristaMe();
      if (data?.precoLeve != null) setPrecoLeve(String(data.precoLeve / 100));
      if (data?.precoPesada != null) setPrecoPesada(String(data.precoPesada / 100));
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar preços."));
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function save() {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setLoading(true);
      const asNumber = (v: any) => {
        const n = Number(String(v || "0").replace(",", "."));
        return Number.isFinite(n) ? n : 0;
      };
      await updateDiaristaPrecos({
        precoLeve: Math.round(asNumber(precoLeve) * 100),
        precoPesada: Math.round(asNumber(precoPesada) * 100),
      });
      Alert.alert("Salvo", "Preços atualizados");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar"));
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }

  return (
    <Screen title="Preços">
      {initialLoading ? (
        <Text style={{ color: dularColors.muted }}>Carregando...</Text>
      ) : error ? (
        <>
          <Text style={{ color: dularColors.danger, fontWeight: "800" }}>{error}</Text>
          <DularButton title="Tentar novamente" onPress={load} />
        </>
      ) : (
        <>
          <Text style={{ color: dularColors.muted }}>Digite os valores em reais.</Text>
          <TextInput
            placeholder="Faxina leve (R$)"
            placeholderTextColor={dularColors.muted}
            keyboardType="numeric"
            value={precoLeve}
            onChangeText={setPrecoLeve}
            style={input}
          />
          <TextInput
            placeholder="Faxina pesada (R$)"
            placeholderTextColor={dularColors.muted}
            keyboardType="numeric"
            value={precoPesada}
            onChangeText={setPrecoPesada}
            style={input}
          />
          <DularButton title="Salvar" onPress={save} loading={loading} />
        </>
      )}
    </Screen>
  );
}

const input = {
  borderWidth: 1,
  borderColor: dularColors.border,
  borderRadius: 12,
  padding: 12,
  backgroundColor: "#fff",
  color: dularColors.text,
};
