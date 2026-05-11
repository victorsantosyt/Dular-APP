import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { uploadAvatarDataUrl } from "@/api/perfilApi";
import { usePerfil } from "@/hooks/usePerfil";
import { useAuth } from "@/stores/authStore";
import { AppIcon } from "@/components/ui";
import { DButton } from "@/components/DButton";
import { DInput } from "@/components/DInput";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { platformSelect } from "@/utils/platform";

export default function EditProfile({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const setUser = useAuth((s) => s.setUser);
  const busyRef = useRef(false);

  const { perfil, loading, saving, error, atualizar, refetch } = usePerfil();

  const [nome, setNome] = useState("");
  const [bio, setBio] = useState("");
  const [telefone, setTelefone] = useState("");
  const [avatarLocal, setAvatarLocal] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const syncFromPerfil = useCallback(() => {
    if (perfil) {
      setNome(perfil.nome ?? "");
      setBio(perfil.bio ?? "");
      setTelefone(perfil.telefone ?? "");
    }
  }, [perfil]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Sync fields whenever perfil data arrives/changes
  useFocusEffect(syncFromPerfil);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão negada", "Não foi possível acessar a galeria de fotos.");
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
    } catch {
      Alert.alert("Erro", "Falha ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
      busyRef.current = false;
    }
  };

  const save = async () => {
    const nomeTrim = nome.trim();
    if (!nomeTrim) {
      Alert.alert("Nome inválido", "O nome não pode ficar vazio.");
      return;
    }
    const ok = await atualizar({
      nome: nomeTrim,
      bio: bio.trim(),
      telefone: telefone.trim() || perfil?.telefone,
    });
    if (ok) {
      setUser((u) => (u ? { ...u, nome: nomeTrim } : u));
      Alert.alert("Sucesso", "Dados atualizados.");
      navigation.goBack();
    } else {
      Alert.alert("Erro", "Falha ao salvar dados. Tente novamente.");
    }
  };

  const avatarSrc = avatarLocal ?? perfil?.avatarUrl ?? null;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={platformSelect({ ios: "padding", android: "height" })}
        keyboardVerticalOffset={platformSelect({ ios: 90, android: 0 })}
      >
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: Math.max(32, insets.bottom + 24) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Text style={s.screenTitle}>Editar dados</Text>

          {loading ? (
            <View style={s.center}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : error ? (
            <View style={s.card}>
              <Text style={s.errorTitle}>Não foi possível carregar.</Text>
              <Text style={s.errorSub}>{error}</Text>
              <DButton title="Tentar novamente" onPress={refetch} variant="outline" style={{ marginTop: spacing.sm }} />
            </View>
          ) : (
            <View style={s.card}>
              {/* Avatar */}
              <View style={s.avatarRow}>
                <Pressable onPress={pickAvatar} style={s.avatarWrap}>
                  {avatarSrc ? (
                    <Image source={{ uri: avatarSrc }} style={s.avatarImg} />
                  ) : (
                    <AppIcon name="User" size={40} color={colors.primary} />
                  )}
                  <View style={s.cameraBadge}>
                    {avatarUploading ? (
                      <ActivityIndicator size={10} color={colors.white} />
                    ) : (
                      <AppIcon name="Camera" size={12} color={colors.white} />
                    )}
                  </View>
                </Pressable>
                <View style={s.avatarHint}>
                  <Text style={s.avatarHintTitle}>Foto de perfil</Text>
                  <Text style={s.avatarHintSub}>Toque para alterar</Text>
                </View>
              </View>

              {/* Fields */}
              <DInput
                label="Nome completo"
                value={nome}
                onChangeText={setNome}
                placeholder="Seu nome"
                autoCapitalize="words"
                returnKeyType="next"
              />

              <DInput
                label="Telefone"
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
                placeholder="Seu telefone"
                editable={false}
                hint="O telefone não pode ser alterado aqui."
              />

              <View>
                <DInput
                  label="Biografia"
                  value={bio}
                  onChangeText={(t) => setBio(t.slice(0, 300))}
                  placeholder="Conte sobre sua experiência como diarista..."
                  multiline
                  style={{ minHeight: 100 }}
                  returnKeyType="done"
                />
                <Text style={s.charCount}>{bio.length}/300</Text>
              </View>

              <DButton
                title={saving ? "Salvando..." : "Salvar dados"}
                onPress={save}
                loading={saving}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  screenTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  center: {
    paddingVertical: 64,
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarHint: {
    gap: 2,
  },
  avatarHintTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  avatarHintSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: 2,
  },
  errorTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.danger,
  },
  errorSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
