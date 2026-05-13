import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { DBottomNav } from "@/components/ui";
import type { NavTab } from "@/components/ui/DBottomNav";

type Variant = "diarista" | "empregador";

const ROUTE_BY_TAB: Record<Variant, Record<NavTab, string>> = {
  diarista: {
    home: "Home",
    search: "Agendamentos",
    new: "Novo",
    messages: "Mensagens",
    profile: "Perfil",
  },
  empregador: {
    home: "Home",
    search: "Buscar",
    new: "SolicitarServico",
    messages: "Mensagens",
    profile: "Perfil",
  },
};

const TAB_BY_ROUTE: Record<Variant, Record<string, NavTab>> = {
  diarista: Object.fromEntries(
    Object.entries(ROUTE_BY_TAB.diarista).map(([tab, route]) => [route, tab])
  ) as Record<string, NavTab>,
  empregador: Object.fromEntries(
    Object.entries(ROUTE_BY_TAB.empregador).map(([tab, route]) => [route, tab])
  ) as Record<string, NavTab>,
};

type Props = BottomTabBarProps & {
  variant: Variant;
  messagesBadge?: number;
};

export function DBottomTabBar({ state, navigation, variant, messagesBadge }: Props) {
  const currentRoute = state.routes[state.index]?.name;
  const activeTab = TAB_BY_ROUTE[variant][currentRoute] ?? null;

  const handlePress = useCallback(
    (tab: NavTab) => {
      const target = ROUTE_BY_TAB[variant][tab];
      if (target) navigation.navigate(target as never);
    },
    [navigation, variant]
  );

  return (
    <View style={styles.floating} pointerEvents="box-none">
      <DBottomNav
        activeTab={activeTab}
        variant={variant}
        messagesBadge={messagesBadge}
        onPress={handlePress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
});
