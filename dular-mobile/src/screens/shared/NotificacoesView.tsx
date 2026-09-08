import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, BackCircleButton, DEmptyState, DErrorState, DLoadingState, DScreen, type AppIconName } from "@/components/ui";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { SimuladorDePopup } from "@/components/dev/SimuladorDePopup";
import type { Notificacao } from "@/api/notificacoesApi";
import type { ProfileTheme } from "@/theme/profileTheme";
import { CHAT_TYPES, metaDoTipo, tonePalette, type NotificationTone } from "@/constants/notificacoes";
import { colors, radius, shadows, spacing, typography } from "@/theme";

/**
 * NotificacoesView — a tela de Notificações dos TRÊS perfis, parametrizada por
 * tema e navegação.
 *
 * O empregador tinha uma tela própria de 315 linhas (mais 254 de componentes
 * só dela), com outro vocabulário de tons, outras abas e outro cartão. Duas
 * implementações do mesmo ecrã divergem sozinhas: um ajuste caía num perfil e
 * não no outro, e foi exatamente assim que os títulos e as cores saíram do
 * lugar. Ficou uma só, que herdou o que cada lado tinha de melhor —
 * puxar-para-atualizar, estado de erro e seções por data vieram da do
 * empregador; abas por lido/não-lido, contador e cores do perfil vieram desta.
 */

type NotificationTab = "todas" | "nao_lidas" | "lidas";

type UINotification = {
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
  secao: Secao;
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

/**
 * A que bloco da lista a notificação pertence.
 *
 * A versão do empregador tinha três nomes mas só dois blocos: colapsava
 * "Anteriores" em "Ontem" e depois desenhava o bloco "Ontem" sob o título
 * "Anteriores" — uma notificação de 20 h aparecia como "Anteriores". Aqui os
 * três são de verdade.
 */
type Secao = "Hoje" | "Ontem" | "Anteriores";

function secaoDe(iso: string): Secao {
  const data = new Date(iso);
  if (!Number.isFinite(data.getTime())) return "Anteriores";
  const hoje = new Date();
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mesmoDia(data, hoje)) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(data, ontem)) return "Ontem";
  return "Anteriores";
}

function fromRemote(n: Notificacao): UINotification {
  const meta = metaDoTipo(n.type);
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
    secao: secaoDe(n.createdAt),
  };
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
          <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={[styles.tab, active && { backgroundColor: soft }]}>
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

function NotificationCard({ item, theme, onPress }: { item: UINotification; theme: ProfileTheme; onPress: () => void }) {
  const palette = tonePalette(item.tone, theme);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.unreadColumn}>
        {item.unread ? <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} /> : null}
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
      <AppIcon name="ChevronRight" size={18} color={theme.primary} strokeWidth={2.3} />
    </Pressable>
  );
}

type Props = {
  theme: ProfileTheme;
  onVoltar: () => void;
  onOpenChat: (servicoId: string) => void;
  onOpenServico: (servicoId: string) => void;
};

