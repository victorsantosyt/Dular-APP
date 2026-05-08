/**
 * DiaristaPerfil — Perfil da diarista
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Toda lógica de habilidades, preços, avatar e verificação preservada.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { CenterWrap } from "@/ui/Layout";
import { requestLocationWithAddress } from "@/lib/location";
import {
  getMe,
  getDiaristaMe,
  updateDiaristaPrecos,
  uploadAvatarDataUrl,
  type Me,
  type VerificacaoStatus,
} from "@/api/perfilApi";
import { getCatalogoServicos, type CatalogoTipo } from "@/api/catalogoApi";
import { getHabilidades, putHabilidades, type HabilidadePayload } from "@/api/diaristaApi";
import { apiMsg } from "@/utils/apiMsg";
import { useAuth } from "@/stores/authStore";
import { Screen } from "@/components/Screen";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── RowButton ────────────────────────────────────────────────────────────────

function RowButton({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
    >
      <View style={s.rowIcon}>
        <Ionicons name={icon} size={19} color={colors.green} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color={colors.sub} />
    </Pressable>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

type Props = { onLogout: () => void };

export default function DiaristaPerfil({ onLogout }: Props) {
  const nav     = useNavigation<any>();
  const setUser = useAuth((st) => st.setUser);
  const user    = useAuth((st) => st.user);
  const busyRef = useRef(false);

  const [bio, setBio]                       = useState("");
  const [avatarLocal, setAvatarLocal]       = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote]     = useState<string | null>(null);
  const [geoInfo, setGeoInfo]               = useState<string | null>(null);
  const [geoLoading, setGeoLoading]         = useState(false);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [toast, setToast]                   = useState<string | null>(null);
  const [verificacao, setVerificacao]       = useState<VerificacaoStatus>("NAO_ENVIADO");
  const [precoLeve, setPrecoLeve]           = useState<number | null>(null);
  const [precoPesada, setPrecoPesada]       = useState<number | null>(null);
  const [catalogo, setCatalogo]             = useState<CatalogoTipo[]>([]);
  const [habilidades, setHabilidades]       = useState<HabilidadePayload[]>([]);
  const [savingHabs, setSavingHabs]         = useState(false);

  // ── Toast auto-dismiss ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const applyMe = useCallback((data: Me | null) => {
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
    if (data.verificacao?.status) setVerificacao(data.verificacao.status);
    else if (data.verificado) setVerificacao("APROVADO");
  }, [setUser]);

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
        const pv = String(profile.verificacao).toUpperCase();
        setVerificacao(pv === "VERIFICADO" ? "APROVADO" : pv === "REPROVADO" ? "REPROVADO" : "PENDENTE");
      }
      setCatalogo(cat?.tipos ?? []);
      setHabilidades(Array.isArray(habs) ? habs : []);
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar perfil."));
    } finally {
      setLoading(false);
    }
  }, [applyMe]);

  useFocusEffect(useCallback(() => { loadMe(); }, [loadMe]));

  // ── Avatar ────────────────────────────────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { setToast("Permissão negada para acessar fotos."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true,
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
      if (!base64) { setToast("Não foi possível ler a imagem."); return; }
      const mime    = (asset as any).mimeType || "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;
      const up      = await uploadAvatarDataUrl(dataUrl);
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

  // ── Habilidades ───────────────────────────────────────────────────────────
  const toggleHabilidade = (tipo: string, categoria?: string | null) => {
    const key    = `${tipo}::${categoria ?? ""}`;
    const exists = habilidades.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
    setHabilidades((prev) =>
      exists ? prev.filter((h) => `${h.tipo}::${h.categoria ?? ""}` !== key)
             : [...prev, { tipo, categoria: categoria ?? null }]
    );
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

  // ── Misc actions ──────────────────────────────────────────────────────────
  const openWhats = async () => {
    const url = `https://wa.me/5565999990000?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok  = await Linking.canOpenURL(url);
    if (!ok) return Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
    Linking.openURL(url);
  };

  const logout = () => {
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: () => { onLogout(); } },
    ]);
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
      Alert.alert("Localização", e?.message ?? "Não foi possível obter sua localização.");
    } finally {
      setGeoLoading(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayName = useMemo(() => {
    const raw = (user?.nome || "").trim();
    return raw.split(/\s+/)[0] || "Diarista";
  }, [user?.nome]);

  const badgeVariant = useMemo(() => {
    if (verificacao === "APROVADO")  return "success" as const;
    if (verificacao === "PENDENTE")  return "warning" as const;
    if (verificacao === "REPROVADO") return "danger"  as const;
    return "neutral" as const;
  }, [verificacao]);

  const badgeText = useMemo(() => {
    if (verificacao === "APROVADO")  return "Verificado";
    if (verificacao === "PENDENTE")  return "Pendente";
    if (verificacao === "REPROVADO") return "Reprovado";
    return "Não enviado";
  }, [verificacao]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Screen title="Perfil">
      <Text style={s.screenSub}>Sua conta de prestador</Text>

      {/* Toast */}
      {toast ? (
        <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
      ) : null}

      {/* Loading / Error */}
      {loading ? (
        <View style={s.card}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : error ? (
        <View style={[s.card, { gap: 8 }]}>
          <Text style={s.errorTitle}>Não foi possível carregar.</Text>
          <Text style={s.errorSub}>{error}</Text>
          <DButton title="Tentar novamente" onPress={loadMe} variant="outline" />
        </View>
      ) : null}

      <CenterWrap mt={6}>

        {/* ── Avatar + nome + badge ── */}
        <View style={s.avatarSection}>
          <Pressable onPress={pickAvatar} style={s.avatarWrap}>
            {avatarLocal || avatarRemote ? (
              <Image source={{ uri: avatarLocal || avatarRemote || undefined }} style={s.avatarImg} />
            ) : (
              <Ionicons name="person" size={40} color={colors.sub} />
            )}
            <View style={s.cameraBtn}>
              <Ionicons name="camera" size={14} color={colors.white} />
            </View>
          </Pressable>

          <View style={s.nameRow}>
            <Text style={s.nameText}>{displayName}</Text>
            <DularBadge text={badgeText} variant={badgeVariant} style={{ marginLeft: 8 }} />
          </View>
        </View>

        {/* ── Bio ── */}
        <View style={[s.card, { marginTop: 14 }]}>
          <Text style={s.fieldLabel}>Biografia</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Conte um pouco sobre você…"
            placeholderTextColor={colors.sub}
            style={s.bioInput}
            multiline
          />
          <DButton
            title={saving ? "Salvando..." : "Salvar bio"}
            onPress={async () => {
              if (busyRef.current) return;
              busyRef.current = true;
              try {
                if (precoLeve == null || precoPesada == null) {
                  setToast("Defina seus preços antes de salvar a bio.");
                  return;
                }
                await updateDiaristaPrecos({ precoLeve, precoPesada, bio });
                setToast("Dados atualizados.");
              } catch (e: any) {
                setToast(apiMsg(e, "Falha ao salvar dados."));
              } finally { busyRef.current = false; }
            }}
            loading={saving}
            style={{ marginTop: 4 }}
          />
        </View>

        {/* ── Habilidades ── */}
        <View style={[s.card, { marginTop: 12, gap: 10 }]}>
          <Text style={s.fieldLabel}>
            Serviços que eu faço
            <Text style={{ color: colors.sub, fontWeight: "600" }}>
              {"  "}{habilidades.length} selecionada(s)
            </Text>
          </Text>

          {catalogo.length === 0 ? (
            <Text style={s.errorSub}>Carregando catálogo...</Text>
          ) : (
            catalogo.map((t) => (
              <View key={t.tipo}>
                <Text style={s.catLabel}>{t.label}</Text>
                <View style={s.chips}>
                  {t.categorias.map((c) => {
                    const key    = `${t.tipo}::${c.categoria}`;
                    const active = habilidades.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
                    return (
                      <Pressable
                        key={c.categoria}
                        onPress={() => toggleHabilidade(t.tipo, c.categoria)}
                        style={[s.chip, active && s.chipOn]}
                      >
                        <Text style={[s.chipText, active && s.chipTextOn]}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}

          <DButton
            title={savingHabs ? "Salvando..." : "Salvar habilidades"}
            onPress={salvarHabilidades}
            loading={savingHabs}
          />
        </View>

        {/* ── Menu de ações ── */}
        <View style={{ marginTop: 12, gap: 0 }}>
          <RowButton icon="create-outline"           title="Editar dados"           subtitle="Nome, telefone, bio e foto"      onPress={() => nav.navigate(PERFIL_STACK_ROUTES.EDIT_DADOS)} />
          <RowButton icon="document-text-outline"    title="Enviar documentos"      subtitle="Verificação de perfil"           onPress={() => nav.navigate(PERFIL_STACK_ROUTES.VERIFICACAO_DOCS)} />
          <RowButton icon="location-outline"         title="Editar bairros"         subtitle="Onde você atende"                onPress={() => nav.navigate(PERFIL_STACK_ROUTES.EDIT_BAIRROS)} />
          <RowButton icon="calendar-outline"         title="Editar disponibilidade" subtitle="Dias e horários"                 onPress={() => nav.navigate(PERFIL_STACK_ROUTES.EDIT_DISPONIBILIDADE)} />
          <RowButton icon="pricetag-outline"         title="Editar preços"          subtitle="Valores por serviço"             onPress={() => nav.navigate(PERFIL_STACK_ROUTES.EDIT_PRECOS)} />
          <RowButton icon="key-outline"              title="Alterar senha"          subtitle="Segurança da conta"              onPress={() => nav.navigate(PERFIL_STACK_ROUTES.ALTERAR_SENHA)} />
          <RowButton icon="alert-circle-outline"     title="Reportar incidente"     subtitle="Assédio, ameaça ou abuso"        onPress={() => nav.navigate(PERFIL_STACK_ROUTES.REPORT_INCIDENT)} />
          <RowButton icon="logo-whatsapp"            title="Suporte no WhatsApp"    subtitle="Fale com a equipe"               onPress={openWhats} />
          <RowButton icon="shield-checkmark-outline" title="Termos de uso"          onPress={() => nav.navigate(PERFIL_STACK_ROUTES.TERMOS)} />
          <RowButton icon="lock-closed-outline"      title="Privacidade"            onPress={() => nav.navigate(PERFIL_STACK_ROUTES.PRIVACIDADE)} />
          <RowButton
            icon="locate"
            title="Ativar geolocalização"
            subtitle={geoInfo || "Usar minha localização para serviços próximos"}
            onPress={ativarGeo}
          />
        </View>

        {/* ── Logout ── */}
        <Pressable onPress={logout} style={s.logoutBtn}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={s.logoutText}>Sair da conta</Text>
        </Pressable>

        <View style={{ height: 18 }} />
      </CenterWrap>
    </Screen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screenSub: {
    textAlign: "center",
    fontSize: 12,
    color: colors.sub,
    marginTop: -4,
    marginBottom: 4,
  },
  toast: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
    marginBottom: 4,
  },
  toastText: { color: colors.white, fontWeight: "800", fontSize: 13 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    ...shadow.card,
  },
  errorTitle: { fontSize: 14, fontWeight: "800", color: colors.danger },
  errorSub:   { ...typography.sub },

  // Avatar
  avatarSection: { alignItems: "center", marginTop: 8, gap: 10 },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  avatarImg: { width: 90, height: 90, borderRadius: 45 },
  cameraBtn: {
    position: "absolute",
    right: -2, bottom: -2,
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "center" },
  nameText: { fontSize: 18, fontWeight: "800", color: colors.ink },

  // Bio
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 6 },
  bioInput: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    minHeight: 54,
    paddingVertical: 0,
  },

  // Habilidades
  catLabel: { fontSize: 12, fontWeight: "700", color: colors.sub, marginBottom: 6 },
  chips:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.cardStrong,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  chipOn:      { backgroundColor: colors.green, borderColor: colors.green },
  chipText:    { fontSize: 12, fontWeight: "700", color: colors.ink },
  chipTextOn:  { color: colors.white },

  // Row buttons
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    ...shadow.card,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.greenLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowSub:   { fontSize: 12, color: colors.sub, marginTop: 1 },

  // Logout
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: radius.btn,
    borderWidth: 1.5,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    marginTop: 4,
  },
  logoutText: { color: colors.danger, fontWeight: "800", fontSize: 14 },
});
