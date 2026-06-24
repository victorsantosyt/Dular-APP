import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon, DCard, DEmptyState, DErrorState, DLoadingState } from "@/components/ui";
import { useAuth } from "@/stores/authStore";
import { useMensagens, type ChatRoom } from "@/hooks/useMensagens";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  ConversationCard,
  ConversationItem,
  EmptyArchiveState,
  MessagesTab,
  MessagesTabs,
} from "../empregador/messages/components";

/**
 * MensagensView — corpo compartilhado da tela de Mensagens (mesma do empregador),
 * parametrizado por tema (identidade de gênero) e navegação. Usado por
 * empregador, montador e diarista para ficarem exatamente iguais.
 */

function initialsFromName(nome: string) {
  return nome
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeLabel(room: ChatRoom) {
  const value = room.ultimaMensagem?.criadaEm ?? room.atualizadaEm;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Prévia da última mensagem no card (estilo WhatsApp):
 *  - LOCATION: "📍 Localização"
 *  - SYSTEM:   conteúdo direto (anúncios de status)
 *  - TEXT/IMAGE: conteúdo (prefixado com "Você: " quando foi minha)
 *  - Sem mensagens: string vazia (o card mostra fallback "Toque para conversar")
 */
function previewLastMessage(room: ChatRoom, myId: string): string {
  const u = room.ultimaMensagem;
  if (!u || !u.texto) return "";
  if (u.type === "LOCATION") return "📍 Localização";
  if (u.type === "SYSTEM") return u.texto;
  const prefix = u.senderId && u.senderId === myId ? "Você: " : "";
  return prefix + u.texto;
}

function roomToConversation(room: ChatRoom, myId: string): ConversationItem {
  const nome = room.outroUsuario.nome || "Contato";
  // MensagensView é usada por diarista e montador — o outro lado é sempre o
  // empregador, então a categoria exibida no card é "Empregador".
  return {
    id: room.id,
    servicoId: room.servicoId,
    nome,
    categoria: "Empregador",
    categoriaIcon: "UserRound",
    localizacao: room.servico?.local ?? "Local do serviço",
    rating: "--",
    experiencia: room.servico?.status ? String(room.servico.status).replace(/_/g, " ") : "Serviço confirmado",
    horario: timeLabel(room),
    initials: initialsFromName(nome),
    avatarUrl: room.outroUsuario.avatarUrl ?? undefined,
    lastMessage: previewLastMessage(room, myId),
    unread: room.naoLidas,
  };
}

type Props = {
  theme: ProfileTheme;
  infoTitle: string;
  infoText: string;
  onOpenChat: (item: ConversationItem) => void;
};

export function MensagensView({ theme, infoTitle, infoText, onOpenChat }: Props) {
  const [activeTab, setActiveTab] = useState<MessagesTab>("conversas");
  const { rooms, loading, error, refetch } = useMensagens();
  const myId = useAuth((state) => state.user?.id) ?? "";

  const visibleConversations = useMemo(() => {
    const filtered =
      activeTab === "arquivadas" ? rooms.filter((r) => r.arquivada) : rooms.filter((r) => !r.arquivada);
    return filtered.map((r) => roomToConversation(r, myId));
  }, [activeTab, rooms, myId]);

  const handleOpen = useCallback((item: ConversationItem) => onOpenChat(item), [onOpenChat]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <Text style={s.title}>Mensagens</Text>
          </View>

          <MessagesTabs activeTab={activeTab} onChange={setActiveTab} accent={theme.primary} border={theme.border} />

          <DCard style={[s.infoCard, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}>
            <View style={s.infoIcon}>
              <AppIcon name="MessageCircle" size={30} color={theme.primary} strokeWidth={2.1} />
              <View style={s.infoCheck}>
                <AppIcon name="CheckCircle" size={16} color={theme.primary} strokeWidth={2.4} />
              </View>
            </View>
            <View style={s.infoCopy}>
              <Text style={[s.infoTitle, { color: theme.textAccent }]}>{infoTitle}</Text>
              <Text style={s.infoText}>{infoText}</Text>
            </View>
          </DCard>

          {loading ? (
            <DLoadingState text="Carregando conversas" color={theme.primary} />
          ) : error ? (
            <DErrorState message={error} onRetry={refetch} />
          ) : visibleConversations.length === 0 ? (
            activeTab === "arquivadas" ? (
              <EmptyArchiveState accent={theme.primary} soft={theme.primarySoft} border={theme.border} />
            ) : (
              <DEmptyState
                icon="MessageCircle"
                title="Nenhuma conversa ainda"
                subtitle="As conversas dos seus serviços aparecerão aqui."
                accentColor={theme.primary}
                softBg={theme.primarySoft}
              />
            )
          ) : (
            <View style={s.list}>
              {visibleConversations.map((item) => (
                <ConversationCard
                  key={item.id}
                  item={item}
                  accent={theme.primary}
                  soft={theme.primarySoft}
                  onPress={() => handleOpen(item)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default MensagensView;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 122,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    ...typography.h1,
    fontWeight: "700",
    letterSpacing: 0,
  },
  infoCard: {
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadows.soft,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  infoCheck: {
    position: "absolute",
    right: 4,
    bottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: { flex: 1, gap: 4 },
  infoTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  infoText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  list: { gap: 8 },
});
