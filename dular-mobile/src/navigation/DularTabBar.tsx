/**
 * DularTabBar — Tab Bar flutuante Dular
 *
 * Identidade validada:
 *   - Fundo branco, border-radius 28px, sombra float
 *   - Ativo: ícone + label em colors.primary
 *   - Inativo: colors.textSecondary
 *   - Posicionado como overlay absoluto (gerenciado pelo navigator)
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, radius, shadow } from "@/theme/tokens";
import { TAB_ROUTES, type TabRouteName } from "@/navigation/routes";

type Props = BottomTabBarProps & { insets: { bottom: number } };

// Mapeamento de ícones por nome de rota
function getIcon(routeName: string, focused: boolean): React.ComponentProps<typeof Ionicons>["name"] {
  switch (routeName) {
    case TAB_ROUTES.HOME:
      return focused ? "home" : "home-outline";
    case TAB_ROUTES.CARTEIRA:
      return focused ? "wallet" : "wallet-outline";
    case TAB_ROUTES.SOLICITACOES:
    case "Solicitacoes":
      return focused ? "list" : "list-outline";
    case TAB_ROUTES.PERFIL:
      return focused ? "person" : "person-outline";
    default:
      return focused ? "ellipsis-horizontal" : "ellipsis-horizontal-outline";
  }
}

export default function DularTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: Props) {
  const bottomPad = insets?.bottom ?? 0;

  return (
    <View style={[styles.wrapper, { bottom: Math.max(16, bottomPad + 8) }]}>
      <View style={[styles.bar, shadow.float]}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          const iconColor  = focused ? colors.primary : colors.textSecondary;
          const labelColor = focused ? colors.primary : colors.textSecondary;

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
            >
              {/* Pill de destaque no item ativo */}
              {focused && <View style={styles.activePill} />}

              <Ionicons
                name={getIcon(route.name, focused)}
                size={23}
                color={iconColor}
              />
              <Text style={[styles.label, { color: labelColor }]}>
                {route.name as TabRouteName}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Posicionamento flutuante — o navigator precisa de tabBarStyle: { position: "absolute" }
  wrapper: {
    position: "absolute",
    left: 18,
    right: 18,
    alignItems: "center",
  },

  // Card flutuante — identidade validada
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    minHeight: 88,
    paddingVertical: 10,
    paddingHorizontal: 6,
    width: "100%",
    // shadow.float aplicado via spread
  },

  // Cada aba
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
    borderRadius: radius.tabbar - 4,
    position: "relative",
  },
  tabPressed: {
    opacity: 0.7,
  },

  // Indicador sutil atrás do ícone ativo
  activePill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 6,
    right: 6,
    borderRadius: 18,
    backgroundColor: colors.lavenderSoft,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
