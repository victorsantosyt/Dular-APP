import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DLoadingState, DScreen, type AppIconName } from "@/components/ui";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import type { Notificacao } from "@/api/notificacoesApi";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, typography } from "@/theme";
import { labelServico, localResumo } from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;
type NotificationTab = "todas" | "nao_lidas" | "lidas";
type NotificationTone = "primary" | "urgent" | "success" | "security" | "info" | "support";

type MontadorNotification = {
  id: string;
  title: string;
  text: string;
  time: string;
  icon: AppIconName;
  badge: string;
  tone: NotificationTone;
  unread: boolean;
  type?: string;
  servicoId?: string;
  chatRoomId?: string;
  remoteId?: string;
};

const CHAT_TYPES = new Set<string>(["CHAT_NOVA_MENSAGEM", "MENSAGEM_RECEBIDA"]);

const TYPE_META: Record<string, { icon: AppIconName; badge: string; tone: NotificationTone }> = {
  SERVICO_SOLICITADO: { icon: "BriefcaseBusiness", badge: "Solicitação", tone: "primary" },
  SERVICO_ACEITO: { icon: "CheckCircle", badge: "Aceito", tone: "success" },
  SERVICO_RECUSADO: { icon: "XCircle", badge: "Recusado", tone: "urgent" },
  SERVICO_INICIADO: { icon: "Clock", badge: "Em andamento", tone: "info" },
  SERVICO_FINALIZADO: { icon: "CheckCircle", badge: "Concluído", tone: "success" },
  SERVICO_CANCELADO: { icon: "XCircle", badge: "Cancelado", tone: "urgent" },
  MENSAGEM_RECEBIDA: { icon: "MessageCircle", badge: "Mensagem", tone: "support" },
  CHAT_NOVA_MENSAGEM: { icon: "MessageCircle", badge: "Mensagem", tone: "support" },
  AVALIACAO_RECEBIDA: { icon: "Star", badge: "Avaliação", tone: "success" },
  ALERTA_SEGURANCA: { icon: "AlertTriangle", badge: "Urgente", tone: "urgent" },
  SISTEMA: { icon: "Sparkles", badge: "Novidade", tone: "primary" },
  NOVIDADE: { icon: "Megaphone", badge: "Novidade", tone: "primary" },
};

function tempoRelativo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 2) return "Ontem";
  return `${days} dias`;
}

function fromRemote(n: Notificacao): MontadorNotification {
  const meta = TYPE_META[n.type] ?? { icon: "Bell" as AppIconName, badge: "Aviso", tone: "primary" as NotificationTone };
  return {
    id: `remote-${n.id}`,
    remoteId: n.id,
    title: n.title,
    text: n.body,
    time: tempoRelativo(n.createdAt),
    icon: meta.icon,
    badge: meta.badge,
    tone: meta.tone,
    unread: !n.readAt,
    type: n.type,
    servicoId: n.servicoId ?? undefined,
    chatRoomId: n.chatRoomId ?? undefined,
  };
}

const STATIC_NOTIFICATIONS: Omit<MontadorNotification, "unread">[] = [
  {
    id: "sistema-melhorias",
    title: "Melhorias no sistema",
    text: "Melhorias para deixar sua experiência mais rápida.",
    time: "Hoje",
    icon: "Sparkles",
    badge: "Novidade",
    tone: "primary",
  },
  {
    id: "seguranca-perfil",
    title: "Segurança do perfil",
    text: "Atualize documentos para receber mais oportunidades.",
    time: "Ontem",
    icon: "ShieldCheck",
    badge: "Segurança",
    tone: "security",
  },
  {
    id: "suporte-dular",
    title: "Suporte Dular",
    text: "Ajuda para serviços, agenda e pagamentos.",
    time: "Ontem",
    icon: "MessageCircle",
    badge: "Informativo",
    tone: "support",
  },
];

function tonePalette(tone: NotificationTone, profileTheme: ReturnType<typeof useProfileTheme>) {
  if (tone === "urgent") return { accent: colors.danger, soft: colors.dangerSoft };
  if (tone === "success") return { accent: colors.success, soft: colors.successSoft };
  if (tone === "security") return { accent: profileTheme.primary, soft: profileTheme.primarySoft };
  if (tone === "support") return { accent: colors.info, soft: colors.infoLight };
  if (tone === "info") return { accent: colors.warning, soft: colors.warningSoft };
  return { accent: profileTheme.primary, soft: profileTheme.primarySoft };
}

function NotificationTabs({
  activeTab,
  unreadCount,
  accent,
  soft,
  onChange,
}: {
  activeTab: NotificationTab;
  unreadCount: number;
  accent: string;
  soft: string;
  onChange: (tab: NotificationTab) => void;
}) {
  const tabs: Array<{ id: NotificationTab; label: string }> = [
    { id: "todas", label: "Todas" },
    { id: "nao_lidas", label: "Não lidas" },
    { id: "lidas", label: "Lidas" },
  ];

  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && { backgroundColor: soft }]}
          >
            <Text style={[styles.tabText, active && { color: accent, fontWeight: "700" }]} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.id === "nao_lidas" && unreadCount > 0 ? (
              <View style={[styles.tabBadge, { backgroundColor: accent }]}>
                <Text style={styles.tabBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function NotificationCard({
  item,
  profileTheme,
  onPress,
}: {
  item: MontadorNotification;
  profileTheme: ReturnType<typeof useProfileTheme>;
  onPress: () => void;
}) {
  const palette = tonePalette(item.tone, profileTheme);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.unreadColumn}>
        {item.unread ? <View style={[styles.unreadDot, { backgroundColor: profileTheme.primary }]} /> : null}
      </View>
      <View style={[styles.iconBubble, { backgroundColor: palette.soft }]}>
        <AppIcon name={item.icon} size={20} color={palette.accent} strokeWidth={2.2} />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.badge, { backgroundColor: palette.soft }]}>
            <Text style={[styles.badgeText, { color: palette.accent }]} numberOfLines={1}>
              {item.badge}
            </Text>
          </View>
        </View>
        <Text style={styles.cardText} numberOfLines={2}>
          {item.text}
        </Text>
        <Text style={styles.time}>{item.time}</Text>
      </View>
      <AppIcon name="ChevronRight" size={18} color={profileTheme.primary} strokeWidth={2.3} />
    </Pressable>
  );
}

