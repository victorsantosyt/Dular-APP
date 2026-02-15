import React from "react";
import { Text, View, Pressable, Alert, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Ionicons } from "@expo/vector-icons";

export default function Suporte() {
  const nav = useNavigation<any>();

  const openWhats = async () => {
    const phone = "5565999990000"; // ajustar depois
    const msg = encodeURIComponent("Olá! Preciso de suporte no app Dular.");
    const url = `https://wa.me/${phone}?text=${msg}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
    Linking.openURL(url);
  };

  return (
    <Screen
      title="Suporte"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#2B3443" />
        </Pressable>
      }
    >
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "#EEF2F4",
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#2B3443" }}>Canais</Text>
          <Pressable onPress={openWhats} style={{ backgroundColor: "#4FA38F", borderRadius: 14, padding: 12 }}>
            <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>WhatsApp</Text>
          </Pressable>
          <Pressable onPress={() => Alert.alert("Email", "Envie para suporte@dular.app")}>
            <Text style={{ textAlign: "center", color: "#4FA38F", fontWeight: "800" }}>Email</Text>
          </Pressable>
        </View>
    </Screen>
  );
}
