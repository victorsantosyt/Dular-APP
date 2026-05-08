import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

  const { mensagens, loading, enviar } = useChat(roomId);

  const [text, setText] = useState("");
  const [enviando, setEnviando] = useState(false);

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
        keyboardVerticalOffset={platformSelect({ ios: 90, android: 0 })}
      >
        {/* Messages area */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : mensagens.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {"Nenhuma mensagem ainda.\nDiga olá! 👋"}
            </Text>
          </View>
        ) : (
          <FlatList
            inverted
            data={mensagens}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            style={styles.list}
          />
        )}

        {/* Input bar */}
        <SafeAreaView edges={["bottom"]} style={styles.inputSafe}>
          <View
            style={[
              styles.inputBar,
              { paddingBottom: platformSelect({ ios: 0, android: 8 }) },
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
        </SafeAreaView>
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
});
