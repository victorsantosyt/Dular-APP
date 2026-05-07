import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, radius, shadows, spacing } from "@/theme";
import { AppIcon, AppIconName } from "./AppIcon";

export type NavTab = "home" | "search" | "new" | "messages" | "profile";

type Props = {
  activeTab: NavTab;
  onPress: (tab: NavTab) => void;
  messagesBadge?: number;
  variant?: "cliente" | "diarista";
};

type Item = {
  id: NavTab;
  label: string;
  icon: AppIconName;
};

const ITEMS: Item[] = [
  { id: "home",     label: "Início",    icon: "Home" },
  { id: "search",   label: "Buscar",    icon: "Search" },
  { id: "new",      label: "Agendar",   icon: "Plus" },
  { id: "messages", label: "Mensagens", icon: "MessageCircle" },
  { id: "profile",  label: "Perfil",    icon: "User" },
];

const DIARISTA_ITEMS: Item[] = [
  { id: "home",     label: "Início",       icon: "Home" },
  { id: "search",   label: "Agendamentos", icon: "Calendar" },
  { id: "new",      label: "Novo",         icon: "Plus" },
  { id: "messages", label: "Mensagens",    icon: "MessageCircle" },
  { id: "profile",  label: "Perfil",       icon: "User" },
];

export function DBottomNav({ activeTab, onPress, messagesBadge, variant = "cliente" }: Props) {
  const insets = useSafeAreaInsets();
  const items = variant === "diarista" ? DIARISTA_ITEMS : ITEMS;
  const bottomPadding = Math.max(8, insets.bottom + 8);

  return (
    <View style={[s.bar, { paddingBottom: bottomPadding }]}>
      {items.map((item) => {
        const isCenter = item.id === "new";
        const isActive = activeTab === item.id;
        const color = isActive ? colors.primary : colors.textSecondary;

        if (isCenter) {
          return (
            <Pressable key={item.id} onPress={() => onPress(item.id)} style={s.centerWrap}>
              <LinearGradient
                colors={gradients.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.centerBtn}
              >
                <AppIcon name="Plus" size={30} color={colors.white} strokeWidth={2.6} />
              </LinearGradient>
              <Text style={[s.label, s.centerLabel]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                {item.label}
              </Text>
            </Pressable>
          );
        }

        const showBadge = item.id === "messages" && messagesBadge && messagesBadge > 0;

        return (
          <Pressable key={item.id} onPress={() => onPress(item.id)} style={s.item}>
            <View>
              <AppIcon name={item.icon} size={isActive ? 26 : 24} color={color} strokeWidth={isActive ? 2.4 : 2} />
              {showBadge ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{messagesBadge! > 9 ? "9+" : messagesBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.label, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    minHeight: 88,
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    alignItems: "flex-start",
    ...shadows.floating,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 2,
    paddingBottom: 2,
  },
  label: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -24,
  },
  centerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  centerLabel: {
    marginTop: 3,
    color: colors.primary,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
});
