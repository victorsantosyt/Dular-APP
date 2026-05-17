import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { uploadAvatarDataUrl } from "@/api/perfilApi";
import { AppIcon, DButton, DCard } from "@/components/ui";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { usePerfil } from "@/hooks/usePerfil";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useAuth } from "@/stores/authStore";
import { radius, shadows, spacing } from "@/theme";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { platformSelect } from "@/utils/platform";
import {
  NotificationBell,
  ProfileHeroCard,
  ProfileRow,
  ProfileSection,
  ProfileSwitchRow,
} from "./profile/components";

type Props = { onLogout: () => void };
type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const GEO_KEY = "@dular:empregador_geo_enabled";

function firstName(value?: string | null) {
  return (value || "").trim().split(/\s+/)[0] || "Carolina";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "15/04/2023";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "15/04/2023";
  return date.toLocaleDateString("pt-BR");
}

function profileLocation(perfil: unknown) {
  const data = perfil as { cidade?: string | null; estado?: string | null; uf?: string | null };
  const cidade = data?.cidade?.trim();
  const estado = data?.estado?.trim() || data?.uf?.trim();
  if (cidade && estado) return `${cidade}, ${estado}`;
  if (cidade) return cidade;
  return "Campinas, SP";
}

function profileAge(perfil: unknown) {
  const data = perfil as { idade?: number | string | null };
  if (data?.idade) return `${data.idade} anos!`;
  return "23 anos!";
}

