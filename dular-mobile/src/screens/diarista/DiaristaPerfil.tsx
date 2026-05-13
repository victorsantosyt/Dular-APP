/**
 * DiaristaPerfil — Perfil da diarista
 *
 * Layout espelhado em EmpregadorPerfil (ProfileHeroCard, ProfileSection, ProfileRow,
 * ProfileSwitchRow), com toda a lógica de habilidades/preços/bio preservada.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/lib/api";
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
import { AppIcon, DButton, DCard } from "@/components/ui";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import { radius, shadows, spacing, typography } from "@/theme";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { platformSelect } from "@/utils/platform";
import {
  ProfileHeroCard,
  ProfileRow,
  ProfileSection,
  ProfileSwitchRow,
} from "../empregador/profile/components";

type Props = { onLogout: () => void };
type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

const GEO_KEY = "@dular:diarista_geo_enabled";

function firstName(value?: string | null) {
  return (value || "").trim().split(/\s+/)[0] || "Diarista";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function verificacaoSubtitle(status: VerificacaoStatus) {
  if (status === "APROVADO") return "Profissional verificada";
  if (status === "PENDENTE") return "Verificação pendente";
  if (status === "REPROVADO") return "Verificação reprovada";
  return "Envie seus documentos";
}

export default function DiaristaPerfil({ onLogout }: Props) {
  const navigation = useNavigation<Navigation>();
  const colors = useDularColors();
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const setUser = useAuth((state) => state.setUser);
  const user = useAuth((state) => state.user);
  const busyRef = useRef(false);

  // ── State (preservado da versão anterior) ────────────────────────────────
  const [me, setMe] = useState<Me | null>(null);
  const [bio, setBio] = useState("");
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarRemote, setAvatarRemote] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [verificacao, setVerificacao] = useState<VerificacaoStatus>("NAO_ENVIADO");
  const [precoLeve, setPrecoLeve] = useState<number | null>(null);
  const [precoPesada, setPrecoPesada] = useState<number | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoTipo[]>([]);
  const [habilidades, setHabilidades] = useState<HabilidadePayload[]>([]);
  const [savingHabs, setSavingHabs] = useState(false);

  // ── Geo + modal de edição ────────────────────────────────────────────────
  const [geoEnabled, setGeoEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [habsModalVisible, setHabsModalVisible] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editBio, setEditBio] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(GEO_KEY)
      .then((value) => {
        if (value === "0") setGeoEnabled(false);
        if (value === "1") setGeoEnabled(true);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Load ─────────────────────────────────────────────────────────────────
  const applyMe = useCallback(
    (data: Me | null) => {
      if (!data) return;
      setMe(data);
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
    },
    [setUser]
  );

  const loadMe = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const [meData, profile, cat, habs] = await Promise.all([
        getMe(),
        getDiaristaMe(),
        getCatalogoServicos(),
        getHabilidades(),
      ]);
      applyMe(meData);
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

  useEffect(() => {
    setEditNome(me?.nome ?? user?.nome ?? "");
    setEditTelefone(me?.telefone ?? user?.telefone ?? "");
    setEditBio(bio);
  }, [me, user, bio]);

  // ── Avatar ───────────────────────────────────────────────────────────────
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
      quality: 0.82,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri || !asset.base64 || busyRef.current) return;

    setAvatarLocal(asset.uri);
    setAvatarUploading(true);
    busyRef.current = true;
    try {
      const mime = (asset as { mimeType?: string }).mimeType ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const uploaded = await uploadAvatarDataUrl(dataUrl);
      const finalUrl = uploaded?.user?.avatarUrl ?? dataUrl;
      if (finalUrl) setAvatarRemote(finalUrl);
      setUser((u) => (u ? { ...u, avatarUrl: finalUrl ?? u.avatarUrl } : u));
      setToast("Foto atualizada.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao atualizar foto."));
    } finally {
      setAvatarUploading(false);
      busyRef.current = false;
    }
  };

  // ── Habilidades ──────────────────────────────────────────────────────────
  const toggleHabilidade = (tipo: string, categoria?: string | null) => {
    const key = `${tipo}::${categoria ?? ""}`;
    const exists = habilidades.some((h) => `${h.tipo}::${h.categoria ?? ""}` === key);
    setHabilidades((prev) =>
      exists
        ? prev.filter((h) => `${h.tipo}::${h.categoria ?? ""}` !== key)
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

  // ── Modal de edição (nome/telefone/bio) ──────────────────────────────────
  const openModal = () => {
    setEditNome(me?.nome ?? user?.nome ?? "");
    setEditTelefone(me?.telefone ?? user?.telefone ?? "");
    setEditBio(bio);
    setModalVisible(true);
  };

  const saveEdits = async () => {
    const nomeTrim = editNome.trim();
    if (!nomeTrim) {
      Alert.alert("Nome inválido", "O nome não pode ficar vazio.");
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setSaving(true);
      // Atualiza nome/telefone via /api/me
      await api.put("/api/me", {
        nome: nomeTrim,
        telefone: editTelefone.trim(),
        bio: editBio.trim(),
      });
      // Bio também precisa ir junto com preços (compat com endpoint atual)
      if (precoLeve != null && precoPesada != null) {
        await updateDiaristaPrecos({ precoLeve, precoPesada, bio: editBio.trim() });
      }
      setBio(editBio.trim());
      setUser((current) =>
        current
          ? {
              ...current,
              nome: nomeTrim,
              telefone: editTelefone.trim(),
              bio: editBio.trim(),
            }
          : current
      );
      setModalVisible(false);
      setToast("Perfil atualizado.");
    } catch (e: any) {
      setToast(apiMsg(e, "Falha ao salvar."));
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  };

  // ── Misc ─────────────────────────────────────────────────────────────────
  const openWhats = async () => {
    const url = `https://wa.me/5565999990000?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleGeoToggle = async (value: boolean) => {
    setGeoEnabled(value);
    AsyncStorage.setItem(GEO_KEY, value ? "1" : "0").catch(() => undefined);
    if (value) {
      try {
        const { coords, address } = await requestLocationWithAddress();
        const cidade = address?.city || address?.subregion || "Cidade não encontrada";
        const uf = (address as any)?.region_code || address?.region || "";
        Alert.alert("Localização ativada", `${cidade}${uf ? "/" + uf : ""}`);
        void coords;
      } catch (e: any) {
        Alert.alert("Localização", e?.message ?? "Não foi possível obter sua localização.");
        setGeoEnabled(false);
        AsyncStorage.setItem(GEO_KEY, "0").catch(() => undefined);
      }
    }
  };

  const logout = () => {
    Alert.alert("Sair", "Encerrar sessão da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            await api.post("/api/auth/logout");
          } catch {}
          onLogout();
        },
      },
    ]);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const displayName = useMemo(() => firstName(me?.nome ?? user?.nome), [me, user]);
  const avatarUri = avatarLocal ?? avatarRemote ?? user?.avatarUrl ?? null;
  const avatarFallback: ImageSourcePropType | null = null;
  const heroSubtitle = verificacaoSubtitle(verificacao);
  const heroLocation = "Cidade não informada";
  const heroMemberSince = formatMemberSince((me as any)?.criadoEm);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}

      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <View style={s.headerSide} />
            <Text style={s.title}>Perfil</Text>
            <View style={s.headerSide} />
          </View>

          {loading ? (
            <View style={s.centerCard}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error ? (
            <DCard style={s.errorCard}>
              <Text style={s.errorTitle}>Não foi possível carregar.</Text>
              <Text style={s.errorText}>{error}</Text>
              <DButton label="Tentar novamente" variant="secondary" onPress={loadMe} />
            </DCard>
          ) : (
            <>
              <ProfileHeroCard
                nome={displayName}
                subtitle={heroSubtitle}
                location={heroLocation}
                memberSince={heroMemberSince}
                avatarUri={avatarUri}
                avatarFallback={avatarFallback}
                uploading={avatarUploading}
                onAvatarPress={pickAvatar}
              />

              {/* ── Bio ── */}
              <ProfileSection title="Sobre você">
                <View style={s.bioCardInner}>
                  {bio ? (
                    <Text style={s.bioText}>{bio}</Text>
                  ) : (
                    <Text style={s.bioPlaceholder}>
                      Nenhuma biografia. Conte um pouco sobre você no botão abaixo.
                    </Text>
                  )}
                </View>
              </ProfileSection>

              {/* ── Conta ── */}
              <ProfileSection title="Conta">
                <ProfileRow
                  icon="FileText"
                  title="Enviar documentos"
                  subtitle="Verificação de perfil"
                  onPress={() => navigation.navigate("VerificacaoDocs")}
                />
                <ProfileRow
                  icon="ShieldCheck"
                  title="Verificação de perfil"
                  subtitle="Acompanhe sua verificação"
                  onPress={() =>
                    Alert.alert("Verificação", "Status disponível na tela de documentos.")
                  }
                />
                <ProfileRow
                  icon="User"
                  title="Nome, telefone, bio e foto"
                  subtitle="Edite suas informações pessoais"
                  onPress={openModal}
                  isLast
                />
              </ProfileSection>

              {/* ── Profissional (diarista-específico) ── */}
              <ProfileSection title="Profissional">
                <ProfileRow
                  icon="MapPin"
                  title="Editar bairros"
                  subtitle="Onde você atende"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.EDIT_BAIRROS)}
                />
                <ProfileRow
                  icon="Calendar"
                  title="Editar disponibilidade"
                  subtitle="Dias e horários"
                  onPress={() =>
                    (navigation as any).navigate(PERFIL_STACK_ROUTES.EDIT_DISPONIBILIDADE)
                  }
                />
                <ProfileRow
                  icon="CreditCard"
                  title="Editar preços"
                  subtitle="Valores por serviço"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.EDIT_PRECOS)}
                />
                <ProfileRow
                  icon="Wallet"
                  title="Carteira"
                  subtitle="Seus ganhos e pagamentos"
                  onPress={() => navigation.navigate("Carteira")}
                  isLast
                />
              </ProfileSection>

              {/* ── Segurança ── */}
              <ProfileSection title="Segurança">
                <ProfileRow
                  icon="Lock"
                  title="Alterar senha"
                  subtitle="Segurança da conta"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.ALTERAR_SENHA)}
                />
                <ProfileRow
                  icon="AlertTriangle"
                  title="Reportar incidente"
                  subtitle="Botão SOS"
                  danger
                  onPress={() =>
                    (navigation as any).navigate(PERFIL_STACK_ROUTES.REPORT_INCIDENT)
                  }
                />
                <ProfileRow
                  icon="MessageCircle"
                  title="Suporte no WhatsApp"
                  subtitle="Fale com a equipe"
                  onPress={openWhats}
                  isLast
                />
              </ProfileSection>

              {/* ── Privacidade ── */}
              <ProfileSection title="Privacidade">
                <ProfileRow
                  icon="FileText"
                  title="Termos de uso"
                  subtitle="Leia as regras da plataforma"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.TERMOS)}
                />
                <ProfileRow
                  icon="Shield"
                  title="Privacidade"
                  subtitle="Controle seus dados"
                  onPress={() => (navigation as any).navigate(PERFIL_STACK_ROUTES.PRIVACIDADE)}
                />
                <ProfileSwitchRow
                  icon="MapPin"
                  title="Ativar geolocalização"
                  subtitle="Melhorar sugestões perto de você"
                  value={geoEnabled}
                  onValueChange={handleGeoToggle}
                />
                <ProfileSwitchRow
                  icon="Sparkles"
                  title="Dark mode"
                  subtitle="Tema escuro do app"
                  value={themeMode === "dark"}
                  onValueChange={toggleTheme}
                  isLast
                />
              </ProfileSection>

              {/* ── Logout ── */}
              <DCard style={s.logoutCard} onPress={logout}>
                <View style={s.logoutIcon}>
                  <AppIcon name="LogOut" size={21} color={colors.danger} strokeWidth={2.3} />
                </View>
                <View style={s.logoutTextWrap}>
                  <Text style={s.logoutTitle}>Sair</Text>
                  <Text style={s.logoutSubtitle}>Encerrar sessão da conta</Text>
                </View>
                <AppIcon name="ChevronRight" size={18} color={colors.danger} strokeWidth={2.2} />
              </DCard>
            </>
          )}
        </ScrollView>
      </View>

      {/* ── Modal de edição ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: "height" })}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Editar perfil</Text>
              <Pressable onPress={() => setModalVisible(false)} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={s.modalLabel}>Nome</Text>
            <TextInput
              value={editNome}
              onChangeText={setEditNome}
              placeholder="Seu nome"
              placeholderTextColor={colors.textMuted}
              style={s.modalInput}
              autoCapitalize="words"
            />

            <Text style={s.modalLabel}>Telefone</Text>
            <TextInput
              value={editTelefone}
              onChangeText={setEditTelefone}
              placeholder="Telefone"
              placeholderTextColor={colors.textMuted}
              style={s.modalInput}
              keyboardType="phone-pad"
            />

            <Text style={s.modalLabel}>Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={(value) => setEditBio(value.slice(0, 300))}
              placeholder="Conte um pouco sobre você"
              placeholderTextColor={colors.textMuted}
              style={[s.modalInput, s.modalInputMulti]}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={s.charCount}>{editBio.length}/300</Text>

            <Text style={s.modalLabel}>Serviços</Text>
            <Pressable
              onPress={() => setHabsModalVisible(true)}
              style={({ pressed }) => [s.habsTrigger, pressed && { opacity: 0.78 }]}
            >
              <View style={s.habsTriggerLeft}>
                <View style={s.habsTriggerIcon}>
                  <AppIcon name="Sparkles" size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.habsTriggerTitle}>Minhas habilidades</Text>
                  <Text style={s.habsTriggerSub}>
                    {habilidades.length > 0
                      ? `${habilidades.length} selecionada(s)`
                      : "Selecione os serviços que você faz"}
                  </Text>
                </View>
              </View>
              <AppIcon name="ChevronRight" size={18} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>

            <DButton
              label={saving ? "Salvando..." : "Salvar alterações"}
              onPress={saveEdits}
              loading={saving}
              style={s.saveButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal flutuante de habilidades ── */}
      <Modal
        visible={habsModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setHabsModalVisible(false)}
      >
        <View style={s.habsOverlay}>
          <View style={s.habsCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Minhas habilidades</Text>
              <Pressable onPress={() => setHabsModalVisible(false)} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.habsScroll}
            >
              {catalogo.length === 0 ? (
                <Text style={s.bioPlaceholder}>Carregando catálogo...</Text>
              ) : (
                catalogo.map((t) => (
                  <View key={t.tipo} style={{ gap: 6 }}>
                    <Text style={s.catLabel}>{t.label}</Text>
                    <View style={s.chips}>
                      {t.categorias.map((c) => {
                        const key = `${t.tipo}::${c.categoria}`;
                        const active = habilidades.some(
                          (h) => `${h.tipo}::${h.categoria ?? ""}` === key
                        );
                        return (
                          <Pressable
                            key={c.categoria}
                            onPress={() => toggleHabilidade(t.tipo, c.categoria)}
                            style={[s.chip, active && s.chipOn]}
                          >
                            <Text style={[s.chipText, active && s.chipTextOn]}>
                              {c.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <DButton
              label={savingHabs ? "Salvando..." : "Salvar habilidades"}
              onPress={async () => {
                await salvarHabilidades();
                setHabsModalVisible(false);
              }}
              loading={savingHabs}
              style={s.saveButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
type ThemeColors = ReturnType<typeof useDularColors>;

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 122,
    gap: 14,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSide: {
    width: 48,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  centerCard: {
    minHeight: 420,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    top: 14,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.textPrimary,
    ...shadows.floating,
  },
  toastText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  errorCard: {
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  errorTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  // Bio
  bioCardInner: {
    padding: 14,
  },
  bioText: {
    color: colors.textPrimary,
    ...typography.bodySm,
    lineHeight: 20,
    fontWeight: "500",
  },
  bioPlaceholder: {
    color: colors.textMuted,
    ...typography.bodySm,
    fontWeight: "500",
    fontStyle: "italic",
  },

  // Habilidades
  habsCardInner: {
    padding: 14,
    gap: 12,
  },
  catLabel: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.lavenderSoft,
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
  },
  chipOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  chipTextOn: {
    color: colors.white,
  },

  // Logout
  logoutCard: {
    borderRadius: radius.lg,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.surface,
  },
  logoutIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerSoft,
  },
  logoutTextWrap: {
    flex: 1,
    gap: 4,
  },
  logoutTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  logoutSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  modalLabel: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  modalInput: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: 15,
    fontWeight: "600",
  },
  modalInputMulti: {
    minHeight: 94,
    paddingTop: 12,
  },
  charCount: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  saveButton: {
    marginTop: spacing.md,
  },

  // Trigger "Minhas habilidades" dentro do modal
  habsTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginTop: 4,
  },
  habsTriggerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  habsTriggerIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
  },
  habsTriggerTitle: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  habsTriggerSub: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
    marginTop: 2,
  },

  // Card flutuante de habilidades
  habsOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.overlay,
  },
  habsCard: {
    width: "100%",
    maxHeight: "82%",
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadows.floating,
  },
  habsScroll: {
    paddingVertical: spacing.sm,
    gap: 14,
  },
  });
}
