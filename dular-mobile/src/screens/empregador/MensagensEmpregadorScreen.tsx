import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DCard, DEmptyState, DErrorState, DLoadingState } from "@/components/ui";
import { useMensagens, type ChatRoom } from "@/hooks/useMensagens";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  ConversationCard,
  ConversationItem,
  EmptyArchiveState,
  MessagesTab,
  MessagesTabs,
} from "./messages/components";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

function categoriaFromTipo(tipo?: string | null): Pick<ConversationItem, "categoria" | "categoriaIcon"> {
  const value = String(tipo ?? "").toUpperCase();
  if (value === "BABA") return { categoria: "Babá", categoriaIcon: "Baby" };
  if (value === "COZINHEIRA") return { categoria: "Cozinheira", categoriaIcon: "ChefHat" };
  if (value === "MONTADOR") return { categoria: "Montador", categoriaIcon: "Wrench" };
  return { categoria: "Diarista", categoriaIcon: "BrushCleaning" };
}

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

function roomToConversation(room: ChatRoom): ConversationItem {
  const nome = room.outroUsuario.nome || "Contato";
  const category = categoriaFromTipo(room.servico?.tipo);
  return {
    id: room.id,
    servicoId: room.servicoId,
    nome,
    ...category,
    localizacao: room.servico?.local ?? "Local do serviço",
    rating: "--",
    experiencia: room.servico?.status ? String(room.servico.status).replace(/_/g, " ") : "Serviço confirmado",
    horario: timeLabel(room),
    initials: initialsFromName(nome),
    avatarUrl: room.outroUsuario.avatarUrl ?? undefined,
  };
}

export function MensagensEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [activeTab, setActiveTab] = useState<MessagesTab>("conversas");
  const { rooms, loading, error, refetch } = useMensagens();

  const visibleConversations = useMemo(() => {
    const filtered =
      activeTab === "arquivadas"
        ? rooms.filter((r) => r.arquivada)
        : rooms.filter((r) => !r.arquivada);
    return filtered.map(roomToConversation);
  }, [activeTab, rooms]);

  const openChat = useCallback(
    (item: ConversationItem) => {
      navigation.navigate("ChatAberto", {
        roomId: item.servicoId,
        servicoId: item.servicoId,
        nomeUsuario: item.nome,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <View style={s.headerCopy}>
              <Text style={s.title}>Mensagens</Text>
              <Text style={s.subtitle}>
                Converse com os profissionais que confirmaram suas solicitações.
              </Text>
            </View>
          </View>

          <MessagesTabs activeTab={activeTab} onChange={setActiveTab} />

          <DCard style={s.infoCard}>
            <View style={s.infoIcon}>
              <AppIcon name="MessageCircle" size={30} color={colors.primary} strokeWidth={2.1} />
              <View style={s.infoCheck}>
                <AppIcon name="CheckCircle" size={16} color={colors.primary} strokeWidth={2.4} />
              </View>
            </View>
            <View style={s.infoCopy}>
              <Text style={s.infoTitle}>Profissionais que confirmaram</Text>
              <Text style={s.infoText}>Inicie uma conversa para combinar os detalhes do serviço.</Text>
            </View>
          </DCard>

          {loading ? (
            <DLoadingState text="Carregando conversas" color={colors.primary} />
          ) : error ? (
            <DErrorState message={error} onRetry={refetch} />
          ) : visibleConversations.length === 0 ? (
            activeTab === "arquivadas" ? (
              <EmptyArchiveState />
            ) : (
              <DEmptyState
                icon="MessageCircle"
                title="Nenhuma conversa ainda"
                subtitle="As conversas dos seus serviços confirmados aparecerão aqui."
                accentColor={colors.primary}
                softBg={colors.lavenderSoft}
              />
            )
          ) : (
            <View style={s.list}>
              {visibleConversations.map((item) => (
                <ConversationCard key={item.id} item={item} onPress={() => openChat(item)} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default MensagensEmpregadorScreen;

const s = StyleSheet.create({
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
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.primaryDark,
    ...typography.h1,
    
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    maxWidth: 275,
    color: colors.textSecondary,
    ...typography.bodySm,
    
    fontWeight: "500",
  },

  infoCard: {
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavenderDivider,
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
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    color: colors.primaryDark,
    ...typography.bodySmMedium,
    
    fontWeight: "700",
  },
  infoText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  list: {
    gap: 8,
  },
});