export default function EmpregadorPerfil({ onLogout }: Props) {
  const navigation = useNavigation<Navigation>();
  const colors = useDularColors();
  const insets = useSafeAreaInsets();
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const setUser = useAuth((state) => state.setUser);
  const user = useAuth((state) => state.user);
  const { perfil, loading, saving, error, atualizar, refetch } = usePerfil();
  const { unreadCount: unreadNotifications } = useNotificacoes();
  const busyRef = useRef(false);

  const [geoEnabled, setGeoEnabled] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const hasNotificationBadge = unreadNotifications > 0;

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
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Hotfix T-13 (2): só semeia os campos do modal quando NÃO está aberto.
  // Caso contrário, um refetch em background sobrescreve o que o usuário
  // está digitando.
  useEffect(() => {
    if (modalVisible) return;
    const nome = perfil?.nome ?? user?.nome ?? "";
    setEditNome(nome);
    setEditTelefone(perfil?.telefone ?? user?.telefone ?? "");
    setEditBio(perfil?.bio ?? user?.bio ?? "");
  }, [perfil, user, modalVisible]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const showToast = (message: string) => setToast(message);

  const openModal = () => {
    setEditNome(perfil?.nome ?? user?.nome ?? "");
    setEditTelefone(perfil?.telefone ?? user?.telefone ?? "");
    setEditBio(perfil?.bio ?? user?.bio ?? "");
    setModalVisible(true);
  };

  const saveEdits = async () => {
    const nomeTrim = editNome.trim();
    if (!nomeTrim) {
      Alert.alert("Nome inválido", "O nome não pode ficar vazio.");
      return;
    }

    const ok = await atualizar({
      nome: nomeTrim,
      telefone: editTelefone.trim(),
      bio: editBio.trim(),
    });

    if (!ok) {
      showToast("Falha ao salvar. Tente novamente.");
      return;
    }

    setUser((current) =>
      current
        ? {
            ...current,
            nome: nomeTrim,
            telefone: editTelefone.trim(),
            bio: editBio.trim(),
          }
        : current,
    );
    setModalVisible(false);
    showToast("Perfil atualizado.");
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permissão negada para acessar fotos.");
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
      setUser((current) => (current ? { ...current, avatarUrl: finalUrl } : current));
      showToast("Foto atualizada.");
    } catch {
      showToast("Falha ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
      busyRef.current = false;
    }
  };

  const handleGeoToggle = (value: boolean) => {
    setGeoEnabled(value);
    AsyncStorage.setItem(GEO_KEY, value ? "1" : "0").catch(() => undefined);
  };

  const openWhatsApp = async () => {
    const url = `https://wa.me/5565996203033?text=${encodeURIComponent("Olá! Preciso de suporte no app Dular.")}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("WhatsApp", "Não foi possível abrir o WhatsApp.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleLogout = () => {
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

  const displayName = firstName(perfil?.nome ?? user?.nome);
  const avatarUri = avatarLocal ?? perfil?.avatarUrl ?? user?.avatarUrl ?? null;
  const avatarFallback: ImageSourcePropType | null = null;
  // Hotfix T-13 (2): tela NUNCA pode ficar bloqueada por loading. Sempre
  // renderiza o conteúdo usando dados do authStore enquanto a API responde.
  // O spinner aparece apenas como decoração no topo (não-bloqueante) e o
  // banner de erro vira algo "inline" com retry, sem esconder o resto.
  const showInitialSpinner = loading && !perfil;
  const showErrorBanner = !loading && !!error && !perfil;

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
            <View style={s.headerSideRight}>
              <NotificationBell
                hasBadge={hasNotificationBadge}
                onPress={() => navigation.navigate("Notificacoes")}
              />
            </View>
          </View>

          {showInitialSpinner ? (
            <View style={s.inlineLoader}>
              <ActivityIndicator color={colors.primary} size="small" />
            </View>
          ) : null}

          {showErrorBanner ? (
            <DCard style={s.errorCard}>
              <Text style={s.errorTitle}>Não foi possível carregar.</Text>
              <Text style={s.errorText}>{error}</Text>
              <DButton label="Tentar novamente" variant="secondary" onPress={refetch} />
            </DCard>
          ) : null}

              <ProfileHeroCard
                nome={displayName}
                subtitle={profileAge(perfil)}
                location={profileLocation(perfil)}
                memberSince={formatMemberSince(perfil?.criadoEm)}
                avatarUri={avatarUri}
                avatarFallback={avatarFallback}
                uploading={avatarUploading}
                onAvatarPress={pickAvatar}
              />

              <ProfileSection title="Conta">
                <ProfileRow
                  icon="FileText"
                  title="Enviar documentos"
                  subtitle="Envie seus documentos"
                  onPress={() => navigation.navigate("VerificacaoDocs")}
                />
                <ProfileRow
                  icon="ShieldCheck"
                  title="Verificação de perfil"
                  subtitle="Acompanhe sua verificação"
                  onPress={() => Alert.alert("Verificação", "Status disponível na tela de documentos.")}
                />
                <ProfileRow
                  icon="User"
                  title="Nome, telefone, bio e foto"
                  subtitle="Edite suas informações pessoais"
                  onPress={openModal}
                />
                <ProfileRow
                  icon="MapPin"
                  title="Endereço"
                  subtitle="Onde você mora"
                  onPress={() => Alert.alert("Endereço", "Gerenciamento de endereço será conectado em breve.")}
                  isLast
                />
              </ProfileSection>

              <ProfileSection title="Segurança">
                <ProfileRow
                  icon="Lock"
                  title="Alterar senha"
                  subtitle="Segurança da conta"
                  onPress={() => navigation.navigate("AlterarSenha")}
                />
                <ProfileRow
                  icon="AlertTriangle"
                  title="Reportar incidente"
                  subtitle="Botão SOS"
                  danger
                  onPress={() => navigation.navigate("ReportIncident")}
                />
                <ProfileRow
                  icon="MessageCircle"
                  title="Suporte no WhatsApp"
                  subtitle="Fale com a equipe"
                  onPress={openWhatsApp}
                  isLast
                />
              </ProfileSection>

              <ProfileSection title="Privacidade">
                <ProfileRow
                  icon="FileText"
                  title="Termos de uso"
                  subtitle="Leia as regras da plataforma"
                  onPress={() => navigation.navigate("Termos")}
                />
                <ProfileRow
                  icon="Shield"
                  title="Privacidade"
                  subtitle="Controle seus dados"
                  onPress={() => navigation.navigate("Privacidade")}
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

              <DCard style={s.logoutCard} onPress={handleLogout}>
                <View style={s.logoutIcon}>
                  <AppIcon name="LogOut" size={21} color={colors.danger} strokeWidth={2.3} />
                </View>
                <View style={s.logoutTextWrap}>
                  <Text style={s.logoutTitle}>Sair</Text>
                  <Text style={s.logoutSubtitle}>Encerrar sessão da conta</Text>
                </View>
                <AppIcon name="ChevronRight" size={18} color={colors.danger} strokeWidth={2.2} />
              </DCard>
        </ScrollView>
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={s.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={[s.modalSheet, { maxHeight: "85%", paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.md }}
            >
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Editar perfil</Text>
                <Pressable onPress={() => setModalVisible(false)} hitSlop={16} style={s.modalClose}>
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
                returnKeyType="next"
              />

              <Text style={s.modalLabel}>Telefone</Text>
              <TextInput
                value={editTelefone}
                onChangeText={setEditTelefone}
                placeholder="Telefone"
                placeholderTextColor={colors.textMuted}
                style={s.modalInput}
                keyboardType="phone-pad"
                returnKeyType="next"
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

              <DButton
                label={saving ? "Salvando..." : "Salvar alterações"}
                onPress={saveEdits}
                loading={saving}
                style={s.saveButton}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

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
  headerSideRight: {
    width: 48,
    alignItems: "flex-end",
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
  inlineLoader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlay,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalClose: {
    padding: 6,
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
  });
}
