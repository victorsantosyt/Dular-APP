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
import { salvarLocalizacaoAtual } from "@/api/localizacaoApi";
import { api } from "@/lib/api";
import { uploadAvatarDataUrl } from "@/api/perfilApi";
import { AppIcon, DButton, DCard, type AppIconName } from "@/components/ui";
import { useCurrentRegion } from "@/hooks/useCurrentRegion";
import { usePerfil } from "@/hooks/usePerfil";
import type { PerfilUsuario } from "@/hooks/usePerfil";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { useAuth } from "@/stores/authStore";
import { radius, shadows, spacing } from "@/theme";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { platformSelect } from "@/utils/platform";
import {
  ProfileHeroCard,
  ProfileRow,
  ProfileSection,
  ProfileSwitchRow,
} from "./profile/components";

type Props = { onLogout: () => void };
type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type VerificationStatus = NonNullable<PerfilUsuario["verificacao"]>["status"] | "VERIFICADO";
type ProfileData = Partial<PerfilUsuario>;

const GEO_KEY = "@dular:empregador_geo_enabled";

// T-18.5: pop-up educativo dispara uma única vez por sessão quando o cadastro
// está completo mas a verificação documental ainda não está APROVADA.
// Module-level Set por userId: sobrevive a navegação; reseta com app reload.
const AUTO_VERIFY_MODAL_SHOWN_EMPREGADOR = new Set<string>();

type StatusCardCase =
  | "PODE_SOLICITAR"
  | "AGUARDANDO"
  | "VERIFICAR"
  | "REPROVADO"
  | "INCOMPLETO";

function statusCardCopy(
  kase: StatusCardCase,
): { title: string; text: string } {
  if (kase === "PODE_SOLICITAR") {
    return {
      title: "Verificado",
      text: "Você pode solicitar serviços.",
    };
  }
  if (kase === "AGUARDANDO") {
    return {
      title: "Aguardando verificação",
      text:
        "Seus documentos estão em análise. Você ainda não pode solicitar serviços.",
    };
  }
  if (kase === "REPROVADO") {
    return {
      title: "Documentos reprovados",
      text:
        "Documentos reprovados. Reenvie documentos válidos para poder solicitar serviços.",
    };
  }
  if (kase === "VERIFICAR") {
    return {
      title: "Verificação necessária",
      text:
        "Envie seus documentos para poder solicitar serviços.",
    };
  }
  return {
    title: "Perfil incompleto",
    text: "Complete os dados pendentes para preparar seu perfil.",
  };
}

