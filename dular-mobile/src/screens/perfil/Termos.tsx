import React from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { BackCircleButton } from "@/components/ui";
import { useAuth } from "@/stores/authStore";
import { colors } from "@/theme/tokens";

export default function Termos() {
  const nav = useNavigation<any>();
  const role = useAuth((s) => s.role ?? s.user?.role);
  const voltarPerfil = () => nav.navigate(role === "MONTADOR" ? "MontadorPerfil" : "Perfil");

  return (
    <Screen
      title="Termos de uso"
      rightAction={<BackCircleButton onPress={voltarPerfil} />}
    >
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.stroke,
            padding: 16,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>Conteúdo placeholder</Text>
          <Text style={{ color: colors.sub, fontSize: 13 }}>
            Vamos adicionar o texto completo dos termos em breve.
          </Text>
        </View>
    </Screen>
  );
}
