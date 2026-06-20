import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { DBottomNav } from "@/components/ui";
import type { NavTab } from "@/components/ui/DBottomNav";
import { useAuth } from "@/stores/authStore";
import { getProfileTheme } from "@/theme/profileTheme";

type Variant = "diarista" | "empregador" | "montador";

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
    // O botão central abre "Solicitações" (lista de agendamentos do empregador).
    // O flow de contratação (SolicitarServico) continua registrado e é acessado
    // pelos botões "Contratar" dos perfis — só não é mais entry-point da barra.
    new: "Agendamentos",
    messages: "Mensagens",
    profile: "Perfil",
  },
  montador: {
    home: "MontadorHome",
    search: "MontadorAgenda",
    new: "MontadorSolicitacoes",
    messages: "MontadorMensagens",
    profile: "MontadorPerfil",
  },
};

const TAB_BY_ROUTE: Record<Variant, Record<string, NavTab>> = {
  diarista: Object.fromEntries(
    Object.entries(ROUTE_BY_TAB.diarista).map(([tab, route]) => [route, tab])
  ) as Record<string, NavTab>,
  empregador: Object.fromEntries(
    Object.entries(ROUTE_BY_TAB.empregador).map(([tab, route]) => [route, tab])
  ) as Record<string, NavTab>,
  montador: Object.fromEntries(
    Object.entries(ROUTE_BY_TAB.montador).map(([tab, route]) => [route, tab])
  ) as Record<string, NavTab>,
};

// A bottom bar agora vive SÓ dentro do navigator de abas (5 abas reais). Telas
// de detalhe/perfil/notificações são telas de stack ACIMA das abas e cobrem a
// barra naturalmente — não há mais necessidade de esconder a barra por rota
// (o antigo HIDDEN_ROUTES foi removido junto com a migração para stack real).

type Props = BottomTabBarProps & {
  variant: Variant;
  messagesBadge?: number;
  requestsBadge?: number;
};

export function DBottomTabBar({ state, navigation, variant, messagesBadge, requestsBadge }: Props) {
  const currentRoute = state.routes[state.index]?.name;
  const activeTab = TAB_BY_ROUTE[variant][currentRoute] ?? null;
  const user = useAuth((auth) => auth.user);
  const role = user?.role ?? (variant === "montador" ? "MONTADOR" : variant === "diarista" ? "DIARISTA" : "EMPREGADOR");
  const profileTheme = getProfileTheme({
    role,
    // FASE 4 — gênero só de user.genero; empregador não tematiza por gênero.
    genero: variant === "empregador" ? undefined : user?.genero,
  });

  const handlePress = useCallback(
    (tab: NavTab) => {
      const target = ROUTE_BY_TAB[variant][tab];
      if (!target) return;

      navigation.navigate(target as never);
    },
    [navigation, variant]
  );

  return (
    <View style={styles.floating} pointerEvents="box-none">
      <DBottomNav
        activeTab={activeTab}
        variant={variant}
        messagesBadge={messagesBadge}
        requestsBadge={requestsBadge}
        profileTheme={profileTheme}
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
