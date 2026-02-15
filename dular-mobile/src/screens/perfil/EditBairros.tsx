import React, { useState } from "react";
import { Text, View, TextInput, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBg, CenterWrap } from "../../ui/Layout";
import { Ionicons } from "@expo/vector-icons";

export default function EditBairros() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [bairros, setBairros] = useState("Centro\nSanta Rosa\nJardim Itália");

  const salvar = () => Alert.alert("Bairros", "Integração com API será feita depois.");

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
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>Bairros atendidos</Text>
      </View>

      <CenterWrap>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#2B3443", marginBottom: 6 }}>
          Liste um bairro por linha
        </Text>
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#EEF2F4",
            padding: 12,
          }}
        >
          <TextInput
            value={bairros}
            onChangeText={setBairros}
            placeholder="Bairro 1&#10;Bairro 2&#10;Bairro 3"
            placeholderTextColor="#A7B3BE"
            style={{ color: "#2B3443", fontSize: 14, minHeight: 120 }}
            multiline
          />
        </View>

        <Pressable onPress={salvar} style={{ marginTop: 16, backgroundColor: "#4FA38F", borderRadius: 16, padding: 14 }}>
          <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>Salvar</Text>
        </Pressable>
      </CenterWrap>
    </ScreenBg>
  );
}
