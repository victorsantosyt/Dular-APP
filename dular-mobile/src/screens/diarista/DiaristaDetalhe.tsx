import { View, Text, Alert } from "react-native";
import { api } from "../../lib/api";
import { Servico } from "../../types/servico";
import { DButton } from "../../components/DButton";
import { useState } from "react";
import { colors } from "../../theme/theme";

export default function DiaristaDetalhe({ route, navigation }: any) {
  const { servico } = route.params as { servico: Servico };
  const [svc, setSvc] = useState<Servico>(servico);
  const [loading, setLoading] = useState(false);

  async function reloadFromList() {
    try {
      const res = await api.get("/api/servicos/minhas");
      const found = res.data?.servicos?.find((s: Servico) => s.id === svc.id);
      if (found) setSvc(found);
    } catch {
      // silencioso
    }
  }

  async function action(name: string, body?: unknown) {
    try {
      setLoading(true);
      const res = await api.post(`/api/servicos/${svc.id}/${name}`, body ?? {});
      const updated = res.data?.servico ?? res.data;
      if (updated?.id) {
        setSvc(updated);
      } else {
        await reloadFromList();
      }
      Alert.alert("OK", `Ação ${name} executada`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Serviço {svc.id.slice(0, 6)}</Text>

      <Text>Status: {svc.status}</Text>
      <Text>
        {svc.bairro} — {svc.cidade}/{svc.uf}
      </Text>
      <Text>Preço: R$ {(svc.precoFinal / 100).toFixed(2)}</Text>
      {svc.status === "SOLICITADO" && (
        <Text style={{ color: colors.muted }}>Endereço será liberado após aceitar.</Text>
      )}
      {svc.status !== "SOLICITADO" && svc.enderecoCompleto && (
        <Text style={{ color: colors.text }}>Endereço: {svc.enderecoCompleto}</Text>
      )}

      {svc.status === "SOLICITADO" && (
        <DButton
          title="Aceitar"
          loading={loading}
          onPress={() => action("aceitar", { enderecoCompleto: "Rua X, 123 - Centro" })}
        />
      )}

      {svc.status === "ACEITO" && <DButton title="Iniciar" loading={loading} onPress={() => action("iniciar")} />}

      {svc.status === "EM_ANDAMENTO" && (
        <DButton title="Concluir" loading={loading} onPress={() => action("concluir")} />
      )}
    </View>
  );
}
