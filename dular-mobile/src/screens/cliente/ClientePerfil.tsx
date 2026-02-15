import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, ScrollView, ActivityIndicator, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets as useRNSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/theme";
import { requestLocationWithAddress } from "../../lib/location";
import { getMe, updateMe, uploadAvatarDataUrl, type Me, type VerificacaoStatus } from "../../api/perfilApi";
import { apiMsg } from "../../utils/apiMsg";
import { useAuth } from "../../stores/authStore";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";

type Props = { onLogout: () => void };

export default function ClientePerfil({ onLogout }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote] = useState<string | null>(null);
  const [verificacao, setVerificacao] = useState<VerificacaoStatus>("NAO_ENVIADO");
  const rnInsets = useRNSafeAreaInsets();
  const setUser = useAuth((s) => s.setUser);
  const nav = useNavigation<any>();

  const insets = rnInsets;
  const busyRef = useRef(false);

  const applyMe = useCallback(
    (data: Me | null) => {
      if (!data) return;
      setNome(data.nome ?? "");
      setTelefone(data.telefone ?? "");
      setBio(data.bio ?? "");
      setEmail((data as any).email ?? "");
      // email não existe no backend; mantemos editable local
      if (data.nome || data.telefone || data.role) {
        setUser((prev) => {
          return {
            ...(prev ?? { id: data.id }),
            id: data.id || prev?.id || "",
            nome: data.nome ?? prev?.nome ?? "",
            telefone: data.telefone ?? prev?.telefone,
            role: (data.role as any) ?? prev?.role,
            avatarUrl: data.avatarUrl ?? prev?.avatarUrl,
          };
        });
      }
      if (data.avatarUrl) setAvatarRemote(data.avatarUrl);
      if (data.verificacao?.status) {
        setVerificacao(data.verificacao.status);
      } else if (data.verificado) {
        setVerificacao("APROVADO");
      }
    },
    [setUser]
  );

  const loadMe = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getMe();
      applyMe(data);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      setLoading(false);
    }
  }, [applyMe]);

  useFocusEffect(
    useCallback(() => {
      loadMe();
    }, [loadMe])
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const salvar = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      setToast(null);
      const updated = await updateMe({ nome });
      applyMe(updated);
      setToast("Dados atualizados.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao salvar dados."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setToast("Permissão negada para acessar fotos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;
    setAvatarLocal(asset.uri);
    await uploadAvatarAndSave(asset);
  };

  const badgeLabel = useCallback(() => {
    switch (verificacao) {
      case "APROVADO":
        return { label: "Verificado", bg: "#DCFCE7", fg: "#166534" };
      case "PENDENTE":
        return { label: "Pendente", bg: "#DBEAFE", fg: "#1D4ED8" };
      case "REPROVADO":
        return { label: "Reprovado", bg: "#FEE2E2", fg: "#B91C1C" };
      default:
        return { label: "Não enviado", bg: "#E5E7EB", fg: "#374151" };
    }
  }, [verificacao]);

  const uploadAvatarAndSave = async (asset: ImagePicker.ImagePickerAsset) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      setToast(null);
      const base64 = asset.base64;
      if (!base64) {
        setToast("Não foi possível ler a imagem.");
        return;
      }
      const mime = (asset as any).mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;
      const up = await uploadAvatarDataUrl(dataUrl);
      const finalUrl = up?.user?.avatarUrl ?? dataUrl;
      if (finalUrl) setAvatarRemote(finalUrl);
      setUser((u) => (u ? { ...u, avatarUrl: finalUrl ?? u.avatarUrl } : u));
      setToast("Foto atualizada.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao atualizar foto."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const solicitarVerificacao = async () => {
    Alert.alert("Verificação", "Envio de documentos será habilitado em breve.");
  };

  const ativarGeo = async () => {
    try {
      setGeoLoading(true);
      const { coords, address } = await requestLocationWithAddress();
      const bairro = address?.district || address?.subregion || "Bairro não encontrado";
      const cidade = address?.city || address?.subregion || "Cidade não encontrada";
      const uf = (address as any)?.region_code || address?.region || "";
      const resumo = `${bairro} - ${cidade}${uf ? "/" + uf : ""}`;
      setGeoInfo(`${resumo} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`);
      Alert.alert("Localização ativada", resumo);
    } catch (e: any) {
      Alert.alert("Localização", e?.message ?? "Não foi possível ativar a geolocalização.");
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <RNSafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right", "bottom"]}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: Math.max(32, insets.bottom + 16),
          gap: 12,
        }}
      >
      {toast ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#0F172A" }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{toast}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={{ padding: 16, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 10 }}>
          <View style={{ height: 16, backgroundColor: "#E5E7EB", borderRadius: 8 }} />
          <View style={{ height: 16, backgroundColor: "#E5E7EB", borderRadius: 8 }} />
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 8 }}>
          <Text style={{ color: "#B91C1C", fontWeight: "800" }}>Não foi possível carregar.</Text>
          <Text style={{ color: colors.muted }}>{error}</Text>
          <Pressable onPress={loadMe} style={[primaryBtn, { backgroundColor: "#0F172A" }]}>
            <Text style={primaryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <>
        <View style={{ alignItems: "center", gap: 8, padding: 12, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: "rgba(79,163,143,0.08)",
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {avatarLocal || avatarRemote ? (
            <Image source={{ uri: avatarLocal || avatarRemote || undefined }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Ionicons name="person-circle" size={80} color={colors.primary} />
          )}
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{nome || "Cliente"}</Text>
        <View
          style={{
            marginTop: 2,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: badgeLabel().bg,
          }}
        >
          <Text style={{ color: badgeLabel().fg, fontWeight: "800", fontSize: 12 }}>{badgeLabel().label}</Text>
        </View>
        <Pressable
          onPress={pickAvatar}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(79,163,143,0.15)" }}
        >
          <Text style={{ color: colors.primary, fontWeight: "700" }}>{saving ? "Enviando..." : "Alterar foto"}</Text>
        </Pressable>
      </View>

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Dados pessoais</Text>

        <Text style={label}>Nome</Text>
        <TextInput value={nome} onChangeText={setNome} style={input} />

        <Text style={label}>Telefone</Text>
        <TextInput value={telefone} onChangeText={setTelefone} style={input} keyboardType="phone-pad" editable={false} />

        <Text style={label}>E-mail</Text>
        <TextInput value={email} onChangeText={setEmail} style={input} keyboardType="email-address" placeholder="Em breve" editable={false} />

        <Text style={label}>Bio</Text>
        <TextInput value={bio} onChangeText={setBio} style={[input, { minHeight: 70 }]} multiline editable={false} />

        <Pressable onPress={salvar} style={[primaryBtn, saving && { opacity: 0.7 }]}>
          <Text style={primaryText}>{saving ? "Salvando..." : "Salvar"}</Text>
        </Pressable>
      </View>

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Verificação</Text>
        <Text style={{ color: colors.muted }}>
          Status: {badgeLabel().label}
        </Text>
        <Pressable onPress={solicitarVerificacao} style={primaryBtn}>
          <Text style={primaryText}>
            {verificacao === "APROVADO" ? "Verificado" : verificacao === "PENDENTE" ? "Acompanhar / reenviar" : "Enviar documentos"}
          </Text>
        </Pressable>
      </View>

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Segurança</Text>
        <Text style={{ color: colors.muted }}>Reporte qualquer abuso, assédio ou comportamento inadequado.</Text>
        <Pressable onPress={() => nav.navigate("ReportIncident")} style={secondaryBtn}>
          <Text style={[primaryText, { color: colors.primary }]}>Reportar incidente</Text>
        </Pressable>
      </View>

      <View style={{ padding: 14, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, gap: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.text }}>Localização</Text>
        <Text style={{ color: colors.muted }}>Ative sua localização para sugestões mais precisas (Google Maps em breve).</Text>
        {geoInfo ? <Text style={{ color: colors.text }}>{geoInfo}</Text> : null}
        <Pressable onPress={ativarGeo} style={[secondaryBtn, geoLoading && { opacity: 0.7 }]}>
          <Text style={secondaryText}>{geoLoading ? "Ativando..." : "Ativar geolocalização"}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onLogout} style={[primaryBtn, { backgroundColor: "#d22" }]}>
        <Text style={[primaryText, { color: "#fff" }]}>Sair</Text>
      </Pressable>
      </>
      )}
      </ScrollView>
    </RNSafeAreaView>
  );
}

const label = { color: colors.muted, fontSize: 13 };
const input = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
  padding: 12,
  backgroundColor: "#fff",
  color: colors.text,
};
const primaryBtn = {
  marginTop: 6,
  height: 48,
  borderRadius: 14,
  backgroundColor: colors.primary,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
const primaryText = { color: "#fff", fontWeight: "800" as const, fontSize: 15 };
const secondaryBtn = {
  marginTop: 4,
  height: 44,
  borderRadius: 12,
  backgroundColor: "rgba(79,163,143,0.12)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  borderWidth: 1,
  borderColor: "rgba(79,163,143,0.3)",
};
const secondaryText = { color: colors.primary, fontWeight: "800" as const };
