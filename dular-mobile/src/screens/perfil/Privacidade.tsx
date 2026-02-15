import React from "react";
import { Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Ionicons } from "@expo/vector-icons";

export default function Privacidade() {
  const nav = useNavigation<any>();

  return (
    <Screen
      title="Privacidade"
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
          <Text style={{ color: "#2B3443", fontSize: 14, fontWeight: "700" }}>Conteúdo placeholder</Text>
          <Text style={{ color: "#8E9AA6", fontSize: 13 }}>
            Vamos adicionar a política de privacidade em breve.
          </Text>
        </View>
    </Screen>
  );
}
