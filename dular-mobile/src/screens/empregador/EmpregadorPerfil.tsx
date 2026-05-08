import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { api } from "@/lib/api";
import { uploadAvatarDataUrl } from "@/api/perfilApi";
import { usePerfil } from "@/hooks/usePerfil";
import { useAuth } from "@/stores/authStore";
import { AppIcon } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { platformSelect } from "@/utils/platform";
import type { ServicoListItem, MinhasResponse } from "../../../../shared/types/servico";

type Props = { onLogout: () => void };

function statusLabel(status: string) {
  const s = status.toUpperCase();
  if (s === "FINALIZADO" || s === "CONCLUIDO") return "Finalizado";
  if (s === "ACEITO" || s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "SOLICITADO") return "Aguardando";
  if (s === "CANCELADO" || s === "RECUSADO") return "Cancelado";
  return status;
}

export default function EmpregadorPerfil({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const setUser = useAuth((s) => s.setUser);
  const busyRef = useRef(false);

  const { perfil, loading, saving, error, atualizar, refetch } = usePerfil();

  // Edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editBio, setEditBio] = useState("");

  // Avatar
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // History
  const [historico, setHistorico] = useState<ServicoListItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => setToast(msg);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // Sync edit fields when perfil loads
  useEffect(() => {
    if (perfil) {
      setEditNome(perfil.nome ?? "");
      setEditBio(perfil.bio ?? "");
    }
  }, [perfil]);

  // Fetch history
  const fetchHistorico = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.get<MinhasResponse>("/api/servicos/minhas");
      const all = res.data?.servicos ?? [];
      setHistorico(all.slice(0, 3));
    } catch {
      // ignore; history is non-critical
    } finally {
      setHistLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
      void fetchHistorico();
    }, [refetch, fetchHistorico])
  );

  // Avatar picker
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
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri || !asset.base64) return;
    setAvatarLocal(asset.uri);
    if (busyRef.current) return;
    busyRef.current = true;
    setAvatarUploading(true);
    try {
      const mime = (asset as any).mimeType ?? "image/jpeg";
      const dataUrl = `data:${mime};base64,${asset.base64}`;
      const up = await uploadAvatarDataUrl(dataUrl);
      const finalUrl = up?.user?.avatarUrl ?? dataUrl;
      setUser((u) => (u ? { ...u, avatarUrl: finalUrl } : u));
      showToast("Foto atualizada.");
    } catch {
      showToast("Falha ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
      busyRef.current = false;
    }
  };

  // Open edit modal
  const openModal = () => {
    setEditNome(perfil?.nome ?? "");
    setEditBio(perfil?.bio ?? "");
    setModalVisible(true);
  };

  // Save from modal
  const saveEdits = async () => {
    const nomeTrim = editNome.trim();
    if (!nomeTrim) {
      Alert.alert("Nome inválido", "O nome não pode ficar vazio.");
      return;
    }
    const ok = await atualizar({
      nome: nomeTrim,
      bio: editBio.trim(),
      telefone: perfil?.telefone,
    });
    if (ok) {
      setModalVisible(false);
      showToast("Dados atualizados.");
      setUser((u) =>
        u ? { ...u, nome: nomeTrim } : u
      );
    } else {
      showToast("Falha ao salvar. Tente novamente.");
    }
  };

  // Logout
  const handleLogout = () => {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try { await api.post("/api/auth/logout"); } catch {}
          onLogout();
        },
      },
    ]);
  };

  const avatarSrc = avatarLocal ?? perfil?.avatarUrl ?? null;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      {/* Toast */}
      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(32, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={s.card}>
            <Text style={s.errorTitle}>Não foi possível carregar.</Text>
            <Text style={s.errorSub}>{error}</Text>
            <DButton title="Tentar novamente" onPress={refetch} variant="outline" style={{ marginTop: 8 }} />
          </View>
        ) : (
          <>
            {/* Avatar */}
            <View style={[s.card, s.avatarSection]}>
              <Pressable onPress={pickAvatar} style={s.avatarWrap}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={s.avatarImg} />
                ) : (
                  <AppIcon name="User" size={48} color={colors.primary} />
                )}
                <View style={s.cameraBadge}>
                  {avatarUploading ? (
                    <ActivityIndicator size={10} color={colors.white} />
                  ) : (
                    <AppIcon name="Camera" size={12} color={colors.white} />
                  )}
                </View>
              </Pressable>
              <Text style={s.nomeText}>{perfil?.nome ?? "Empregador"}</Text>
              <Text style={s.emailText}>{perfil?.email ?? ""}</Text>
            </View>

            {/* Dados pessoais */}
            <View style={s.card}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>Dados pessoais</Text>
                <Pressable onPress={openModal} style={s.editBtn}>
                  <Text style={s.editBtnText}>Editar</Text>
                </Pressable>
              </View>

              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Nome</Text>
                <Text style={s.fieldValue}>{perfil?.nome ?? "—"}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Telefone</Text>
                <Text style={s.fieldValue}>{perfil?.telefone ?? "—"}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Biografia</Text>
                <Text style={[s.fieldValue, s.bioValue]} numberOfLines={3}>
                  {perfil?.bio || "Nenhuma bio cadastrada."}
                </Text>
              </View>
            </View>

            {/* Histórico */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Histórico de serviços</Text>
              {histLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : historico.length === 0 ? (
                <Text style={s.emptyText}>Nenhum serviço encontrado.</Text>
              ) : (
                historico.map((item) => (
                  <View key={item.id} style={s.historicoItem}>
                    <View style={s.historicoLeft}>
                      <Text style={s.historicoTipo}>{item.tipo}</Text>
                      <Text style={s.historicoData}>
                        {new Date(item.data).toLocaleDateString("pt-BR")}
                      </Text>
                    </View>
                    <View style={s.statusPill}>
                      <Text style={s.statusText}>{statusLabel(item.status)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Logout */}
            <Pressable onPress={handleLogout} style={s.logoutBtn}>
              <AppIcon name="LogOut" size={18} color={colors.danger} />
              <Text style={s.logoutText}>Sair da conta</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
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
                <AppIcon name="XCircle" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={s.modalLabel}>Nome completo</Text>
            <TextInput
              value={editNome}
              onChangeText={setEditNome}
              style={s.modalInput}
              placeholder="Seu nome"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={s.modalLabel}>Biografia</Text>
            <TextInput
              value={editBio}
              onChangeText={(t) => setEditBio(t.slice(0, 300))}
              style={[s.modalInput, s.modalInputMulti]}
              placeholder="Conte um pouco sobre você..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={300}
              returnKeyType="done"
            />
            <Text style={s.charCount}>{editBio.length}/300</Text>

            <DButton
              title={saving ? "Salvando..." : "Salvar"}
              onPress={saveEdits}
              loading={saving}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  center: {
    paddingVertical: 64,
    alignItems: "center",
  },
  toast: {
    position: "absolute",
    top: spacing.md,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 99,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.textPrimary,
  },
  toastText: {
    ...typography.body,
    color: colors.white,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  avatarSection: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  avatarWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  nomeText: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emailText: {
    ...typography.body,
    color: colors.textMuted,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.lavender,
  },
  editBtnText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 80,
    paddingTop: 1,
  },
  fieldValue: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "right",
  },
  bioValue: {
    textAlign: "right",
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.sm,
  },
  historicoItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historicoLeft: {
    gap: 2,
  },
  historicoTipo: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  historicoData: {
    ...typography.caption,
    color: colors.textMuted,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.lavender,
  },
  statusText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: "700",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  logoutText: {
    ...typography.body,
    color: colors.danger,
    fontWeight: "800",
  },
  errorTitle: {
    ...typography.body,
    fontWeight: "800",
    color: colors.danger,
  },
  errorSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalInputMulti: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: 2,
  },
});
