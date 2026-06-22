import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { AppIcon, type AppIconName } from "@/components/ui";
import { DAvatar } from "@/components/ui/DAvatar";
import { MensagemBubble } from "@/components/ui/MensagemBubble";
import { useChat } from "@/hooks/useChat";
import type { Mensagem } from "@/hooks/useChat";
import { useAuth } from "@/stores/authStore";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { requestLocationWithAddress } from "@/lib/location";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { platformSelect, shadow } from "@/utils/platform";

export type ChatAbertoParams = {
  roomId: string;
  servicoId: string;
  nomeUsuario: string;
  /** Categoria do serviço (mostrada para o empregador). Opcional. */
  categoria?: string;
  categoriaIcon?: AppIconName;
  /** Avatar do outro usuário. Opcional. */
  avatarUrl?: string;
};

type Props = {
  route: { params: ChatAbertoParams };
};

export function ChatAbertoScreen({ route }: Props) {
  const navigation = useNavigation();
  const { roomId, nomeUsuario, categoria, categoriaIcon, avatarUrl } = route.params;
  const userId = useAuth((state) => state.user?.id) ?? "";
  const role = useAuth((state) => state.user?.role);
  const theme = useGenderTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Mensagem>>(null);

  // O empregador vê a categoria do profissional; o profissional vê "Empregador".
  const isEmpregador = role === "EMPREGADOR";
  const subtituloCategoria = isEmpregador ? categoria ?? "Profissional" : "Empregador";
  const subtituloIcon: AppIconName = isEmpregador ? categoriaIcon ?? "BrushCleaning" : "UserRound";
  const initials = nomeUsuario.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const { mensagens, servicoStatus, loading, error, enviar, enviarMidia, refetch } = useChat(roomId);
  // Status terminais → sala arquivada (somente leitura).
  const arquivada = servicoStatus
    ? ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"].includes(servicoStatus.toUpperCase())
    : false;

  const [text, setText] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [anexando, setAnexando] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detecta teclado aberto pra remover paddingBottom redundante (insets.bottom
  // já é coberto pelo próprio teclado — sem isso, gera "espaço enorme" entre
  // o input e o teclado).
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Mensagens em ordem cronológica (mais antiga em cima, recente embaixo — padrão WhatsApp).
  // Backend devolve por `criadaEm ASC` mas a FlatList anterior usava `inverted`,
  // o que mostrava a mensagem mais antiga embaixo. Removemos `inverted` e
  // garantimos o sort no client para tolerar reordenações otimistas.
  const sortedMensagens = useMemo(
    () =>
      [...mensagens].sort(
        (a, b) => new Date(a.criadaEm).getTime() - new Date(b.criadaEm).getTime(),
      ),
    [mensagens],
  );

  // Sem `inverted`, novas mensagens não rolam sozinhas. Scrolla pro fim quando
  // o número de mensagens muda.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [sortedMensagens.length]);

  const handleEnviar = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || enviando) return;
    setText("");
    setEnviando(true);
    try {
      await enviar(trimmed);
    } catch {
      // Error is already reflected in the message's status field
    } finally {
      setEnviando(false);
    }
  }, [text, enviando, enviar]);

  const enviarFoto = useCallback(async () => {
    if (anexando) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) return;
    setAnexando(true);
    try {
      const mime = (asset as { mimeType?: string }).mimeType ?? "image/jpeg";
      await enviarMidia("IMAGE", `data:${mime};base64,${asset.base64}`);
    } finally {
      setAnexando(false);
    }
  }, [anexando, enviarMidia]);

  const enviarLocalizacao = useCallback(async () => {
    if (anexando) return;
    setAnexando(true);
    try {
      const { coords } = await requestLocationWithAddress();
      if (coords?.latitude != null && coords?.longitude != null) {
        await enviarMidia("LOCATION", JSON.stringify({ lat: coords.latitude, lng: coords.longitude }));
      }
    } catch {
      /* permissão negada / localização indisponível */
    } finally {
      setAnexando(false);
    }
  }, [anexando, enviarMidia]);

  const renderItem = useCallback(
    ({ item }: { item: Mensagem }) => (
      <MensagemBubble mensagem={item} isOwn={item.autorId === userId} accent={theme.primary} />
    ),
    [userId, theme.primary]
  );

  const canSend = text.trim().length > 0 && !enviando;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.primary }]} edges={["top", "left", "right"]}>
      {/* Header — outside KAV so it stays fixed. Estilo WhatsApp: foto + nome + categoria. */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <AppIcon name="ArrowLeft" size={22} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <DAvatar size="md" uri={avatarUrl} initials={initials} />
        <View style={styles.headerTextCol}>
          <Text style={styles.headerName} numberOfLines={1}>
            {nomeUsuario}
          </Text>
          <View style={styles.headerSubRow}>
            <AppIcon name={subtituloIcon} size={12} color={colors.whiteAlpha80} strokeWidth={2.3} />
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {subtituloCategoria}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={platformSelect({ ios: "padding", android: "height" })}
        keyboardVerticalOffset={0}
      >
        {/* Messages area */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error && sortedMensagens.length === 0 ? (
          <View style={styles.center}>
            <AppIcon name="AlertTriangle" size={30} color={colors.danger} variant="soft" />
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              onPress={refetch}
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : sortedMensagens.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {"Nenhuma mensagem ainda.\nDiga olá! 👋"}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={sortedMensagens}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {arquivada ? (
          // Sala arquivada (serviço CONCLUIDO/CONFIRMADO/FINALIZADO): só leitura.
          <View
            style={[
              styles.archivedBar,
              { paddingBottom: Math.max(12, insets.bottom) },
            ]}
          >
            <AppIcon name="Archive" size={16} color={colors.textMuted} strokeWidth={2.2} />
            <Text style={styles.archivedText}>Conversa encerrada. Só leitura.</Text>
          </View>
        ) : (
          /* Input bar — paddingBottom dinâmico evita gap excessivo com teclado aberto */
          <View
            style={[
              styles.inputBar,
              { paddingBottom: keyboardOpen ? 8 : Math.max(8, insets.bottom) },
            ]}
          >
            <Pressable onPress={enviarLocalizacao} disabled={anexando} hitSlop={8} style={styles.attachBtn}>
              <AppIcon name="MapPin" size={22} color={theme.primary} strokeWidth={2.2} />
            </Pressable>
            <Pressable onPress={enviarFoto} disabled={anexando} hitSlop={8} style={styles.attachBtn}>
              <AppIcon name="Image" size={22} color={theme.primary} strokeWidth={2.2} />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Digite uma mensagem..."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline={false}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleEnviar}
            />
            <Pressable
              onPress={handleEnviar}
              disabled={!canSend}
              style={[styles.sendBtn, { backgroundColor: theme.primary }, !canSend && styles.sendBtnDisabled]}
            >
              <AppIcon name="Send" size={19} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default ChatAbertoScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.primary,
  },
  backBtn: {
    width: 36,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  headerName: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: "700",
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.whiteAlpha80,
    fontWeight: "600",
  },
  attachBtn: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  kav: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.4,
    borderColor: colors.primary,
  },
  retryText: {
    ...typography.bodySmMedium,
    color: colors.primary,
    fontWeight: "700",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  separator: {
    height: 4,
  },
  inputSafe: {
    backgroundColor: colors.surface,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    ...shadow(4),
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  archivedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  archivedText: {
    ...typography.body,
    color: colors.textMuted,
    fontWeight: "700",
  },
});
