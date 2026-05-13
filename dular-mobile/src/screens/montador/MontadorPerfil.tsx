/**
 * MontadorPerfil — Tela de perfil do montador.
 *
 * - Layout espelha DiaristaPerfil/EmpregadorPerfil (ProfileHeroCard, ProfileSection,
 *   ProfileRow, ProfileSwitchRow), com identidade teal do Montador.
 * - Nasce com dark mode integrado via useDularColors() — nenhum import direto de
 *   `colors` do theme. StyleSheet criado dentro do componente para reagir ao tema.
 * - Edição de nome/telefone/bio e seleção de especialidades vivem em modais; salvar
 *   apenas fecha o modal (integração de API é tarefa separada).
 */
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppIcon, DButton, DCard } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { useThemeStore } from "@/stores/useThemeStore";
import { useAuth } from "@/stores/authStore";
import { radius, shadows, spacing, typography } from "@/theme";
import { platformSelect } from "@/utils/platform";
import type { MontadorStackParamList } from "@/navigation/MontadorNavigator";
import {
  ProfileHeroCard,
  ProfileRow,
  ProfileSection,
  ProfileSwitchRow,
} from "../empregador/profile/components";

type Navigation = NativeStackNavigationProp<MontadorStackParamList>;

const MONTADOR_ESPECIALIDADES = [
  "Montagem de Móveis",
  "Desmontagem de Móveis",
  "Pequenos Reparos",
  "Instalação Elétrica",
  "Instalação Hidráulica",
  "Pintura",
  "Gesso / Drywall",
  "Carpintaria",
  "Fixação de Quadros e Suportes",
  "Instalação de Ar-Condicionado",
] as const;

function firstName(value?: string | null) {
  return (value || "").trim().split(/\s+/)[0] || "Montador";
}

