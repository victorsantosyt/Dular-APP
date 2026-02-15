import React, { useState } from "react";
import { Text, View, TextInput, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBg, CenterWrap } from "../../ui/Layout";
import { Ionicons } from "@expo/vector-icons";

export default function EditDados() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [nome, setNome] = useState("Diarista");
  const [telefone, setTelefone] = useState("65999990002");
  const [email, setEmail] = useState("");

  const salvar = () => Alert.alert("Salvar", "Integração com API será feita depois.");

  return (
    <ScreenBg>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color="#2B3443" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>Editar dados</Text>
      </View>

      <CenterWrap>
        <Field label="Nome">
          <TextInput value={nome} onChangeText={setNome} style={inputStyle} placeholderTextColor="#A7B3BE" />
        </Field>

        <Field label="Telefone">
          <TextInput
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            style={inputStyle}
            placeholderTextColor="#A7B3BE"
          />
        </Field>

        <Field label="Email (opcional)">
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={inputStyle}
            placeholderTextColor="#A7B3BE"
          />
        </Field>

        <PrimaryButton title="Salvar" onPress={salvar} />
      </CenterWrap>
    </ScreenBg>
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

function PrimaryButton({ title, onPress }: any) {
  return (
    <Pressable onPress={onPress} style={{ marginTop: 6, backgroundColor: "#4FA38F", borderRadius: 16, padding: 14 }}>
      <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>{title}</Text>
    </Pressable>
  );
}

const inputStyle = {
  color: "#2B3443",
  fontSize: 14,
};
