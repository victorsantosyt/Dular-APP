/**
 * ClientePerfil — Perfil do cliente
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Toda lógica de avatar, verificação, geo e atualização preservada.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { requestLocationWithAddress } from "@/lib/location";
import { api } from "@/lib/api";
import {
  getMe,
  updateMe,
  uploadAvatarDataUrl,
  type Me,
  type VerificacaoStatus,
} from "@/api/perfilApi";
import { type SafeScoreTier } from "@/api/safeScoreApi";
import { apiMsg } from "@/utils/apiMsg";
import { useAuth } from "@/stores/authStore";

// ── Tokens Dular ──────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { DularBadge } from "@/components/DularBadge";
import { DButton } from "@/components/DButton";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { AppIcon } from "@/components/ui";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";

type Props = { onLogout: () => void };
type SafeScoreSummary = {
  faixa: string;
  cor: string;
  bloqueado: boolean;
  totalServicos: number;
  verificado: boolean;
  tier?: SafeScoreTier;
};

// Badge de verificação → variante DularBadge
function verificacaoBadge(status: VerificacaoStatus) {
  switch (status) {
    case "APROVADO":  return { variant: "success" as const, label: "Verificado" };
    case "PENDENTE":  return { variant: "warning" as const, label: "Pendente" };
    case "REPROVADO": return { variant: "danger"  as const, label: "Reprovado" };
    default:          return { variant: "neutral" as const, label: "Não enviado" };
  }
}

export default function ClientePerfil({ onLogout }: Props) {
  const insets  = useSafeAreaInsets();
  const setUser = useAuth((s) => s.setUser);
  const nav     = useNavigation<any>();
  const busyRef = useRef(false);

  const [nome, setNome]           = useState("");
  const [telefone, setTelefone]   = useState("");
  const [email, setEmail]         = useState("");
  const [bio, setBio]             = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoInfo, setGeoInfo]     = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [toast, setToast]         = useState<string | null>(null);
  const [avatarLocal, setAvatarLocal]   = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote] = useState<string | null>(null);
  const [verificacao, setVerificacao]   = useState<VerificacaoStatus>("NAO_ENVIADO");
  const [safeScore, setSafeScore]       = useState<SafeScoreSummary | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const applyMe = useCallback((data: Me | null) => {
    if (!data) return;
    setNome(data.nome ?? "");
    setTelefone(data.telefone ?? "");
    setBio(data.bio ?? "");
    setEmail((data as any).email ?? "");
    if (data.nome || data.telefone || data.role) {
      setUser((prev) => ({
        ...(prev ?? { id: data.id }),
        id: data.id || prev?.id || "",
        nome: data.nome ?? prev?.nome ?? "",
        telefone: data.telefone ?? prev?.telefone,
        role: (data.role as any) ?? prev?.role,
        avatarUrl: data.avatarUrl ?? prev?.avatarUrl,
      }));
    }
    if (data.avatarUrl) setAvatarRemote(data.avatarUrl);
    if (data.verificacao?.status)  setVerificacao(data.verificacao.status);
    else if (data.verificado)       setVerificacao("APROVADO");
  }, [setUser]);

  const showToast = (msg: string) => setToast(msg);

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadMe = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getMe();
      applyMe(data);
      if (data?.id) {
        try {
          setScoreLoading(true);
          const scoreRes = await api.get<SafeScoreSummary>(`/api/usuarios/${data.id}/score`);
          setSafeScore(scoreRes.data);
        } catch {
          setSafeScore(null);
        } finally {
          setScoreLoading(false);
        }
      }
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      setLoading(false);
    }
  }, [applyMe]);

  useFocusEffect(useCallback(() => { loadMe(); }, [loadMe]));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const salvar = async () => {
    if (saving || busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      applyMe(await updateMe({ nome }));
      showToast("Dados atualizados.");
    } catch (e: any) {
      showToast(apiMsg(e, "Falha ao salvar dados."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { showToast("Permissão negada para acessar fotos."); return; }
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
      const base64 = asset.base64;
      if (!base64) { showToast("Não foi possível ler a imagem."); return; }
      const mime    = (asset as any).mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;
      const up      = await uploadAvatarDataUrl(dataUrl);
      const finalUrl = up?.user?.avatarUrl ?? dataUrl;
      if (finalUrl) setAvatarRemote(finalUrl);
      setUser((u) => (u ? { ...u, avatarUrl: finalUrl ?? u.avatarUrl } : u));
      showToast("Foto atualizada.");
    } catch (e: any) {
      showToast(apiMsg(e, "Falha ao atualizar foto."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  const ativarGeo = async () => {
    try {
      setGeoLoading(true);
      const { coords, address } = await requestLocationWithAddress();
      const bairro = address?.district || address?.subregion || "Bairro não encontrado";
      const cidade = address?.city || address?.subregion || "Cidade não encontrada";
      const uf     = (address as any)?.region_code || address?.region || "";
      const resumo = `${bairro} - ${cidade}${uf ? "/" + uf : ""}`;
      setGeoInfo(`${resumo} (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`);
      Alert.alert("Localização ativada", resumo);
    } catch (e: any) {
      Alert.alert("Localização", e?.message ?? "Não foi possível ativar a geolocalização.");
    } finally {
      setGeoLoading(false);
    }
  };

  const { variant: badgeVariant, label: badgeLabel } = verificacaoBadge(verificacao);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(32, insets.bottom + 16) }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Toast ── */}
        {toast ? (
          <View style={s.toast}>
            <Text style={s.toastText}>{toast}</Text>
          </View>
        ) : null}

        {/* ── Estados de loading / erro ── */}
        {loading ? (
          <View style={s.card}>
            <View style={s.skeletonLine} />
            <View style={[s.skeletonLine, { width: "60%" }]} />
            <ActivityIndicator color={colors.green} style={{ marginTop: 8 }} />
          </View>
        ) : error ? (
          <View style={s.card}>
            <Text style={s.errorTitle}>Não foi possível carregar.</Text>
            <Text style={s.errorSub}>{error}</Text>
            <DButton title="Tentar novamente" onPress={loadMe} variant="outline" style={{ marginTop: 8 }} />
          </View>
        ) : (
          <>
            {/* ── Avatar ── */}
            <View style={[s.card, s.avatarSection]}>
              <Pressable onPress={pickAvatar} style={s.avatarWrap}>
                {avatarLocal || avatarRemote ? (
                  <Image
                    source={{ uri: avatarLocal || avatarRemote || undefined }}
                    style={s.avatarImg}
                  />
                ) : (
                  <AppIcon name="User" size={54} color={colors.green} background />
                )}
                {/* Ícone de câmera sobre avatar */}
                <View style={s.cameraBtn}>
                  <AppIcon name="Camera" size={13} color="#FFF" />
                </View>
              </Pressable>

              <Text style={s.nomeText}>{nome || "Cliente"}</Text>

              <DularBadge text={badgeLabel} variant={badgeVariant} />

              {scoreLoading ? (
                <ActivityIndicator color={colors.green} />
              ) : safeScore ? (
                <>
                  <SafeScoreBadge {...safeScore} style={{ marginTop: 4 }} />
                  {safeScore.bloqueado ? (
                    <View style={s.restrictedBox}>
                      <Text style={s.restrictedText}>
                        Este usuário está com acesso restrito na plataforma
                      </Text>
                    </View>
                  ) : null}
                </>
              ) : null}

              <Pressable onPress={pickAvatar} style={s.fotoBtn}>
                <Text style={s.fotoBtnText}>{saving ? "Enviando..." : "Alterar foto"}</Text>
              </Pressable>
            </View>

            {/* ── Dados pessoais ── */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Dados pessoais</Text>

              <Text style={s.fieldLabel}>Nome</Text>
              <TextInput value={nome} onChangeText={setNome} style={s.input} />

              <Text style={s.fieldLabel}>Telefone</Text>
              <TextInput value={telefone} style={[s.input, s.inputDisabled]} editable={false} />

              <Text style={s.fieldLabel}>E-mail</Text>
              <TextInput
                value={email}
                style={[s.input, s.inputDisabled]}
                keyboardType="email-address"
                placeholder="Em breve"
                placeholderTextColor={colors.sub}
                editable={false}
              />

              <Text style={s.fieldLabel}>Bio</Text>
              <TextInput
                value={bio}
                style={[s.input, s.inputDisabled, { minHeight: 64 }]}
                multiline
                editable={false}
              />

              <DButton
                title={saving ? "Salvando..." : "Salvar"}
                onPress={salvar}
                loading={saving}
                style={{ marginTop: 6 }}
              />
            </View>

            {/* ── Verificação ── */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Verificação</Text>
              <View style={s.verRow}>
                <Text style={s.verLabel}>Status:</Text>
                <DularBadge text={badgeLabel} variant={badgeVariant} />
              </View>
              <DButton
                title={
                  verificacao === "APROVADO" ? "Verificado"
                  : verificacao === "PENDENTE" ? "Acompanhar / reenviar"
                  : "Enviar documentos"
                }
                variant={verificacao === "APROVADO" ? "ghost" : "primary"}
                onPress={() => Alert.alert("Verificação", "Envio de documentos será habilitado em breve.")}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* ── Segurança ── */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Segurança</Text>
              <Text style={s.helpText}>
                Reporte qualquer abuso, assédio ou comportamento inadequado.
              </Text>
              <DButton
                title="Reportar incidente"
                variant="outline"
                onPress={() => nav.navigate(PERFIL_STACK_ROUTES.REPORT_INCIDENT)}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* ── Localização ── */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Localização</Text>
              <Text style={s.helpText}>
                Ative sua localização para sugestões mais precisas.
              </Text>
              {geoInfo ? <Text style={s.geoInfo}>{geoInfo}</Text> : null}
              <DButton
                title={geoLoading ? "Ativando..." : "Ativar geolocalização"}
                variant="outline"
                onPress={ativarGeo}
                loading={geoLoading}
                style={{ marginTop: 4 }}
              />
            </View>

            {/* ── Logout ── */}
            <Pressable onPress={onLogout} style={s.logoutBtn}>
              <AppIcon name="LogOut" size={18} color={colors.danger} />
              <Text style={s.logoutText}>Sair da conta</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    gap: 12,
  },

  // Toast
  toast: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  toastText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 13,
  },

  // Card base
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 16,
    gap: 10,
    ...shadow.card,
  },

  // Avatar section
  avatarSection: {
    alignItems: "center",
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    position: "relative",
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  cameraBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  nomeText: {
    ...typography.h2,
    marginTop: 4,
  },
  fotoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.btn,
    backgroundColor: colors.greenLight,
  },
  fotoBtnText: {
    color: colors.greenDark,
    fontWeight: "700",
    fontSize: 13,
  },

  // Section title
  sectionTitle: {
    ...typography.h3,
  },

  // Fields
  fieldLabel: {
    ...typography.sub,
    marginBottom: -4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.stroke,
    borderRadius: radius.md,
    padding: 12,
    backgroundColor: colors.card,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  inputDisabled: {
    backgroundColor: colors.cardStrong,
    color: colors.sub,
  },

  // Verificação
  verRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verLabel: {
    ...typography.sub,
  },
  restrictedBox: {
    width: "100%",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    padding: 10,
  },
  restrictedText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  // Texto de ajuda
  helpText: {
    ...typography.sub,
    lineHeight: 18,
  },
  geoInfo: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: "600",
  },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.btn,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    marginTop: 4,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: "800",
    fontSize: 14,
  },

  // Error / skeleton
  errorTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.danger,
  },
  errorSub: {
    ...typography.sub,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.stroke,
    width: "100%",
  },
});