function textValue(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function firstName(value?: string | null) {
  return textValue(value)?.split(/\s+/)[0] ?? "Sem nome";
}

function formatMemberSince(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function profileLocation(perfil: ProfileData | null) {
  const bairro = textValue(perfil?.bairroAtual);
  const cidade = textValue(perfil?.cidadeAtual) ?? textValue(perfil?.cidade);
  const estado = textValue(perfil?.estadoAtual) ?? textValue(perfil?.estado) ?? textValue(perfil?.uf);

  if (bairro && cidade && estado) return `${bairro}, ${cidade} - ${estado}`;
  if (cidade && estado) return `${cidade}, ${estado}`;
  if (cidade) return cidade;
  return "";
}

function normalizeVerification(perfil: ProfileData | null): VerificationStatus | null {
  const status = perfil?.verificacao?.status;
  if (status === "APROVADO" || status === "PENDENTE" || status === "REPROVADO" || status === "NAO_ENVIADO") {
    return status;
  }
  if (perfil?.verificado === true) return "APROVADO";
  return null;
}

function verificationText(status: VerificationStatus | null) {
  if (status === "APROVADO" || status === "VERIFICADO") return "Verificação aprovada";
  if (status === "PENDENTE") return "Verificação pendente";
  if (status === "REPROVADO") return "Verificação reprovada";
  return "Não verificado";
}

function roleLabel(role?: ProfileData["role"] | null) {
  if (role === "EMPREGADOR") return "Empregador";
  if (role === "DIARISTA") return "Diarista";
  if (role === "MONTADOR") return "Montador";
  if (role === "ADMIN") return "Administrador";
  return "Não informado";
}

function calculateProfileProgress(perfil: ProfileData | null, location: string) {
  const checks = [
    { label: "nome", ok: Boolean(textValue(perfil?.nome)) },
    { label: "telefone", ok: Boolean(textValue(perfil?.telefone)) },
    { label: "email", ok: Boolean(textValue(perfil?.email)) },
    { label: "CPF", ok: Boolean(textValue(perfil?.cpf)) },
    { label: "data de nascimento", ok: Boolean(textValue(perfil?.dataNascimento)) },
    { label: "localização", ok: Boolean(location) },
  ];
  const done = checks.filter((item) => item.ok).length;
  return {
    progresso: Math.round((done / checks.length) * 100),
    completo: done === checks.length,
    faltantes: checks.filter((item) => !item.ok).map((item) => item.label),
  };
}

type ProfileStyles = ReturnType<typeof makeStyles>;

function InfoLine({
  icon,
  label,
  value,
  styles,
  colors,
  isLast,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  styles: ProfileStyles;
  colors: ThemeColors;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoDivider]}>
      <View style={styles.infoIcon}>
        <AppIcon name={icon} size={18} color={colors.primary} strokeWidth={2.2} />
      </View>
      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
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
  const { requestRegion } = useCurrentRegion();
  const busyRef = useRef(false);

  const [geoEnabled, setGeoEnabled] = useState(false);
  const [geoSaving, setGeoSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editBio, setEditBio] = useState("");
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    const backendEnabled = Boolean((perfil ?? user)?.localizacaoPermitida);
    let active = true;
    AsyncStorage.getItem(GEO_KEY)
      .then((value) => {
        if (!active) return;
        if (value === "0") setGeoEnabled(false);
        else if (value === "1") setGeoEnabled(true);
        else setGeoEnabled(backendEnabled);
      })
      .catch(() => {
        if (active) setGeoEnabled(backendEnabled);
      });
    return () => {
      active = false;
    };
  }, [perfil, user]);

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

  const saveCurrentLocation = useCallback(async () => {
    if (geoSaving) return false;

    setGeoSaving(true);
    showToast("Atualizando localização...");
    try {
      const detected = await requestRegion();
      const cidade = detected?.cidade?.trim() ?? "";
      const uf = detected?.uf?.trim().toUpperCase() ?? "";
      const bairro = detected?.bairro?.trim() || null;

      if (!detected || !cidade || uf.length !== 2) {
        throw new Error("Não foi possível identificar cidade e UF.");
      }

      await salvarLocalizacaoAtual({
        latitude: detected.latitude ?? null,
        longitude: detected.longitude ?? null,
        cidade,
        estado: uf,
        bairro,
        localizacaoPermitida: true,
      });

      await AsyncStorage.setItem(GEO_KEY, "1");
      setGeoEnabled(true);
      setUser((current) =>
        current
          ? {
              ...current,
              cidade,
              estado: uf,
              uf,
              bairro,
              cidadeAtual: cidade,
              estadoAtual: uf,
              bairroAtual: bairro,
              localizacaoPermitida: true,
              localizacaoAtualizadaEm: new Date().toISOString(),
            }
          : current,
      );
      refetch();
      showToast("Localização atualizada.");
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Não foi possível atualizar a localização.");
      return false;
    } finally {
      setGeoSaving(false);
    }
  }, [geoSaving, refetch, requestRegion, setUser]);

  const handleGeoToggle = async (value: boolean) => {
    if (!value) {
      setGeoEnabled(false);
      AsyncStorage.setItem(GEO_KEY, "0").catch(() => undefined);
      return;
    }

    setGeoEnabled(true);
    AsyncStorage.setItem(GEO_KEY, "1").catch(() => undefined);
    const ok = await saveCurrentLocation();
    if (!ok) {
      setGeoEnabled(false);
      AsyncStorage.setItem(GEO_KEY, "0").catch(() => undefined);
    }
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

  const profileData = (perfil ?? user ?? null) as ProfileData | null;
  const heroLocation = profileLocation(profileData);
  const hasLocation = Boolean(heroLocation);
  const locationIsEnabled = geoEnabled || profileData?.localizacaoPermitida === true;
  const verificationStatus = normalizeVerification(profileData);
  const completion = calculateProfileProgress(profileData, heroLocation);

  // T-18.5: separar cadastro, documento e visibilidade. Empregador só pode
  // solicitar serviço se verificacao === APROVADO (== VERIFICADO no backend).
  const hasDocEnviado = Boolean(profileData?.docEnviado);
  const statusCardCase: StatusCardCase = useMemo(() => {
    if (!completion.completo) return "INCOMPLETO";
    if (verificationStatus === "APROVADO" || verificationStatus === "VERIFICADO") {
      return "PODE_SOLICITAR";
    }
    if (verificationStatus === "REPROVADO") return "REPROVADO";
    if (hasDocEnviado && verificationStatus === "PENDENTE") return "AGUARDANDO";
    return "VERIFICAR";
  }, [completion.completo, verificationStatus, hasDocEnviado]);
  const statusCopy = useMemo(() => statusCardCopy(statusCardCase), [statusCardCase]);
  const ctaLabel =
    statusCardCase === "REPROVADO"
      ? "Reenviar documentos"
      : hasDocEnviado
        ? "Ver documentos"
        : "Enviar documentos";
  const podeSolicitar = statusCardCase === "PODE_SOLICITAR";

  // Pop-up educativo: dispara uma vez por sessão quando o cadastro está
  // completo mas a verificação não está aprovada. REPROVADO tem fluxo
  // visual próprio (pílula/card), não recebe modal genérico.
  const perfilCarregado = !loading && !!profileData;
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (!perfilCarregado) return;
    if (!completion.completo) return;
    if (podeSolicitar) return;
    if (statusCardCase === "REPROVADO") return;
    if (AUTO_VERIFY_MODAL_SHOWN_EMPREGADOR.has(uid)) return;
    AUTO_VERIFY_MODAL_SHOWN_EMPREGADOR.add(uid);
    Alert.alert(
      "Verificação obrigatória",
      "Para solicitar serviços, envie seus documentos. Essa etapa ajuda a manter a segurança da plataforma.",
      [
        { text: "Depois", style: "cancel" },
        { text: "Verificar agora", onPress: () => navigation.navigate("VerificacaoDocs") },
      ],
    );
  }, [
    perfilCarregado,
    completion.completo,
    podeSolicitar,
    statusCardCase,
    user?.id,
    navigation,
  ]);
  const displayName = firstName(profileData?.nome);
  const avatarUri = avatarLocal ?? profileData?.avatarUrl ?? null;
  const avatarFallback: ImageSourcePropType | null = null;
  const memberSince = formatMemberSince(profileData?.createdAt ?? profileData?.criadoEm);
  const telefoneText = textValue(profileData?.telefone) ?? "Não informado";
  const emailText = textValue(profileData?.email) ?? "Não informado";
  const roleText = roleLabel(profileData?.role);
  const createdAtText = memberSince || "Não informado";
  const locationText = heroLocation || (locationIsEnabled ? "Localização ativada" : "Localização não informada");
  const progressLabel = completion.completo ? "Perfil completo" : "Perfil incompleto";
  const progressTone = completion.completo ? colors.success : colors.warning;
  const progressSoft = completion.completo ? colors.successSoft : colors.warningSoft;
  const missingText = completion.faltantes.length
    ? `Pendente: ${completion.faltantes.join(", ")}`
    : "Dados principais preenchidos.";
  // Hotfix T-13 (2): tela NUNCA pode ficar bloqueada por loading. Sempre
  // renderiza o conteúdo usando dados do authStore enquanto a API responde.
  // O spinner aparece apenas como decoração no topo (não-bloqueante) e o
  // banner de erro vira algo "inline" com retry, sem esconder o resto.
  const showInitialSpinner = loading && !perfil;
  const showErrorBanner = !loading && !!error && !perfil;

  const openLocationCta = () => {
    void saveCurrentLocation();
  };

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
                subtitle={roleText}
                location={locationText}
                memberSince={memberSince}
                avatarUri={avatarUri}
                avatarFallback={avatarFallback}
                uploading={avatarUploading}
                onAvatarPress={pickAvatar}
                verificacaoStatus={verificationStatus}
                hideMemberSinceIfEmpty
              />

              <ProfileSection title="Status do perfil">
                {/* T-18.5: separa "cadastro completo" da "permissão para
                    solicitar serviço". A barra reflete só o cadastro básico;
                    o texto e a CTA refletem o estado real de verificação
                    documental — que é o que destrava o POST /api/servicos. */}
                <DCard style={s.statusCard}>
                  <View style={s.statusHeader}>
                    <View
                      style={[
                        s.statusBadge,
                        {
                          backgroundColor: podeSolicitar
                            ? colors.successSoft
                            : statusCardCase === "REPROVADO"
                              ? colors.dangerSoft
                              : colors.warningSoft,
                        },
                      ]}
                    >
                      <AppIcon
                        name={
                          podeSolicitar
                            ? "CheckCircle"
                            : statusCardCase === "AGUARDANDO"
                              ? "Clock"
                              : statusCardCase === "REPROVADO"
                                ? "XCircle"
                                : "AlertTriangle"
                        }
                        size={14}
                        color={
                          podeSolicitar
                            ? colors.success
                            : statusCardCase === "REPROVADO"
                              ? colors.danger
                              : colors.warning
                        }
                        strokeWidth={2.4}
                      />
                      <Text
                        style={[
                          s.statusBadgeText,
                          {
                            color: podeSolicitar
                              ? colors.success
                              : statusCardCase === "REPROVADO"
                                ? colors.danger
                                : colors.warning,
                          },
                        ]}
                      >
                        {statusCopy.title}
                      </Text>
                    </View>
                    <Text style={s.statusProgress}>{completion.progresso}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View
                      style={[
                        s.progressFill,
                        {
                          width: `${completion.progresso}%`,
                          backgroundColor: progressTone,
                        },
                      ]}
                    />
                  </View>
                  <Text style={s.statusHint}>
                    {completion.completo ? "Cadastro básico completo." : missingText}
                  </Text>
                  <Text style={s.statusHint}>{statusCopy.text}</Text>
                  {!podeSolicitar ? (
                    <DButton
                      label={ctaLabel}
                      variant="primary"
                      size="md"
                      onPress={() => navigation.navigate("VerificacaoDocs")}
                    />
                  ) : null}
                </DCard>
              </ProfileSection>

              <ProfileSection title="Dados da conta">
                <DCard style={s.infoCard}>
                  <InfoLine icon="Phone" label="Telefone" value={telefoneText} styles={s} colors={colors} />
                  <InfoLine icon="FileText" label="Email" value={emailText} styles={s} colors={colors} />
                  <InfoLine icon="User" label="Perfil" value={roleText} styles={s} colors={colors} />
                  <InfoLine icon="Calendar" label="Criado em" value={createdAtText} styles={s} colors={colors} isLast />
                </DCard>
              </ProfileSection>

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
                  subtitle={verificationText(verificationStatus)}
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
                  title={hasLocation ? "Endereço" : locationIsEnabled ? "Atualizar localização" : "Adicionar localização"}
                  subtitle={
                    hasLocation
                      ? locationText
                      : geoSaving
                        ? "Buscando sua localização atual"
                        : locationIsEnabled
                          ? "Toque para buscar cidade e bairro atuais"
                          : "Informe sua localização para melhorar buscas"
                  }
                  onPress={hasLocation ? () => Alert.alert("Endereço", locationText) : openLocationCta}
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
                  subtitle={geoSaving ? "Atualizando localização..." : "Melhorar sugestões perto de você"}
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
  statusCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusProgress: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.lavenderStrong,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  statusHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  infoCard: {
    padding: 0,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  infoRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  infoDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
  },
  infoTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  infoValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
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
