import React, { useState } from "react";
import { Text, View, TextInput, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBg, CenterWrap } from "../../ui/Layout";
import { Ionicons } from "@expo/vector-icons";

export default function EditPrecos() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [leve, setLeve] = useState("150,00");
  const [pesada, setPesada] = useState("220,00");

  const salvar = () => Alert.alert("Preços", "Integração com API será feita depois.");

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
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>Editar preços</Text>
      </View>

      <CenterWrap>
        <Field label="Faxina leve (R$)">
          <TextInput
            value={leve}
            onChangeText={setLeve}
            keyboardType="decimal-pad"
            style={inputStyle}
            placeholderTextColor="#A7B3BE"
          />
        </Field>

        <Field label="Faxina pesada (R$)">
          <TextInput
            value={pesada}
            onChangeText={setPesada}
            keyboardType="decimal-pad"
            style={inputStyle}
            placeholderTextColor="#A7B3BE"
          />
        </Field>

        <Pressable onPress={salvar} style={{ marginTop: 8, backgroundColor: "#4FA38F", borderRadius: 16, padding: 14 }}>
          <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>Salvar</Text>
        </Pressable>
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

const inputStyle = {
  color: "#2B3443",
  fontSize: 14,
};
