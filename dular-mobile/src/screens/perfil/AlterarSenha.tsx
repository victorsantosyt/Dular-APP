import React, { useState } from "react";
import { Text, View, TextInput, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Ionicons } from "@expo/vector-icons";
import { changePassword } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";

export default function AlterarSenha() {
  const nav = useNavigation<any>();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirm, setConfirm] = useState("");

  const salvar = async () => {
    if (nova !== confirm) {
      return Alert.alert("Erro", "As senhas não conferem.");
    }
    try {
      await changePassword({ senhaAtual: atual, novaSenha: nova });
      Alert.alert("Senha", "Senha atualizada com sucesso.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", apiMsg(e, "Falha ao atualizar senha."));
    }
  };

  return (
    <Screen
      title="Alterar senha"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#2B3443" />
        </Pressable>
      }
    >
        <Field label="Senha atual">
          <TextInput value={atual} onChangeText={setAtual} secureTextEntry style={inputStyle} placeholderTextColor="#A7B3BE" />
        </Field>
        <Field label="Nova senha">
          <TextInput value={nova} onChangeText={setNova} secureTextEntry style={inputStyle} placeholderTextColor="#A7B3BE" />
        </Field>
        <Field label="Confirme a nova senha">
          <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry style={inputStyle} placeholderTextColor="#A7B3BE" />
        </Field>

        <Pressable onPress={salvar} style={{ marginTop: 8, backgroundColor: "#4FA38F", borderRadius: 16, padding: 14 }}>
          <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>Salvar</Text>
        </Pressable>
    </Screen>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#2B3443", marginBottom: 6 }}>{label}</Text>
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.92)",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#EEF2F4",
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        {children}
      </View>
    </View>
  );
}

const inputStyle = {
  color: "#2B3443",
  fontSize: 14,
};
