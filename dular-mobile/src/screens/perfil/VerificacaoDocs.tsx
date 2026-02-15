import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View, Pressable, Alert, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "../../components/Screen";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { apiMsg } from "../../utils/apiMsg";

type FileField = "docFrente" | "selfie" | "docVerso";

export default function VerificacaoDocs() {
  const nav = useNavigation<any>();
  const [docFrente, setDocFrente] = useState<string | null>(null);
  const [docVerso, setDocVerso] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const pick = useCallback(async (field: FileField) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setToast("Permissão negada para acessar fotos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (!uri) return;
    if (field === "docFrente") setDocFrente(uri);
    if (field === "docVerso") setDocVerso(uri);
    if (field === "selfie") setSelfie(uri);
  }, []);

  const enviar = async () => {
    if (busyRef.current) return;
    if (!docFrente || !selfie) {
      Alert.alert("Envio", "Selecione documento (frente) e selfie.");
      return;
    }
    busyRef.current = true;
    try {
      setSaving(true);
      setToast(null);
      Alert.alert("Verificação", "Envio de documentos será habilitado em breve.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao enviar documentos."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const renderPick = (label: string, uri: string | null, field: FileField) => (
    <Pressable
      onPress={() => pick(field)}
      style={{
        borderWidth: 1,
        borderColor: "#EEF2F4",
        borderRadius: 14,
        padding: 12,
        backgroundColor: "rgba(255,255,255,0.92)",
        alignItems: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: 160, borderRadius: 12 }} />
      ) : (
        <View style={{ alignItems: "center", gap: 6 }}>
          <Ionicons name="cloud-upload-outline" size={26} color="#4FA38F" />
          <Text style={{ color: "#2B3443", fontWeight: "700" }}>{label}</Text>
          <Text style={{ color: "#8E9AA6", fontSize: 12 }}>Toque para escolher</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <Screen
      title="Verificação"
      rightAction={
        <Pressable onPress={() => nav.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color="#2B3443" />
        </Pressable>
      }
      contentStyle={{ gap: 12 }}
    >
        {toast ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#0F172A" }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{toast}</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 15, fontWeight: "800", color: "#2B3443" }}>Envie seus documentos</Text>
        <Text style={{ color: "#8E9AA6" }}>
          RG/CNH (frente e verso) e selfie. Usamos isso para manter a comunidade segura.
        </Text>

        {renderPick("Documento (frente)", docFrente, "docFrente")}
        {renderPick("Documento (verso) - opcional", docVerso, "docVerso")}
        {renderPick("Selfie", selfie, "selfie")}

        <Pressable
          onPress={enviar}
          disabled={saving}
          style={{
            marginTop: 4,
            backgroundColor: "#4FA38F",
            borderRadius: 14,
            padding: 14,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>{saving ? "Enviando..." : "Enviar documentos"}</Text>
        </Pressable>
    </Screen>
  );
}
