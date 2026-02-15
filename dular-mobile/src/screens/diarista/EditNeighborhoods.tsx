import { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { dularColors } from "../../theme/dular";
import { DularButton } from "../../components/DularButton";
import { getDiaristaMe, updateDiaristaBairros } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";
import { Screen } from "../../components/Screen";

export default function EditNeighborhoods({ navigation }: any) {
  const [bairrosTxt, setBairrosTxt] = useState("");
  const [cidade, setCidade] = useState("Cuiabá");
  const [uf, setUf] = useState("MT");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getDiaristaMe();
      const bairros = Array.isArray(data?.bairros)
        ? data.bairros.map((b: any) => b?.bairro?.nome || b?.nome).filter(Boolean)
        : [];
      if (bairros.length) setBairrosTxt(bairros.join("\n"));
      const first = data?.bairros?.[0]?.bairro;
      if (first?.cidade) setCidade(first.cidade);
      if (first?.uf) setUf(first.uf);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar bairros."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      const norm = (s: string) =>
        (s ?? "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      const list = bairrosTxt
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
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

  return (
    <Screen title="Bairros">
      {loading ? (
        <Text style={{ color: dularColors.muted }}>Carregando...</Text>
      ) : error ? (
        <>
          <Text style={{ color: dularColors.danger, fontWeight: "800" }}>{error}</Text>
          <DularButton title="Tentar novamente" onPress={load} />
        </>
      ) : (
        <>
          <Text style={{ color: dularColors.muted }}>Um bairro por linha (ou separado por vírgula).</Text>
          <TextInput
            value={bairrosTxt}
            onChangeText={setBairrosTxt}
            style={[input, { minHeight: 140 }]}
            multiline
            placeholder="Ex: Centro&#10;Santa Rosa&#10;Jardim Itália"
            placeholderTextColor={dularColors.muted}
          />
          <DularButton title={saving ? "Salvando..." : "Salvar"} onPress={save} loading={saving} />
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
