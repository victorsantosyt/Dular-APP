import React, { useState } from "react";
import { Text, View, Pressable, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBg, CenterWrap } from "../../ui/Layout";
import { Ionicons } from "@expo/vector-icons";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const TURNS = ["Manhã", "Tarde"];

export default function EditDisponibilidade() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [slots, setSlots] = useState<{ [key: string]: boolean }>({
    "Seg-Manhã": true,
    "Seg-Tarde": true,
    "Qua-Manhã": true,
  });

  const toggle = (key: string) => {
    setSlots((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const salvar = () => Alert.alert("Disponibilidade", "Integração com API será feita depois.");

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
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>Disponibilidade</Text>
      </View>

      <CenterWrap>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#2B3443", marginBottom: 10 }}>Selecione dias/turnos</Text>

        {DAYS.map((d) => (
          <View key={d} style={{ flexDirection: "row", marginBottom: 10, alignItems: "center" }}>
            <View style={{ width: 60 }}>
              <Text style={{ fontWeight: "700", color: "#2B3443" }}>{d}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {TURNS.map((t) => {
                const key = `${d}-${t}`;
                const active = slots[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggle(key)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 12,
                      backgroundColor: active ? "#4FA38F" : "rgba(255,255,255,0.92)",
                      borderWidth: 1,
                      borderColor: active ? "#4FA38F" : "#EEF2F4",
                    }}
                  >
                    <Text style={{ color: active ? "#fff" : "#2B3443", fontWeight: "700" }}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Pressable onPress={salvar} style={{ marginTop: 8, backgroundColor: "#4FA38F", borderRadius: 16, padding: 14 }}>
          <Text style={{ textAlign: "center", color: "#fff", fontWeight: "800" }}>Salvar</Text>
        </Pressable>
      </CenterWrap>
    </ScreenBg>
  );
}
