import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, TextInput, Alert, ScrollView, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { apiMsg } from "../../utils/apiMsg";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../stores/authStore";

const TYPES = ["ASSEDIO", "IMPORTUNACAO", "VIOLENCIA", "AMEACA", "OUTRO"] as const;

export default function ReportIncident({ route }: any) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [tipo, setTipo] = useState<(typeof TYPES)[number]>("ASSEDIO");
  const [descricao, setDescricao] = useState("");
  const [serviceId, setServiceId] = useState(route?.params?.serviceId || "");
  const [reportedUserId, setReportedUserId] = useState(route?.params?.reportedUserId || "");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [severity, setSeverity] = useState<"BAIXA" | "MEDIA" | "ALTA">("MEDIA");
  const [images, setImages] = useState<{ uri: string; mime: string; name: string }[]>([]);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  async function pickImage() {
    if (images.length >= 3) {
      setToast("Máximo de 3 imagens.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setToast("Permissão de fotos negada.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    const uri = asset.uri;
    const ext = uri.split(".").pop()?.toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const name = `evidencia_${Date.now()}.${ext === "png" ? "png" : "jpg"}`;
    setImages((cur) => [...cur, { uri, mime, name }]);
  }

  function removeImage(uri: string) {
    setImages((cur) => cur.filter((i) => i.uri !== uri));
  }

  const enviar = async () => {
    if (busyRef.current) return;
    if (!reportedUserId && !serviceId) {
      Alert.alert("Incidente", "Informe o ID do serviço ou do usuário.");
      return;
    }
    if (!token) {
      Alert.alert("Sessão", "Faça login novamente.");
      return;
    }
    busyRef.current = true;
    try {
      setSaving(true);
      setToast(null);
      const hasImages = images.length > 0;
      if (hasImages) {
        const form = new FormData();
        form.append("reportedUserId", reportedUserId || "");
        if (serviceId) form.append("serviceId", serviceId);
        form.append("type", tipo);
        form.append("severity", severity);
        form.append("description", descricao.trim());
        images.slice(0, 3).forEach((img, idx) => {
          form.append(`file${idx + 1}`, {
            uri: img.uri,
            type: img.mime,
            name: img.name,
          } as any);
        });

        const res = await fetch(`${api.defaults.baseURL}/api/incidentes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: form,
        });
        const txt = await res.text();
        if (!res.ok) {
          throw new Error(txt || `Erro HTTP ${res.status}`);
        }
      } else {
        await api.post("/api/incidentes", {
          reportedUserId: reportedUserId || undefined,
          serviceId: serviceId || undefined,
          type: tipo,
          severity,
          description: descricao.trim(),
        });
      }
      setToast("Incidente enviado. Analisaremos rapidamente.");
      setImages([]);
      setDescricao("");
      nav.goBack();
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao registrar incidente."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F7FA" }}>
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
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>Reportar incidente</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {toast ? (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#0F172A" }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{toast}</Text>
          </View>
        ) : null}

        <Text style={{ fontSize: 14, fontWeight: "700", color: "#2B3443" }}>Tipo</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {TYPES.map((t) => {
            const active = t === tipo;
            return (
              <Pressable
                key={t}
                onPress={() => setTipo(t)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: active ? "#4FA38F" : "#fff",
                  borderWidth: 1,
                  borderColor: active ? "#4FA38F" : "#E5E7EB",
                }}
              >
                <Text style={{ color: active ? "#fff" : "#2B3443", fontWeight: "700" }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontSize: 14, fontWeight: "700", color: "#2B3443" }}>Gravidade</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["BAIXA", "MEDIA", "ALTA"] as const).map((s) => {
            const active = severity === s;
            const color =
              s === "ALTA" ? "#B91C1C" : s === "MEDIA" ? "#1D4ED8" : "#6B7280";
            const bg =
              s === "ALTA" ? "#FEE2E2" : s === "MEDIA" ? "#DBEAFE" : "#E5E7EB";
            return (
              <Pressable
                key={s}
                onPress={() => setSeverity(s)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: active ? bg : "#fff",
                  borderWidth: 1,
                  borderColor: active ? color : "#E5E7EB",
                }}
              >
                <Text style={{ color: active ? color : "#2B3443", fontWeight: "700" }}>{s}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={{ fontSize: 14, fontWeight: "700", color: "#2B3443" }}>Descrição</Text>
        <TextInput
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Descreva o que aconteceu (no mínimo 10 caracteres)."
          placeholderTextColor="#9AA6B2"
          multiline
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            minHeight: 120,
            padding: 12,
            backgroundColor: "#fff",
            color: "#1F2937",
          }}
        />

        <Text style={{ fontSize: 14, fontWeight: "700", color: "#2B3443" }}>Serviço (opcional)</Text>
        <TextInput
          value={serviceId}
          onChangeText={setServiceId}
          placeholder="ID do serviço (se tiver)"
          placeholderTextColor="#9AA6B2"
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fff",
            color: "#1F2937",
          }}
        />

        <Text style={{ fontSize: 14, fontWeight: "700", color: "#2B3443" }}>Usuário (opcional)</Text>
        <TextInput
          value={reportedUserId}
          onChangeText={setReportedUserId}
          placeholder="ID do usuário (se souber)"
          placeholderTextColor="#9AA6B2"
          style={{
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fff",
            color: "#1F2937",
          }}
        />

        <Pressable
          onPress={pickImage}
          style={{
            marginTop: 4,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            borderRadius: 12,
            padding: 12,
            backgroundColor: "#fff",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#2B3443", fontWeight: "800" }}>
            {images.length >= 3 ? "Limite de 3 imagens" : "Anexar evidência (opcional)"}
          </Text>
          <Text style={{ color: "#9AA6B2", fontSize: 12, marginTop: 4 }}>
            jpeg/png · até 3 arquivos
          </Text>
        </Pressable>

        {images.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
            {images.map((img) => (
              <View key={img.uri} style={{ position: "relative" }}>
                <Image source={{ uri: img.uri }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                <Pressable
                  onPress={() => removeImage(img.uri)}
                  style={{
                    position: "absolute",
                    top: -6,
                    right: -6,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: "rgba(0,0,0,0.65)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={enviar}
          disabled={saving}
          style={{
            marginTop: 8,
            backgroundColor: "#0F172A",
            borderRadius: 14,
            padding: 14,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>{saving ? "Enviando..." : "Enviar incidente"}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
