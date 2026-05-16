import React, { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";

export type NotificationTab = "todas" | "importantes" | "sistema";
export type NotificationTone = "urgent" | "analysis" | "system" | "success" | "security" | "news";

export type NotificationItem = {
  id: string;
  section: "Hoje" | "Ontem";
  filter: "importantes" | "sistema";
  type: string;
  title: string;
  text: string;
  time: string;
  icon: AppIconName;
  tone: NotificationTone;
  badge?: string;
  unread?: boolean;
};

type NotificationTabsProps = {
  activeTab: NotificationTab;
  onChange: (tab: NotificationTab) => void;
};

const TABS: Array<{ id: NotificationTab; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "importantes", label: "Importantes" },
  { id: "sistema", label: "Sistema" },
];

export function NotificationTabs({ activeTab, onChange }: NotificationTabsProps) {
  return (
    <View style={s.tabs}>
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={s.tabPressable}>
            {active ? (
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tabActive}>
                <Text style={s.tabActiveText}>{tab.label}</Text>
              </LinearGradient>
            ) : (
              <View style={s.tabInactive}>
                <Text style={s.tabInactiveText}>{tab.label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type NotificationSectionProps = {
  title: string;
  children: ReactNode;
};

export function NotificationSection({ title, children }: NotificationSectionProps) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionList}>{children}</View>
    </View>
  );
}

type NotificationCardProps = {
  item: NotificationItem;
  onPress: () => void;
};

export function NotificationCard({ item, onPress }: NotificationCardProps) {
  const tone = toneMap[item.tone];
  return (
    <DCard onPress={onPress} style={s.card}>
      {item.tone === "urgent" ? <View style={[s.sideBorder, { backgroundColor: tone.accent }]} /> : null}

      <View style={[s.iconWrap, { backgroundColor: tone.bg }]}>
        <AppIcon name={item.icon} size={22} color={tone.accent} strokeWidth={2.3} />
      </View>

      <View style={s.content}>
        <View style={s.titleRow}>
          <Text style={s.typeLabel}>{item.type}</Text>
          {item.badge ? <NotificationBadge label={item.badge} tone={item.tone} /> : null}
        </View>
        <Text style={s.cardTitle}>{item.title}</Text>
        <Text style={s.cardText}>{item.text}</Text>
      </View>

      <View style={s.status}>
        <Text style={s.time}>{item.time}</Text>
        {item.unread ? <NotificationDot color={tone.accent} /> : null}
      </View>
    </DCard>
  );
}

export function NotificationBadge({ label, tone }: { label: string; tone: NotificationTone }) {
  const palette = toneMap[tone];
  return (
    <View style={[s.badge, { backgroundColor: palette.bg }]}>
      <Text style={[s.badgeText, { color: palette.accent }]}>{label}</Text>
    </View>
  );
}

export function NotificationDot({ color }: { color: string }) {
  return <View style={[s.dot, { backgroundColor: color }]} />;
}

const toneMap: Record<NotificationTone, { accent: string; bg: string }> = {
  urgent: { accent: colors.danger, bg: colors.dangerSoft },
  analysis: { accent: colors.primary, bg: colors.lavenderSoft },
  system: { accent: colors.info, bg: colors.lavenderSoft },
  success: { accent: colors.success, bg: colors.successSoft },
  security: { accent: colors.primaryDark, bg: colors.lavenderSoft },
  news: { accent: colors.pink, bg: colors.pinkSoft },
};

const s = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lavenderDivider,
    ...shadows.soft,
  },
  tabPressable: {
    flex: 1,
  },
  tabActive: {
    minHeight: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  tabInactive: {
    minHeight: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  tabActiveText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "700",
  },
  tabInactiveText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
    paddingHorizontal: 2,
  },
  sectionList: {
    gap: 8,
  },
  card: {
    minHeight: 104,
    borderRadius: radius.lg,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    overflow: "hidden",
  },
  sideBorder: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  typeLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardTitle: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    
    fontWeight: "700",
    letterSpacing: 0,
  },
  cardText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  status: {
    minWidth: 44,
    alignItems: "flex-end",
    gap: 10,
  },
  time: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "500",
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: "700",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
});
