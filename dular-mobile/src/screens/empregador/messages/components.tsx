import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { DAvatar } from "@/components/ui/DAvatar";
import { DCard } from "@/components/ui/DCard";
import { colors, radius, shadows, spacing, typography } from "@/theme";

export type MessagesTab = "conversas" | "arquivadas";

export type ConversationItem = {
  id: string;
  servicoId: string;
  nome: string;
  categoria: string;
  categoriaIcon: AppIconName;
  localizacao: string;
  rating: string;
  experiencia: string;
  horario: string;
  initials: string;
  avatarUrl?: string;
  /** Mensagens não-lidas da conversa (badge estilo WhatsApp). */
  naoLidas?: number;
  /** Prévia da última mensagem (quando disponível). */
  ultimaMensagem?: string;
  /** Prévia da última mensagem (estilo WhatsApp — alias de ultimaMensagem). */
  lastMessage?: string;
  /** Quantidade de mensagens não lidas (alias de naoLidas). */
  unread?: number;
};

type MessagesTabsProps = {
  activeTab: MessagesTab;
  onChange: (tab: MessagesTab) => void;
  /** Cor de destaque (identidade de gênero). Default: empregador (roxo). */
  accent?: string;
  border?: string;
};

export function MessagesTabs({
  activeTab,
  onChange,
  accent = colors.primary,
  border = colors.lavenderDivider,
}: MessagesTabsProps) {
  return (
    <View style={[s.tabsWrap, { borderColor: border }]}>
      <TabPill label="Conversas" active={activeTab === "conversas"} accent={accent} onPress={() => onChange("conversas")} />
      <TabPill label="Arquivadas" active={activeTab === "arquivadas"} accent={accent} onPress={() => onChange("arquivadas")} />
    </View>
  );
}

function TabPill({ label, active, accent, onPress }: { label: string; active: boolean; accent: string; onPress: () => void }) {
  const icon = label === "Conversas" ? "MessageCircle" : "Archive";

  return (
    <Pressable onPress={onPress} style={[s.tabPill, active && s.tabPillActive, active && { borderColor: accent }]}>
      <AppIcon name={icon} size={17} color={active ? accent : colors.textMuted} strokeWidth={2.1} />
      <Text style={[s.tabText, active && { color: accent, fontWeight: "600" }]}>{label}</Text>
    </Pressable>
  );
}

export function VerifiedBadge() {
  return (
    <AppIcon name="Gem" size={15} color={colors.success} strokeWidth={2.5} />
  );
}

export function OnlineDot() {
  return <View style={s.onlineDot} />;
}

type ConversationCardProps = {
  item: ConversationItem;
  onPress: () => void;
  /** Cor de destaque (identidade de gênero). Default: empregador (roxo). */
  accent?: string;
  soft?: string;
};

export function ConversationCard({ item, onPress, accent = colors.primary, soft = colors.lavenderSoft }: ConversationCardProps) {
  const naoLidas = item.naoLidas ?? item.unread ?? 0;
  const unread = naoLidas > 0;
  const hasUnread = unread;
  const preview = (item.ultimaMensagem ?? item.lastMessage)?.trim() ? (item.ultimaMensagem ?? item.lastMessage)! : "Toque para conversar";

  return (
    <DCard style={s.conversationCard} onPress={onPress}>
      <View style={s.avatarWrap}>
        <DAvatar size="lg" uri={item.avatarUrl} initials={item.initials} />
        {hasUnread ? <View style={[s.unreadDot, { backgroundColor: accent }]} /> : <OnlineDot />}
      </View>

      <View style={s.cardMain}>
        <View style={s.nameRow}>
          <Text style={[s.name, hasUnread && s.nameUnread]} numberOfLines={1}>
            {item.nome}
          </Text>
          <VerifiedBadge />
        </View>

        <View style={[s.categoryPill, { backgroundColor: soft }]}>
          <AppIcon name={item.categoriaIcon} size={11} color={accent} strokeWidth={2.1} />
          <Text style={[s.categoryText, { color: accent }]}>{item.categoria}</Text>
        </View>

        <Text style={[s.preview, hasUnread && s.previewUnread]} numberOfLines={1}>
          {preview}
        </Text>
      </View>

      <View style={s.rightCol}>
        <Text style={[s.time, hasUnread && { color: accent, fontWeight: "700" }]}>{item.horario}</Text>
        {hasUnread ? (
          <View style={[s.unreadBadge, { backgroundColor: accent }]}>
            <Text style={s.unreadBadgeText}>{naoLidas > 9 ? "9+" : naoLidas}</Text>
          </View>
        ) : null}
      </View>
    </DCard>
  );
}

export function EmptyArchiveState({
  accent = colors.primary,
  soft = colors.lavenderSoft,
  border = colors.lavenderDivider,
}: { accent?: string; soft?: string; border?: string } = {}) {
  return (
    <View style={s.emptyWrap}>
      <View style={[s.emptyIcon, { backgroundColor: soft, borderColor: border }]}>
        <AppIcon name="MessageCircle" size={34} color={accent} strokeWidth={1.7} />
      </View>
      <Text style={s.emptyTitle}>Nenhuma conversa arquivada</Text>
      <Text style={s.emptySubtitle}>As conversas arquivadas aparecerão aqui.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tabsWrap: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lavenderDivider,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  tabPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.4,
    borderColor: "transparent",
  },
  tabPillActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    ...shadows.soft,
  },
  tabText: {
    color: colors.textMuted,
    ...typography.bodySmMedium,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.primary,
  },
  conversationCard: {
    minHeight: 104,
    padding: 10,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    right: 2,
    top: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.success,
  },
  unreadDot: {
    position: "absolute",
    right: 2,
    top: 6,
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  nameUnread: {
    fontWeight: "800",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    ...typography.bodyMedium,
    
    fontWeight: "600",
    letterSpacing: 0,
  },
  categoryPill: {
    alignSelf: "flex-start",
    minHeight: 20,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.lavenderSoft,
  },
  categoryText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
  preview: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
  },
  previewUnread: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  time: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "600",
    textAlign: "right",
  },
  rightCol: {
    width: 56,
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  emptyWrap: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
    borderWidth: 1,
    borderColor: colors.lavenderDivider,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
    textAlign: "center",
  },
});
