import React, { useRef, useEffect } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gradients, radius, shadows, spacing } from "@/theme";
import { AppIcon, AppIconName } from "./AppIcon";

export type NavTab = "home" | "search" | "new" | "messages" | "profile";

type Props = {
  activeTab: NavTab;
  onPress: (tab: NavTab) => void;
  messagesBadge?: number;
  variant?: "empregador" | "diarista";
};

type Item = {
  id: NavTab;
  label: string;
  icon: AppIconName;
};

const EMPREGADOR_ITEMS: Item[] = [
  { id: "home",     label: "Início",    icon: "Home"          },
  { id: "search",   label: "Buscar",    icon: "Search"        },
  { id: "new",      label: "Agenda",    icon: "Plus"          },
  { id: "messages", label: "Mensagens", icon: "MessageCircle" },
  { id: "profile",  label: "Perfil",    icon: "User"          },
];

const DIARISTA_ITEMS: Item[] = [
  { id: "home",     label: "Início",    icon: "Home"          },
  { id: "search",   label: "Agenda",    icon: "Calendar"      },
  { id: "new",      label: "Serviços",  icon: "Plus"          },
  { id: "messages", label: "Mensagens", icon: "MessageCircle" },
  { id: "profile",  label: "Perfil",    icon: "User"          },
];

// ─── Animated tab item ────────────────────────────────────────────────────────

function TabItem({
  item, isActive, isCenter, badge, onPress,
}: {
  item: Item; isActive: boolean; isCenter: boolean; badge?: number; onPress: () => void;
}) {
  const pillAnim = useRef(new Animated.Value(isActive && !isCenter ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(pillAnim, {
      toValue: isActive && !isCenter ? 1 : 0,
      tension: 120, friction: 10, useNativeDriver: false,
    }).start();
  }, [isActive, isCenter, pillAnim]);

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.9, tension: 150, friction: 8, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start();

  const iconColor  = isActive ? colors.primary : colors.textMuted;
  const labelColor = isActive ? colors.primary : colors.textMuted;
  const pillBg = pillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(123,78,219,0)", "rgba(243,236,255,1)"],
  });

  if (isCenter) {
    return (
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={s.centerWrap}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.centerBtn}>
            <AppIcon name="Plus" size={28} color={colors.white} strokeWidth={2.6} />
          </LinearGradient>
        </Animated.View>
        <Text style={[s.label, s.centerLabel]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={s.item}>
      <Animated.View style={[s.iconPill, { backgroundColor: pillBg }]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <AppIcon
            name={item.icon}
            size={isActive ? 22 : 21}
            color={iconColor}
            strokeWidth={isActive ? 2.4 : 1.9}
          />
        </Animated.View>
        {badge && badge > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      <Text style={[s.label, { color: labelColor, fontWeight: isActive ? "700" : "500" }]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

// ─── DBottomNav ───────────────────────────────────────────────────────────────

export function DBottomNav({ activeTab, onPress, messagesBadge, variant = "empregador" }: Props) {
  const insets = useSafeAreaInsets();
  const items = variant === "diarista" ? DIARISTA_ITEMS : EMPREGADOR_ITEMS;
  const bottomMargin = insets.bottom + spacing.sm;

  return (
    <BlurView intensity={80} tint="light" style={[s.bar, { marginBottom: bottomMargin }]}>
      {items.map((item) => (
        <TabItem
          key={item.id}
          item={item}
          isActive={activeTab === item.id}
          isCenter={item.id === "new"}
          badge={item.id === "messages" ? messagesBadge : undefined}
          onPress={() => onPress(item.id)}
        />
      ))}
    </BlurView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.6)",
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.md,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    overflow: "hidden",
    ...shadows.floating,
  },
  item: {
    flex: 1, alignItems: "center", gap: 4, paddingTop: 2,
  },
  iconPill: {
    width: 44, height: 36, borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  label: {
    fontSize: 11, lineHeight: 14, textAlign: "center", width: "100%",
  },
  centerWrap: {
    flex: 1, alignItems: "center", justifyContent: "flex-start",
    gap: 4, marginTop: 0, paddingTop: 0,
  },
  centerBtn: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    ...shadows.primaryButton,
  },
  centerLabel: {
    color: colors.primary, fontWeight: "600",
  },
  badge: {
    position: "absolute", top: 2, right: 4,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: radius.pill, backgroundColor: colors.notification,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: {
    color: colors.white, fontSize: 10, fontWeight: "800", lineHeight: 13,
  },
});
