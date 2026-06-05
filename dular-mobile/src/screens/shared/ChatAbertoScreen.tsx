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
import { AppIcon } from "@/components/ui";
import { MensagemBubble } from "@/components/ui/MensagemBubble";
import { useChat } from "@/hooks/useChat";
import type { Mensagem } from "@/hooks/useChat";
import { useAuth } from "@/stores/authStore";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { platformSelect, shadow } from "@/utils/platform";

export type ChatAbertoParams = {
  roomId: string;
  servicoId: string;
  nomeUsuario: string;
};

type Props = {
  route: { params: ChatAbertoParams };
};

export function ChatAbertoScreen({ route }: Props) {
  const navigation = useNavigation();
  const { roomId, nomeUsuario } = route.params;
  const userId = useAuth((state) => state.user?.id) ?? "";
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Mensagem>>(null);

  const { mensagens, servicoStatus, loading, error, enviar, refetch } = useChat(roomId);
  // Status terminais → sala arquivada (somente leitura).
  const arquivada = servicoStatus
    ? ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"].includes(servicoStatus.toUpperCase())
    : false;

  const [text, setText] = useState("");
  const [enviando, setEnviando] = useState(false);
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

  const renderItem = useCallback(
    ({ item }: { item: Mensagem }) => (
      <MensagemBubble mensagem={item} isOwn={item.autorId === userId} />
    ),
    [userId]
  );

  const canSend = text.trim().length > 0 && !enviando;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header — outside KAV so it stays fixed */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <AppIcon name="ArrowLeft" size={22} color={colors.white} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {nomeUsuario}
        </Text>
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
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
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
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    ...typography.h3,
    color: colors.white,
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
