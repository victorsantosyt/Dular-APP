import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { useFocusEffect } from "@react-navigation/native";

import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { apiMsg } from "@/utils/apiMsg";
import { AppIcon } from "@/components/ui";
import { DAvatar } from "@/components/ui/DAvatar";
import { PaperPlane3DIcon } from "@/assets/icons";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import type { ChatMessage } from "../../../../shared/types/chat";

const POLL_MS = 12000;
const STATUS_ARQUIVADOS = new Set(["CONCLUIDO", "CONFIRMADO", "FINALIZADO"]);

type ChatRoom = {
  other?: { nome?: string | null; avatarUrl?: string | null } | null;
  servico?: { local?: string | null; status?: string | null } | null;
};

export default function ChatScreen({ route, navigation }: any) {
  const servicoId = route?.params?.servicoId as string | undefined;
  const user = useAuth((s) => s.user);
  const theme = useGenderTheme("MONTADOR");
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Detecta teclado aberto pra remover paddingBottom (insets.bottom já é coberto pelo teclado)
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Mensagens em ordem cronológica (mais antiga em cima, mais recente embaixo — estilo WhatsApp)
  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [messages],
  );

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const loadInFlight = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!servicoId) {
      setError("Serviço não informado.");
      setLoading(false);
      return;
    }
    if (loadInFlight.current) return; // evita reentrância caso a API esteja lenta
    loadInFlight.current = true;
    try {
      if (!silent) setLoading(true);
      const res = await api.get(`/api/chat/${servicoId}`);
      setRoom(res.data?.room ?? null);
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setError(null);
      scrollToBottom();
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao carregar chat."));
    } finally {
      loadInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [scrollToBottom, servicoId]);

  useFocusEffect(
    useCallback(() => {
      if (!servicoId) return; // sem guard a tela ficaria pollando 404 a cada 5s
      // Poll encadeado: só agenda o próximo DEPOIS do anterior completar.
      // setInterval anterior empilhava requests em paralelo quando o backend
      // estava lento (timeout 20s + polling 5s = race condition).
      let active = true;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const scheduleNext = () => {
        if (!active) return;
        timer = setTimeout(() => {
          if (!active) return;
          load(true).finally(() => scheduleNext());
        }, POLL_MS);
      };
      load().finally(() => scheduleNext());
      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }, [load, servicoId])
  );

  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages.length, scrollToBottom]);

  const send = useCallback(async () => {
    const content = text.trim();
    if (!content || sending || !servicoId) return;
    try {
      setSending(true);
      setText("");
      const res = await api.post(`/api/chat/${servicoId}`, { content, type: "TEXT" });
      const message = res.data?.message;
      if (message?.id) {
        setMessages((cur) => [...cur, message]);
        scrollToBottom();
      } else {
        await load(true);
      }
    } catch (e: any) {
      setError(apiMsg(e, "Falha ao enviar mensagem."));
      setText(content);
    } finally {
      setSending(false);
    }
  }, [load, scrollToBottom, sending, servicoId, text]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={platformSelect({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={0}
      >
        <View style={[s.header, { backgroundColor: theme.primary }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.iconBtn}>
            <AppIcon name="ArrowLeft" size={22} color={colors.white} />
          </Pressable>
          <DAvatar
            size="md"
            uri={room?.other?.avatarUrl ?? undefined}
            initials={(room?.other?.nome ?? "Empregador").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          />
          <View style={s.headerText}>
            <Text style={s.title} numberOfLines={1}>
              {room?.other?.nome ?? "Empregador"}
            </Text>
            <View style={s.subRow}>
              <AppIcon name="UserRound" size={12} color={colors.whiteAlpha80} strokeWidth={2.3} />
              <Text style={s.subtitle} numberOfLines={1}>
                Empregador
              </Text>
            </View>
          </View>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator color={colors.green} />
          </View>
        ) : (
          <>
            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            ) : null}

            <ScrollView
              ref={scrollRef}
              style={s.flex}
              contentContainerStyle={s.messages}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={scrollToBottom}
            >
              {sortedMessages.length === 0 ? (
                <View style={s.empty}>
                  <PaperPlane3DIcon size={72} />
                  <Text style={s.emptyText}>Nenhuma mensagem ainda.</Text>
                </View>
              ) : (
                sortedMessages.map((message) => {
                  const mine = message.senderId === user?.id;
                  return (
                    <View key={message.id} style={[s.messageRow, mine ? s.messageRight : s.messageLeft]}>
                      <View style={[s.bubble, mine ? s.bubbleMine : s.bubbleOther]}>
                        {!mine ? (
                          <Text style={s.sender}>{message.sender?.nome ?? "Contato"}</Text>
                        ) : null}
                        <Text style={[s.messageText, mine && s.messageTextMine]}>{message.content}</Text>
                        <Text style={[s.time, mine && s.timeMine]}>
                          {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {STATUS_ARQUIVADOS.has(String(room?.servico?.status ?? "").toUpperCase()) ? (
              <View
                style={[
                  s.archivedBar,
                  { paddingBottom: Math.max(12, insets.bottom) },
                ]}
              >
                <AppIcon name="Archive" size={16} color={colors.sub} strokeWidth={2.2} />
                <Text style={s.archivedText}>
                  Conversa encerrada. Só leitura.
                </Text>
              </View>
            ) : (
              <View
                style={[
                  s.inputBar,
                  // Quando teclado aberto, insets.bottom já é coberto pelo próprio teclado;
                  // padding fixo de 8px evita o "espaço enorme" reportado no QA.
                  { paddingBottom: keyboardOpen ? 8 : Math.max(10, insets.bottom) },
                ]}
              >
                <View style={s.attachments}>
                  <AppIcon name="Camera" size={19} color="purple" />
                  <AppIcon name="Image" size={19} color="pink" />
                  <AppIcon name="Mic" size={19} color="blue" />
                  <AppIcon name="FileText" size={19} color="green" />
                </View>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Digite sua mensagem"
                  placeholderTextColor={colors.sub}
                  multiline
                  style={s.input}
                />
                <Pressable
                  onPress={send}
                  disabled={!text.trim() || sending}
                  style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <AppIcon name="Send" size={18} color={colors.white} />
                  )}
                </Pressable>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.card,
    ...shadow.float,
  },
  iconBtn: {
    width: 34,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, minWidth: 0, gap: 1 },
  title: { ...typography.bodyMedium, color: colors.white, fontWeight: "700" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  subtitle: { ...typography.caption, color: colors.whiteAlpha80, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorBox: {
    margin: spacing.lg,
    marginBottom: 0,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  errorText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
  messages: {
    padding: spacing.lg,
    gap: 10,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
  },
  emptyText: { ...typography.sub },
  messageRow: { flexDirection: "row" },
  messageLeft: { justifyContent: "flex-start" },
  messageRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "78%",
    borderRadius: radius.lg,
    padding: 12,
    gap: 4,
    ...shadow.card,
  },
  bubbleMine: {
    backgroundColor: colors.green,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  sender: { fontSize: 11, color: colors.sub, fontWeight: "700" },
  messageText: { color: colors.ink, fontSize: 14, fontWeight: "600", lineHeight: 19 },
  messageTextMine: { color: colors.white },
  time: { alignSelf: "flex-end", color: colors.sub, fontSize: 10, fontWeight: "700" },
  timeMine: { color: "rgba(255,255,255,0.78)" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
  },
  attachments: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    paddingBottom: 12,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 112,
    borderRadius: radius.lg,
    backgroundColor: colors.cardStrong,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    marginBottom: 1,
  },
  sendBtnDisabled: { opacity: 0.55 },
  archivedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
  },
  archivedText: {
    color: colors.sub,
    fontSize: 13,
    fontWeight: "700",
  },
});