export default function MontadorPerfil() {
  const navigation = useNavigation<Navigation>();
  const colors = useDularColors();
  const mode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const user = useAuth((state) => state.user);
  const clearSession = useAuth((state) => state.clearSession);

  // ── State local — sem persistência (integração API é tarefa separada) ────
  const [editVisible, setEditVisible] = useState(false);
  const [especialidadesVisible, setEspecialidadesVisible] = useState(false);
  const [editNome, setEditNome] = useState(user?.nome ?? "");
  const [editTelefone, setEditTelefone] = useState(user?.telefone ?? "");
  const [editBio, setEditBio] = useState(user?.bio ?? "");
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  const displayName = useMemo(() => firstName(user?.nome), [user]);
  const avatarUri = user?.avatarUrl ?? null;

  const openEdit = () => {
    setEditNome(user?.nome ?? "");
    setEditTelefone(user?.telefone ?? "");
    setEditBio(user?.bio ?? "");
    setEditVisible(true);
  };

  const closeEdit = () => setEditVisible(false);

  const toggleEspecialidade = (item: string) => {
    setEspecialidades((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Encerrar sessão da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          void clearSession();
        },
      },
    ]);
  };

  const handleAvatarPress = () => {
    Alert.alert("Foto de perfil", "Edição de foto disponível em breve.");
  };

  // ── Styles dinâmicos (recriados a cada render para reagir ao tema) ───────
  const styles = StyleSheet.create({
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
      flexDirection: "row",
      alignItems: "center",
    },
    headerSideRight: {
      width: 48,
      alignItems: "flex-end",
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 29,
      fontWeight: "700",
      letterSpacing: 0,
      textAlign: "center",
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
    bioCardInner: {
      padding: 14,
    },

    // Logout card (variante danger)
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

    // Modal de edição (slide-up sheet)
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

    // Trigger "Minhas especialidades" dentro do modal de edição
    especTrigger: {
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
    especTriggerLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    especTriggerIcon: {
      width: 36,
      height: 36,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.tealSoft,
    },
    especTriggerTitle: {
      color: colors.textPrimary,
      ...typography.bodySm,
      fontWeight: "700",
    },
    especTriggerSub: {
      color: colors.textSecondary,
      ...typography.caption,
      fontWeight: "500",
      marginTop: 2,
    },

    // Card flutuante de especialidades
    especOverlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.overlay,
    },
    especCard: {
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
    especScroll: {
      paddingVertical: spacing.sm,
      gap: 12,
    },
    especHeading: {
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
      backgroundColor: colors.tealSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipOn: {
      backgroundColor: colors.teal,
      borderColor: colors.teal,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    chipTextOn: {
      color: colors.white,
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              {navigation.canGoBack() ? (
                <Pressable
                  onPress={() => navigation.goBack()}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Voltar"
                  style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.72 }]}
                >
                  <AppIcon name="ArrowLeft" size={20} color={colors.teal} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.title}>Perfil</Text>
            <View style={styles.headerSideRight} />
          </View>

          <ProfileHeroCard
            nome={displayName}
            subtitle="Montador"
            location="Cidade não informada"
            memberSince="—"
            avatarUri={avatarUri}
            avatarFallback={null}
            uploading={false}
            onAvatarPress={handleAvatarPress}
          />

          {/* ── Bio ── */}
          <ProfileSection title="Sobre você">
            <View style={styles.bioCardInner}>
              {editBio || user?.bio ? (
                <Text style={styles.bioText}>{editBio || user?.bio}</Text>
              ) : (
                <Text style={styles.bioPlaceholder}>
                  Nenhuma apresentação. Conte sobre seu trabalho no botão abaixo.
                </Text>
              )}
            </View>
          </ProfileSection>

          {/* ── Meu perfil ── */}
          <ProfileSection title="Meu perfil">
            <ProfileRow
              icon="User"
              title="Nome, telefone, bio"
              subtitle="Edite suas informações pessoais"
              onPress={openEdit}
            />
            <ProfileRow
              icon="Wrench"
              title="Minhas especialidades"
              subtitle={
                especialidades.length > 0
                  ? `${especialidades.length} selecionada(s)`
                  : "Selecione os serviços que você faz"
              }
              onPress={() => setEspecialidadesVisible(true)}
              isLast
            />
          </ProfileSection>

          {/* ── Conta ── */}
          <ProfileSection title="Conta">
            <ProfileRow
              icon="Lock"
              title="Alterar senha"
              subtitle="Segurança da conta"
              onPress={() => Alert.alert("Em breve", "Alteração de senha será conectada em breve.")}
            />
            <ProfileRow
              icon="FileText"
              title="Termos de uso"
              subtitle="Leia as regras da plataforma"
              onPress={() => Alert.alert("Em breve", "Termos disponíveis em breve.")}
            />
            <ProfileRow
              icon="Shield"
              title="Política de privacidade"
              subtitle="Controle seus dados"
              onPress={() => Alert.alert("Em breve", "Política disponível em breve.")}
            />
            <ProfileSwitchRow
              icon="Sparkles"
              title="Dark mode"
              subtitle="Tema escuro do app"
              value={mode === "dark"}
              onValueChange={toggleTheme}
              isLast
            />
          </ProfileSection>

          {/* ── Suporte ── */}
          <ProfileSection title="Suporte">
            <ProfileRow
              icon="AlertTriangle"
              title="Reportar problema"
              subtitle="Fale com a equipe"
              danger
              onPress={() => Alert.alert("Em breve", "Reporte de problema será conectado em breve.")}
              isLast
            />
          </ProfileSection>

          {/* ── Logout ── */}
          <DCard style={styles.logoutCard} onPress={handleLogout}>
            <View style={styles.logoutIcon}>
              <AppIcon name="LogOut" size={21} color={colors.danger} strokeWidth={2.3} />
            </View>
            <View style={styles.logoutTextWrap}>
              <Text style={styles.logoutTitle}>Sair</Text>
              <Text style={styles.logoutSubtitle}>Encerrar sessão da conta</Text>
            </View>
            <AppIcon name="ChevronRight" size={18} color={colors.danger} strokeWidth={2.2} />
          </DCard>
        </ScrollView>
      </View>

      {/* ── Modal de edição (nome/telefone/bio + atalho especialidades) ── */}
      <Modal
        visible={editVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEdit}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={platformSelect({ ios: "padding", android: "height" })}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar perfil</Text>
              <Pressable onPress={closeEdit} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalLabel}>Nome</Text>
            <TextInput
              value={editNome}
              onChangeText={setEditNome}
              placeholder="Seu nome"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              autoCapitalize="words"
            />

            <Text style={styles.modalLabel}>Telefone</Text>
            <TextInput
              value={editTelefone}
              onChangeText={setEditTelefone}
              placeholder="Telefone"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              keyboardType="phone-pad"
            />

            <Text style={styles.modalLabel}>Bio / Apresentação</Text>
            <TextInput
              value={editBio}
              onChangeText={(value) => setEditBio(value.slice(0, 300))}
              placeholder="Conte sobre seu trabalho"
              placeholderTextColor={colors.textMuted}
              style={[styles.modalInput, styles.modalInputMulti]}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{editBio.length}/300</Text>

            <Text style={styles.modalLabel}>Serviços</Text>
            <Pressable
              onPress={() => setEspecialidadesVisible(true)}
              style={({ pressed }) => [styles.especTrigger, pressed && { opacity: 0.78 }]}
            >
              <View style={styles.especTriggerLeft}>
                <View style={styles.especTriggerIcon}>
                  <AppIcon name="Wrench" size={18} color={colors.teal} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.especTriggerTitle}>Minhas especialidades</Text>
                  <Text style={styles.especTriggerSub}>
                    {especialidades.length > 0
                      ? `${especialidades.length} selecionada(s)`
                      : "Selecione os serviços que você faz"}
                  </Text>
                </View>
              </View>
              <AppIcon name="ChevronRight" size={18} color={colors.textMuted} strokeWidth={2.2} />
            </Pressable>

            <DButton
              label="Salvar alterações"
              variant="primary"
              size="lg"
              onPress={closeEdit}
              style={styles.saveButton}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal flutuante de especialidades (chips) ── */}
      <Modal
        visible={especialidadesVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setEspecialidadesVisible(false)}
      >
        <View style={styles.especOverlay}>
          <View style={styles.especCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Minhas especialidades</Text>
              <Pressable onPress={() => setEspecialidadesVisible(false)} hitSlop={12}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.especScroll}>
              <Text style={styles.especHeading}>Selecione todos os serviços que você faz</Text>
              <View style={styles.chips}>
                {MONTADOR_ESPECIALIDADES.map((item) => {
                  const active = especialidades.includes(item);
                  return (
                    <Pressable
                      key={item}
                      onPress={() => toggleEspecialidade(item)}
                      style={[styles.chip, active && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextOn]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <DButton
              label="Salvar especialidades"
              variant="primary"
              size="lg"
              onPress={() => setEspecialidadesVisible(false)}
              style={styles.saveButton}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
