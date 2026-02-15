import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Alert, ActivityIndicator } from "react-native";
import { dularColors } from "../../theme/dular";
import { DularButton } from "../../components/DularButton";
import { getMe, updateMe, type Me } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";
import { useAuth } from "../../stores/authStore";
import { useFocusEffect } from "@react-navigation/native";
import { Screen } from "../../components/Screen";

export default function EditProfile({ navigation }: any) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setUser = useAuth((s) => s.setUser);
  const busyRef = useRef(false);

  const apply = useCallback(
    (data: Me | null) => {
      if (!data) return;
      setNome(data.nome ?? "");
      setTelefone(data.telefone ?? "");
      setBio(data.bio ?? "");
      setUser((prev) => ({
        ...(prev ?? { id: data.id }),
        id: data.id || prev?.id || "",
        nome: data.nome ?? prev?.nome ?? "",
        telefone: data.telefone ?? prev?.telefone,
        role: (data.role as any) ?? prev?.role,
      }));
    },
    [setUser]
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getMe();
      apply(data);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      setLoading(false);
    }
  }, [apply]);

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
      const updated = await updateMe({ nome });
      apply(updated);
      Alert.alert("Sucesso", "Dados atualizados.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao salvar dados."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  return (
    <Screen title="Editar dados">
      {loading ? (
        <ActivityIndicator color={dularColors.primary} />
      ) : error ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: dularColors.danger, fontWeight: "800" }}>Não foi possível carregar.</Text>
          <Text style={{ color: dularColors.muted }}>{error}</Text>
          <DularButton title="Tentar novamente" onPress={load} />
        </View>
      ) : (
        <>
          <Text style={{ color: dularColors.muted }}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            style={input}
            placeholder="Seu nome"
            placeholderTextColor={dularColors.muted}
          />

          <Text style={{ color: dularColors.muted }}>Telefone</Text>
          <TextInput
            value={telefone}
            onChangeText={setTelefone}
            style={input}
            keyboardType="phone-pad"
            placeholder="Seu telefone"
            placeholderTextColor={dularColors.muted}
            editable={false}
          />

          <Text style={{ color: dularColors.muted }}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            style={[input, { minHeight: 80 }]}
            multiline
            placeholder="Conte sobre sua experiência"
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
