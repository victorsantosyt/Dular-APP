import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { platformSelect } from "@/utils/platform";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { AppIcon, DAvatar } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/theme";

export type ChatAbertoParams = {
  conversaId?: string;
  nome?: string;
  avatarUrl?: string;
  online?: boolean;
  servico?: string;
  dataHora?: string;
  bairro?: string;
  status?: string;
  papel?: "cliente" | "diarista";
};

type Props = {
  route?: {
    params?: ChatAbertoParams;
  };
};

type Message = {
  id: string;
  author: "me" | "other";
  text: string;
  time: string;
};

const DEFAULT_AVATAR =
  "";

const MESSAGES: Message[] = [
  {
    id: "1",
    author: "other",
    text: "Oi, confirmo o serviço para amanhã no período da manhã.",
    time: "09:12",
  },
  {
    id: "2",
    author: "me",
    text: "Perfeito. O endereço está completo no pedido.",
    time: "09:14",
  },
  {
    id: "3",
    author: "other",
    text: "Vou levar os materiais principais. Precisa de algum cuidado especial?",
    time: "09:16",
  },
  {
    id: "4",
    author: "me",
    text: "Apenas atenção ao piso da sala. Obrigada pela confirmação.",
    time: "09:17",
  },
];

const QUICK_REPLIES = [
  "Pode confirmar",
  "Chego em 10 minutos",
  "Obrigada pelo retorno",
  "Pode me mandar detalhes?",
];

function TypingIndicator() {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.stagger(
        130,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0.35, duration: 260, useNativeDriver: true }),
          ]),
        ),
      ),
    );

    animation.start();
    return () => animation.stop();
  }, [dots]);

  return (
    <View style={styles.typingWrap}>
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.typingDot, { opacity: dot }]} />
      ))}
    </View>
  );
}

function MessageBubble({ item }: { item: Message }) {
  const mine = item.author === "me";

  return (
    <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextOther]}>
          {item.text}
        </Text>
        <Text style={[styles.messageTime, mine ? styles.messageTimeMine : styles.messageTimeOther]}>
          {item.time}
        </Text>
      </View>
    </View>
  );
}

export function ChatAbertoScreen({ route }: Props) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");
  const params = route?.params ?? {};

  const nome = params.nome ?? "Luciana Silva";
  const avatarUrl = params.avatarUrl ?? DEFAULT_AVATAR;
  const online = params.online ?? true;
  const servico = params.servico ?? "Faxina completa";
  const dataHora = params.dataHora ?? "Hoje, 14:00 - 18:00";
  const bairro = params.bairro ?? "Jardim América";
  const status = params.status ?? "Confirmado";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={platformSelect({ ios: "padding", android: undefined })}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={spacing.sm} style={styles.iconButton}>
            <AppIcon name="ArrowLeft" size={22} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>

          <DAvatar size="md" uri={avatarUrl} initials={nome.slice(0, 2)} online={online} />

          <View style={styles.headerText}>
            <Text style={styles.headerName} numberOfLines={1}>{nome}</Text>
            <Text style={styles.headerStatus}>{online ? "Online agora" : "Última atividade recente"}</Text>
          </View>

          <Pressable hitSlop={spacing.sm} style={styles.iconButton}>
            <AppIcon name="MoreHorizontal" size={22} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.serviceCard}>
          <View style={styles.serviceHeader}>
            <View style={styles.serviceIcon}>
              <AppIcon name="Sparkles" size={18} color="purple" />
            </View>
            <View style={styles.serviceTextBlock}>
              <Text style={styles.serviceTitle}>{servico}</Text>
              <Text style={styles.serviceMeta}>Resumo do serviço em andamento</Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

          <View style={styles.serviceInfoRow}>
            <View style={styles.serviceInfoItem}>
              <AppIcon name="Clock" size={14} color={colors.textSecondary} />
              <Text style={styles.serviceInfoText}>{dataHora}</Text>
            </View>
            <View style={styles.serviceInfoItem}>
              <AppIcon name="MapPin" size={14} color={colors.textSecondary} />
              <Text style={styles.serviceInfoText}>{bairro}</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={MESSAGES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.messageList}
          ListFooterComponent={
            <View style={styles.typingRow}>
              <TypingIndicator />
            </View>
          }
        />

        <View style={[styles.composerWrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplies}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK_REPLIES.map((reply) => (
              <Pressable key={reply} onPress={() => setDraft(reply)} style={styles.replyChip}>
                <Text style={styles.replyChipText}>{reply}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <Pressable hitSlop={spacing.xs} style={styles.attachButton}>
              <AppIcon name="Paperclip" size={20} color={colors.primary} strokeWidth={2.3} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Digite sua mensagem"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              multiline
            />
            <Pressable hitSlop={spacing.xs} style={styles.sendButton}>
              <AppIcon name="Send" size={19} color={colors.white} strokeWidth={2.5} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default ChatAbertoScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboard: {
    flex: 1,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerName: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  headerStatus: {
    marginTop: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.success,
  },
  serviceCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  serviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  serviceIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  serviceTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  serviceMeta: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  statusPill: {
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: colors.primary,
  },
  serviceInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  serviceInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 22,
  },
  serviceInfoText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  messageList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  messageRow: {
    marginBottom: spacing.sm,
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 8,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  bubbleTextMine: {
    color: colors.white,
  },
  bubbleTextOther: {
    color: colors.textPrimary,
  },
  messageTime: {
    marginTop: 4,
    alignSelf: "flex-end",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  messageTimeMine: {
    color: colors.whiteAlpha80,
  },
  messageTimeOther: {
    color: colors.textMuted,
  },
  typingRow: {
    alignItems: "flex-start",
    paddingTop: spacing.xs,
  },
  typingWrap: {
    height: 32,
    minWidth: 54,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    ...shadows.soft,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  composerWrap: {
    backgroundColor: colors.background,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quickReplies: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  replyChip: {
    minHeight: 34,
    borderRadius: radius.full,
    backgroundColor: colors.purpleSoft,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.14)",
  },
  replyChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 104,
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: platformSelect({ ios: 12, android: 9 }),
    paddingBottom: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 8,
  },
});
