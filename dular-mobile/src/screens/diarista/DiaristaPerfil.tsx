import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, Linking, Image, ActivityIndicator } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { CenterWrap, useDularContainerWidth } from "../../ui/Layout";
import { resetToAuth } from "../../navigation/nav";
import * as ImagePicker from "expo-image-picker";
import { requestLocationWithAddress } from "../../lib/location";
import { getMe, getDiaristaMe, updateDiaristaPrecos, uploadAvatarDataUrl, type Me, type VerificacaoStatus } from "../../api/perfilApi";
import { getCatalogoServicos, type CatalogoTipo } from "../../api/catalogoApi";
import { getHabilidades, putHabilidades, type HabilidadePayload } from "../../api/diaristaApi";
import { apiMsg } from "../../utils/apiMsg";
import { useAuth } from "../../stores/authStore";
import { Screen } from "../../components/Screen";

function RowButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#EEF2F4",
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: "rgba(79,163,143,0.12)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#4FA38F" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#2B3443" }}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 12, color: "#8E9AA6", marginTop: 2 }}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#A7B3BE" />
    </Pressable>
  );
}

type Props = { onLogout: () => void };

export default function DiaristaPerfil({ onLogout }: Props) {
  const nav = useNavigation<any>();
  const cw = useDularContainerWidth();
  const [bio, setBio] = useState("");
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote] = useState<string | null>(null);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [verificacao, setVerificacao] = useState<VerificacaoStatus>("NAO_ENVIADO");
  const [precoLeve, setPrecoLeve] = useState<number | null>(null);
  const [precoPesada, setPrecoPesada] = useState<number | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [habilidades, setHabilidades] = useState<HabilidadePayload[]>([]);
  const [savingHabs, setSavingHabs] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const applyMe = useCallback(
    (data: Me | null) => {
      if (!data) return;
      setBio(data.bio ?? "");
      if (data.avatarUrl) setAvatarRemote(data.avatarUrl);

      setUser((prev) => ({
        ...(prev ?? { id: data.id }),
        id: data.id || prev?.id || "",
        nome: data.nome ?? prev?.nome ?? "",
        telefone: data.telefone ?? prev?.telefone,
        role: (data.role as any) ?? prev?.role,
        avatarUrl: data.avatarUrl ?? prev?.avatarUrl,
      }));
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
      const [me, profile, cat, habs] = await Promise.all([
        getMe(),
        getDiaristaMe(),
        getCatalogoServicos(),
        getHabilidades(),
      ]);
      applyMe(me);
      if (profile?.precoLeve != null) setPrecoLeve(profile.precoLeve);
      if (profile?.precoPesada != null) setPrecoPesada(profile.precoPesada);
      if (profile?.bio != null) setBio(profile.bio);
      const foto = profile?.fotoUrl || profile?.avatarUrl;
      if (foto) setAvatarRemote(foto);
      if (profile?.verificacao) {
        const s = String(profile.verificacao).toUpperCase();
        if (s === "VERIFICADO") setVerificacao("APROVADO");
        else if (s === "REPROVADO") setVerificacao("REPROVADO");
        else setVerificacao("PENDENTE");
      }
      setCatalogo(cat?.tipos ?? []);
      setHabilidades(Array.isArray(habs) ? habs : []);
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

  const openWhats = async () => {
    const phone = "5565999990000"; // ajustar depois
    const msg = encodeURIComponent("Olá! Preciso de suporte no app Dular.");
    const url = `https://wa.me/${phone}?text=${msg}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
    Linking.openURL(url);
  };

  const logout = () => {
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          onLogout();
          resetToAuth();
        },
      },
    ]);
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

  const salvarBioCats = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setToast(null);
      if (precoLeve == null || precoPesada == null) {
        setToast("Defina seus preços antes de salvar a bio.");
        return;
      }
      await updateDiaristaPrecos({ precoLeve, precoPesada, bio });
      setToast("Dados atualizados.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao salvar dados."));
    } finally {
      busyRef.current = false;
    }
  };

  const toggleHabilidade = (tipo: string, categoria?: string | null) => {
    const key = `${tipo}::${categoria ?? ""}`;
    const exists = habilidades.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
    if (exists) {
      setHabilidades((prev) => prev.filter((h) => `${h.tipo}::${h.categoria ?? ""}` !== key));
    } else {
      setHabilidades((prev) => [...prev, { tipo, categoria: categoria ?? null }]);
    }
  };

  const salvarHabilidades = async () => {
    if (savingHabs) return;
    try {
      setSavingHabs(true);
      const updated = await putHabilidades(habilidades);
      setHabilidades(Array.isArray(updated) ? updated : habilidades);
      setToast("Habilidades salvas.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao salvar habilidades."));
    } finally {
      setSavingHabs(false);
    }
  };

  const displayName = useMemo(() => {
    const raw = (user?.nome || "").trim();
    if (!raw) return "Diarista";
    return raw.split(/\s+/)[0] || "Diarista";
  }, [user?.nome]);

  const badgeLabel = useMemo(() => {
    switch (verificacao) {
      case "APROVADO":
        return { label: "Verificado", bg: "rgba(67,160,71,0.15)", fg: "#166534" };
      case "PENDENTE":
        return { label: "Pendente", bg: "#DBEAFE", fg: "#1D4ED8" };
      case "REPROVADO":
        return { label: "Reprovado", bg: "#FEE2E2", fg: "#B91C1C" };
      default:
        return { label: "Não enviado", bg: "#E5E7EB", fg: "#374151" };
    }
  }, [verificacao]);

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
      Alert.alert("Localização", e?.message ?? "Não foi possível obter sua localização.");
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <Screen title="Perfil">
      <Text style={{ textAlign: "center", fontSize: 12, color: "#8E9AA6", marginTop: -6 }}>Sua conta de prestador</Text>

      {toast ? (
        <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#0F172A" }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{toast}</Text>
        </View>
      ) : null}
      {loading ? (
        <CenterWrap mt={6}>
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: "#EEF2F4", width: cw }}>
            <ActivityIndicator color="#4FA38F" />
          </View>
        </CenterWrap>
      ) : error ? (
        <CenterWrap mt={6}>
          <View style={{ padding: 16, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.92)", borderWidth: 1, borderColor: "#EEF2F4", width: cw, gap: 8 }}>
            <Text style={{ color: "#C74444", fontWeight: "800" }}>Não foi possível carregar.</Text>
            <Text style={{ color: "#8E9AA6" }}>{error}</Text>
            <Pressable
              onPress={loadMe}
              style={{ marginTop: 6, padding: 12, borderRadius: 12, backgroundColor: "#0F172A", alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "800" }}>Tentar novamente</Text>
            </Pressable>
          </View>
        </CenterWrap>
      ) : null}
      <CenterWrap mt={6}>
          {/* Avatar + verificado */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <View style={{ position: "relative" }}>
              <View
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: 43,
                  backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: "#EEF2F4",
                alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {avatarLocal || avatarRemote ? (
                  <Image source={{ uri: avatarLocal || avatarRemote || undefined }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Ionicons name="person" size={40} color="#A7B3BE" />
                )}
              </View>

              <Pressable
                onPress={pickAvatar}
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "#4FA38F",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#E9F0ED",
              }}
            >
              <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#2B3443" }}>{displayName}</Text>
            <View
              style={{
                marginLeft: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: badgeLabel.bg,
                borderWidth: 1,
                borderColor: "rgba(79,163,143,0.22)",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: badgeLabel.fg }}>{badgeLabel.label}</Text>
            </View>
          </View>
        </View>

        {/* Bio */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#2B3443", marginBottom: 6 }}>Biografia</Text>
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
              value={bio}
              onChangeText={setBio}
              placeholder="Conte um pouco sobre você…"
              placeholderTextColor="#A7B3BE"
              style={{ color: "#2B3443", fontSize: 14, minHeight: 46 }}
              multiline
            />
          </View>
        </View>

        {/* Habilidades */}
        <View style={{ marginTop: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#2B3443", marginBottom: 8 }}>Serviços que eu faço</Text>
          <Text style={{ color: "#8E9AA6", fontSize: 12, marginBottom: 6 }}>
            {habilidades.length} categoria(s) selecionada(s)
          </Text>
          {catalogo.length === 0 ? (
            <View style={{ padding: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "#EEF2F4" }}>
              <Text style={{ color: "#8E9AA6" }}>Carregando catálogo...</Text>
            </View>
          ) : (
            catalogo.map((t) => (
              <View key={t.tipo} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#2B3443", marginBottom: 6 }}>{t.label}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {t.categorias.map((c) => {
                    const key = `${t.tipo}::${c.categoria}`;
                    const active = habilidades.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
                    return (
                      <Pressable
                        key={c.categoria}
                        onPress={() => toggleHabilidade(t.tipo, c.categoria)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 999,
                          marginRight: 8,
                          marginBottom: 8,
                          backgroundColor: active ? "#4FA38F" : "rgba(255,255,255,0.92)",
                          borderWidth: 1,
                          borderColor: active ? "#4FA38F" : "#EEF2F4",
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : "#2B3443" }}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          <Pressable
            onPress={salvarHabilidades}
            disabled={savingHabs}
            style={{
              marginTop: 4,
              backgroundColor: "#4FA38F",
              borderRadius: 14,
              padding: 12,
              alignItems: "center",
              opacity: savingHabs ? 0.7 : 1,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800" }}>{savingHabs ? "Salvando..." : "Salvar habilidades"}</Text>
          </Pressable>
        </View>

        {/* Ações */}
        <View style={{ marginTop: 10 }}>
          <RowButton icon="create-outline" title="Editar dados" subtitle="Nome, telefone, bio e foto" onPress={() => nav.navigate("EditDados")} />
          <RowButton icon="document-text-outline" title="Enviar documentos" subtitle="Verificação de perfil" onPress={() => nav.navigate("VerificacaoDocs")} />
          <RowButton icon="location-outline" title="Editar bairros" subtitle="Onde você atende" onPress={() => nav.navigate("EditBairros")} />
          <RowButton icon="calendar-outline" title="Editar disponibilidade" subtitle="Dias e horários" onPress={() => nav.navigate("EditDisponibilidade")} />
          <RowButton icon="pricetag-outline" title="Editar preços" subtitle="Valores por serviço" onPress={() => nav.navigate("EditPrecos")} />
          <RowButton icon="key-outline" title="Alterar senha" subtitle="Segurança da conta" onPress={() => nav.navigate("AlterarSenha")} />
          <RowButton icon="alert-circle-outline" title="Reportar incidente" subtitle="Assédio, ameaça ou abuso" onPress={() => nav.navigate("ReportIncident")} />
          <RowButton icon="logo-whatsapp" title="Suporte no WhatsApp" subtitle="Fale com a equipe" onPress={openWhats} />
          <RowButton icon="shield-checkmark-outline" title="Termos de uso" subtitle="Placeholder (vamos formular)" onPress={() => nav.navigate("Termos")} />
          <RowButton icon="lock-closed-outline" title="Privacidade" subtitle="Placeholder (vamos formular)" onPress={() => nav.navigate("Privacidade")} />
          <RowButton
            icon="locate"
            title="Ativar geolocalização"
            subtitle={geoInfo || "Usar minha localização para serviços próximos"}
            onPress={ativarGeo}
          />
        </View>

        {/* Sair */}
        <Pressable
          onPress={logout}
          style={{
            marginTop: 8,
            backgroundColor: "rgba(255,255,255,0.92)",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: "#F2D9D9",
          }}
        >
          <Text style={{ textAlign: "center", fontSize: 15, fontWeight: "800", color: "#C74444" }}>Sair</Text>
          </Pressable>

          <View style={{ height: 18 }} />
      </CenterWrap>
    </Screen>
  );
}
