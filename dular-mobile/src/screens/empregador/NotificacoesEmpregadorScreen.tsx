import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DLoadingState } from "@/components/ui";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import type { Notificacao } from "@/api/notificacoesApi";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import {
  NotificationCard,
  NotificationItem,
  NotificationSection,
  NotificationTab,
  NotificationTabs,
  NotificationTone,
} from "./notifications/components";
import type { AppIconName } from "@/components/ui";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

type TypeMeta = {
  icon: AppIconName;
  tone: NotificationTone;
  filter: "importantes" | "sistema";
  typeLabel: string;
  badge?: string;
};

const TYPE_META: Record<string, TypeMeta> = {
  SERVICO_SOLICITADO: { icon: "BriefcaseBusiness", tone: "analysis", filter: "importantes", typeLabel: "Solicitação" },
  SERVICO_ACEITO: { icon: "CheckCircle", tone: "success", filter: "importantes", typeLabel: "Solicitação", badge: "Aceito" },
  SERVICO_RECUSADO: { icon: "XCircle", tone: "urgent", filter: "importantes", typeLabel: "Solicitação", badge: "Recusado" },
  SERVICO_INICIADO: { icon: "Clock", tone: "analysis", filter: "importantes", typeLabel: "Serviço", badge: "Em andamento" },
  SERVICO_FINALIZADO: { icon: "CheckCircle", tone: "success", filter: "importantes", typeLabel: "Serviço", badge: "Concluído" },
  SERVICO_CANCELADO: { icon: "XCircle", tone: "urgent", filter: "importantes", typeLabel: "Serviço", badge: "Cancelado" },
  MENSAGEM_RECEBIDA: { icon: "MessageCircle", tone: "analysis", filter: "importantes", typeLabel: "Mensagem" },
  AVALIACAO_RECEBIDA: { icon: "Star", tone: "success", filter: "importantes", typeLabel: "Avaliação" },
  ALERTA_SEGURANCA: { icon: "AlertTriangle", tone: "urgent", filter: "importantes", typeLabel: "Segurança", badge: "Urgente" },
  SISTEMA: { icon: "Sparkles", tone: "system", filter: "sistema", typeLabel: "Sistema" },
  NOVIDADE: { icon: "Megaphone", tone: "news", filter: "sistema", typeLabel: "Novidades" },
};

const DEFAULT_META: TypeMeta = {
  icon: "Bell",
  tone: "system",
  filter: "sistema",
  typeLabel: "Aviso",
};

function metaFor(type: string): TypeMeta {
  return TYPE_META[type] ?? DEFAULT_META;
}

function tempoRelativo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 2) return "Ontem";
  return `${days} dias`;
}

function sectionOf(iso: string): "Hoje" | "Ontem" | "Anteriores" {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Anteriores";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return "Hoje";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === y.getFullYear() &&
    date.getMonth() === y.getMonth() &&
    date.getDate() === y.getDate();
  if (isYesterday) return "Ontem";
  return "Anteriores";
}

function toNotificationItem(n: Notificacao): NotificationItem & { _raw: Notificacao } {
  const meta = metaFor(n.type);
  const section = sectionOf(n.createdAt);
  return {
    id: n.id,
    section: section === "Anteriores" ? "Ontem" : section,
    filter: meta.filter,
    type: meta.typeLabel,
    title: n.title,
    text: n.body,
    time: tempoRelativo(n.createdAt),
    icon: meta.icon,
    tone: meta.tone,
    badge: meta.badge,
    unread: !n.readAt,
    _raw: n,
  };
}

export function NotificacoesEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [activeTab, setActiveTab] = useState<NotificationTab>("todas");
  const {
    notificacoes,
    loading,
    unreadCount,
    refetch,
    marcarComoLida,
    marcarTodasComoLidas,
  } = useNotificacoes();

  const items = useMemo(() => notificacoes.map(toNotificationItem), [notificacoes]);

  const filtered = useMemo(() => {
    if (activeTab === "todas") return items;
    return items.filter((item) => item.filter === activeTab);
  }, [activeTab, items]);

  const grouped = useMemo(
    () => ({
      Hoje: filtered.filter((item) => item.section === "Hoje"),
      Ontem: filtered.filter((item) => item.section === "Ontem"),
    }),
    [filtered],
  );

  const openNotification = useCallback(
    (item: NotificationItem & { _raw: Notificacao }) => {
      const raw = item._raw;
      if (!raw.readAt) {
        void marcarComoLida(raw.id);
      }
      if (raw.servicoId) {
        navigation.navigate("EmpregadorDetalhe", { servicoId: raw.servicoId });
        return;
      }
      if (raw.chatRoomId) {
        navigation.navigate("ChatAberto", {
          roomId: raw.chatRoomId,
          servicoId: raw.chatRoomId,
          nomeUsuario: "Conversa",
        });
      }
    },
    [marcarComoLida, navigation],
  );

  const handleMarcarTodas = useCallback(() => {
    void marcarTodasComoLidas();
  }, [marcarTodasComoLidas]);

  const isEmpty = !loading && items.length === 0;

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.headerTop}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [s.roundButton, pressed && { opacity: 0.78 }]}
              hitSlop={10}
            >
              <AppIcon name="ArrowLeft" size={21} color={colors.textPrimary} strokeWidth={2.3} />
            </Pressable>
            <Text style={s.title}>Notificações</Text>
            <Pressable
              onPress={() => refetch()}
              style={({ pressed }) => [s.bellButton, pressed && { opacity: 0.78 }]}
              hitSlop={10}
            >
              <AppIcon name="Bell" size={21} color={colors.primary} strokeWidth={2.2} />
              {unreadCount > 0 ? (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <Text style={s.subtitle}>
            Acompanhe alertas, novidades e atualizações importantes.
          </Text>

          <View style={s.actionsRow}>
            <NotificationTabs activeTab={activeTab} onChange={setActiveTab} />
            <Pressable
              onPress={handleMarcarTodas}
              disabled={unreadCount === 0}
              style={({ pressed }) => [
                s.markAllBtn,
                pressed && { opacity: 0.78 },
                unreadCount === 0 && s.markAllDisabled,
              ]}
              hitSlop={8}
            >
              <Text style={s.markAllText}>Marcar todas como lidas</Text>
            </Pressable>
          </View>

          {loading && items.length === 0 ? (
            <DLoadingState text="Carregando notificações" color={colors.primary} />
          ) : isEmpty ? (
            <DEmptyState
              icon="Bell"
              title="Sem notificações"
              subtitle="Quando houver novidades, solicitações ou avisos, eles aparecerão aqui."
              accentColor={colors.primary}
              softBg={colors.lavenderSoft}
            />
          ) : (
            <>
              {grouped.Hoje.length > 0 ? (
                <NotificationSection title="Hoje">
                  {grouped.Hoje.map((item) => (
                    <NotificationCard key={item.id} item={item} onPress={() => openNotification(item)} />
                  ))}
                </NotificationSection>
              ) : null}

              {grouped.Ontem.length > 0 ? (
                <NotificationSection title="Anteriores">
                  {grouped.Ontem.map((item) => (
                    <NotificationCard key={item.id} item={item} onPress={() => openNotification(item)} />
                  ))}
                </NotificationSection>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default NotificacoesEmpregadorScreen;

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
    gap: 14,
  },
  headerTop: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  bellBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  subtitle: {
    marginTop: -5,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  actionsRow: {
    gap: 8,
  },
  markAllBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  markAllDisabled: {
    opacity: 0.4,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
});