export function MontadorNotificacoes() {
  const navigation = useNavigation<Navigation>();
  const profileTheme = useProfileTheme("MONTADOR");
  const { pendentes, loading: loadingServicos } = useMontadorServicos();
  const {
    notificacoes,
    loading: loadingRemote,
    marcarComoLida,
    marcarTodasComoLidas,
  } = useNotificacoes();
  const [activeTab, setActiveTab] = useState<NotificationTab>("todas");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const remoteItems = useMemo(() => notificacoes.map(fromRemote), [notificacoes]);

  const notifications = useMemo<MontadorNotification[]>(() => {
    const solicitacoes = pendentes.map((servico) => ({
      id: `solicitacao-${servico.id}`,
      title: "Nova solicitação recebida",
      text: `Pedido de ${labelServico(servico)} em ${localResumo(servico)}. Toque para revisar.`,
      time: "Agora",
      icon: "BriefcaseBusiness" as AppIconName,
      badge: "Solicitação",
      tone: "primary" as NotificationTone,
      unread: true,
      servicoId: servico.id,
    }));

    const staticItems = STATIC_NOTIFICATIONS.map((item) => ({
      ...item,
      unread: false,
    }));

    const combined = [...remoteItems, ...solicitacoes, ...staticItems];
    return combined.map((item) => ({
      ...item,
      unread: item.unread && !readIds.has(item.id),
    }));
  }, [pendentes, readIds, remoteItems]);

  const loading = loadingRemote || loadingServicos;
  const unreadCount = notifications.filter((item) => item.unread).length;
  const filtered = useMemo(() => {
    if (activeTab === "nao_lidas") return notifications.filter((item) => item.unread);
    if (activeTab === "lidas") return notifications.filter((item) => !item.unread);
    return notifications;
  }, [activeTab, notifications]);

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map((item) => item.id)));
    void marcarTodasComoLidas();
  };

  const openNotification = (item: MontadorNotification) => {
    setReadIds((current) => new Set(current).add(item.id));
    if (item.remoteId) {
      void marcarComoLida(item.remoteId);
    }

    // Notificações de chat: abrem a conversa do serviço (roomId === servicoId).
    if (item.type && CHAT_TYPES.has(item.type)) {
      if (item.servicoId) {
        navigation.navigate("MontadorChat", { servicoId: item.servicoId });
        return;
      }
      Alert.alert(item.title, "Conversa indisponível.");
      return;
    }

    if (item.servicoId) {
      navigation.navigate("MontadorDetalheSolicitacao", { servicoId: item.servicoId });
      return;
    }

    Alert.alert(item.title, item.text);
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={profileTheme.background}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <AppIcon name="ArrowLeft" size={23} color={profileTheme.primary} strokeWidth={2.4} />
        </Pressable>
        <View style={[styles.headerIcon, { backgroundColor: profileTheme.primarySoft }]}>
          <AppIcon name="Bell" size={21} color={profileTheme.primary} strokeWidth={2.4} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          Notificações
        </Text>
        <Pressable
          onPress={markAllAsRead}
          disabled={unreadCount === 0}
          style={({ pressed }) => [styles.markButton, pressed && styles.pressed, unreadCount === 0 && styles.disabled]}
        >
          <Text style={[styles.markText, { color: profileTheme.primary }]}>Marcar todas como lidas</Text>
        </Pressable>
      </View>

      <NotificationTabs
        activeTab={activeTab}
        unreadCount={unreadCount}
        accent={profileTheme.primary}
        soft={profileTheme.primarySoft}
        onChange={setActiveTab}
      />

      {loading && notifications.length === 0 ? (
        <DLoadingState text="Carregando notificações" color={profileTheme.primary} />
      ) : filtered.length > 0 ? (
        <View style={styles.list}>
          {filtered.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              profileTheme={profileTheme}
              onPress={() => openNotification(item)}
            />
          ))}
        </View>
      ) : (
        <DEmptyState
          icon="Bell"
          title="Sem notificações"
          subtitle="Quando houver novidades, solicitações ou avisos, eles aparecerão aqui."
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      )}
    </DScreen>
  );
}

export default MontadorNotificacoes;

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
  },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: 0,
  },
  markButton: {
    maxWidth: 92,
    alignItems: "flex-end",
  },
  markText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  disabled: {
    opacity: 0.45,
  },
  tabs: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  tab: {
    flex: 1,
    minHeight: 34,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
  },
  tabText: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "700",
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
  },
  list: {
    gap: 8,
  },
  card: {
    minHeight: 94,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingLeft: 8,
    paddingRight: 10,
    ...shadows.soft,
  },
  unreadColumn: {
    width: 8,
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  cardTitle: {
    flexShrink: 1,
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  badge: {
    borderRadius: radius.md,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
  },
  cardText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  time: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.74,
  },
});
