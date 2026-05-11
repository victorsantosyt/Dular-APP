import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { apiMsg } from "@/utils/apiMsg";
import { AppIcon } from "@/components/ui";
import { PaperPlane3DIcon } from "@/assets/icons";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import type { ChatMessage } from "../../../../shared/types/chat";

const POLL_MS = 5000;

type ChatRoom = {
  other?: { nome?: string | null } | null;
  servico?: { local?: string | null; status?: string | null } | null;
};

export default function ChatScreen({ route, navigation }: any) {
  const servicoId = route?.params?.servicoId as string | undefined;
  const user = useAuth((s) => s.user);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!servicoId) {
      setError("Serviço não informado.");
      setLoading(false);
      return;
    }
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
      if (!silent) setLoading(false);
    }
  }, [scrollToBottom, servicoId]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(() => load(true), POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

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
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={platformSelect({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={insets.top}
      >
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.iconBtn}>
            <AppIcon name="ArrowLeft" size={22} color={colors.ink} />
          </Pressable>
          <View style={s.headerText}>
            <Text style={s.title}>Chat</Text>
            <Text style={s.subtitle} numberOfLines={1}>
              {room?.other?.nome ?? "Atendimento"} {room?.servico?.local ? `• ${room.servico.local}` : ""}
            </Text>
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
              {messages.length === 0 ? (
                <View style={s.empty}>
                  <PaperPlane3DIcon size={72} />
                  <Text style={s.emptyText}>Nenhuma mensagem ainda.</Text>
                </View>
              ) : (
                messages.map((message) => {
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

            <View style={[s.inputBar, { paddingBottom: Math.max(10, insets.bottom) }]}>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.stroke,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardStrong,
  },
  headerText: { flex: 1 },
  title: { ...typography.h3 },
  subtitle: { ...typography.sub, marginTop: 1 },
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
});