export function NotificacoesView({ theme, onVoltar, onOpenChat, onOpenServico }: Props) {
  const { notificacoes, loading, error, refetch, marcarComoLida, marcarTodasComoLidas } = useNotificacoes();
  const [activeTab, setActiveTab] = useState<NotificationTab>("todas");

  // Mensagens de chat NÃO entram na tela de Notificações — elas aparecem como
  // contagem no card da conversa (tela de Mensagens). Aqui filtramos na origem
  // para não afetar contadores nem o "marcar todas como lidas".
  const notifications = useMemo<UINotification[]>(
    () => notificacoes.map(fromRemote).filter((n) => !(n.type && CHAT_TYPES.has(n.type))),
    [notificacoes],
  );
  const unreadCount = notifications.filter((item) => item.unread).length;
  const filtered = useMemo(() => {
    if (activeTab === "nao_lidas") return notifications.filter((item) => item.unread);
    if (activeTab === "lidas") return notifications.filter((item) => !item.unread);
    return notifications;
  }, [activeTab, notifications]);

  // Blocos por data, na ordem em que se lê. Só os não vazios são desenhados.
  const secoes = useMemo(
    () =>
      (["Hoje", "Ontem", "Anteriores"] as const)
        .map((titulo) => ({ titulo, itens: filtered.filter((n) => n.secao === titulo) }))
        .filter((s) => s.itens.length > 0),
    [filtered],
  );

  const markAllAsRead = () => {
    void marcarTodasComoLidas();
  };

  const openNotification = (item: UINotification) => {
    if (item.remoteId) void marcarComoLida(item.remoteId);

    if (item.type && CHAT_TYPES.has(item.type)) {
      if (item.servicoId) {
        onOpenChat(item.servicoId);
        return;
      }
      Alert.alert(item.title, "Conversa indisponível.");
      return;
    }

    if (item.servicoId) {
      onOpenServico(item.servicoId);
      return;
    }

    Alert.alert(item.title, item.text);
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={theme.background}
      contentContainerStyle={styles.scroll}
      // Puxar para atualizar: era o único jeito de recarregar depois que o
      // sino saiu do cabeçalho, e é o gesto que se espera numa lista.
      refreshing={loading}
      onRefresh={refetch}
      refreshTintColor={theme.primary}
    >
      {/* Header: voltar (esq) · "Notificações" (centro) · espaçador (dir).

          O sino saiu: um sino DENTRO da tela de notificações não leva a
          lugar nenhum — a pessoa já está nelas. O espaçador fica, com a
          mesma largura do botão, para o título ficar no centro da linha. */}
      <View style={styles.header}>
        <BackCircleButton onPress={onVoltar} color={theme.icon} borderColor={theme.border} />
        <Text style={[styles.title, { color: theme.textAccent }]} numberOfLines={1}>
          Notificações
        </Text>
        <View style={styles.headerSide} />
      </View>

      <Text style={styles.subtitle}>Acompanhe alertas, novidades e atualizações importantes.</Text>

      <NotificationTabs
        activeTab={activeTab}
        unreadCount={unreadCount}
        accent={theme.primary}
        soft={theme.primarySoft}
        onChange={setActiveTab}
      />

      {/* "Marcar todas como lidas" logo abaixo da barra de abas. */}
      <Pressable
        onPress={markAllAsRead}
        disabled={unreadCount === 0}
        style={({ pressed }) => [styles.markRow, pressed && styles.pressed, unreadCount === 0 && styles.disabled]}
      >
        <AppIcon name="CheckCircle" size={15} color={theme.primary} strokeWidth={2.3} />
        <Text style={[styles.markText, { color: theme.primary }]}>Marcar todas como lidas</Text>
      </Pressable>

      <SimuladorDePopup theme={theme} servicoId={notifications.find((n) => n.servicoId)?.servicoId} />

      {loading && notifications.length === 0 ? (
        <DLoadingState text="Carregando notificações" color={theme.primary} />
      ) : error && notifications.length === 0 ? (
        // Sem isto, uma falha de rede aparecia como "Sem notificações" — dizia
        // que não há nada quando na verdade não deu para saber.
        <DErrorState message={error} onRetry={refetch} />
      ) : secoes.length > 0 ? (
        secoes.map((secao) => (
          <View key={secao.titulo} style={styles.secao}>
            <Text style={[styles.secaoTitulo, { color: theme.textAccent }]}>{secao.titulo}</Text>
            <View style={styles.list}>
              {secao.itens.map((item) => (
                <NotificationCard key={item.id} item={item} theme={theme} onPress={() => openNotification(item)} />
              ))}
            </View>
          </View>
        ))
      ) : (
        <DEmptyState
          icon="Bell"
          title="Sem notificações"
          subtitle="Quando houver novidades, solicitações ou avisos, eles aparecerão aqui."
          accentColor={theme.primary}
          softBg={theme.primarySoft}
        />
      )}
    </DScreen>
  );
}

export default NotificacoesView;

const styles = StyleSheet.create({
  scroll: { gap: 14 },
  header: { minHeight: 52, flexDirection: "row", alignItems: "center" },
  /** Mesma largura do BackCircleButton, para centrar o título. */
  headerSide: { width: 42, height: 42 },
  title: {
    // Título de tela secundária: h2 e cor de destaque do perfil.
    ...typography.h2,
    flex: 1,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    marginTop: -5,
    color: colors.textSecondary,
    ...typography.caption,
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
  secao: { gap: 8 },
  secaoTitulo: { ...typography.bodySmMedium, fontWeight: "700" },
  markRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, paddingHorizontal: 2 },
  markText: { fontSize: 12, lineHeight: 15, fontWeight: "700" },
  disabled: { opacity: 0.45 },
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
  tabText: { color: colors.textPrimary, ...typography.caption, fontWeight: "700" },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  tabBadgeText: { color: colors.white, fontSize: 10, lineHeight: 13, fontWeight: "700" },
  list: { gap: 8 },
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
  unreadColumn: { width: 8, alignItems: "center" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  iconBubble: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  cardTitle: { flexShrink: 1, color: colors.textPrimary, ...typography.bodySm, fontWeight: "700" },
  badge: { borderRadius: radius.md, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
  cardText: { color: colors.textSecondary, ...typography.caption, fontWeight: "500" },
  time: { color: colors.textSecondary, ...typography.caption, fontWeight: "500" },
  pressed: { opacity: 0.74 },
});
