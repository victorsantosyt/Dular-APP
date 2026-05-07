import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import DiaristaHome from "@/screens/diarista/DiaristaHome";
import DiaristaSolicitacoes from "@/screens/diarista/DiaristaSolicitacoes";
import DiaristaCarteira from "@/screens/diarista/DiaristaCarteira";
import DiaristaPerfilStack from "@/navigation/DiaristaPerfilStack";
import DiaristaDetalhe from "@/screens/diarista/DiaristaDetalhe";
import ReportIncident from "@/screens/perfil/ReportIncident";
import ChatScreen from "@/screens/chat/ChatScreen";
import { DIARISTA_STACK_ROUTES, PERFIL_STACK_ROUTES, TAB_ROUTES } from "@/navigation/routes";
import { colors, gradients, radius, shadow } from "@/theme/tokens";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const AgendamentosStack = createNativeStackNavigator();

const DIARISTA_TABS = {
  AGENDAMENTOS: "Agendamentos",
  MENSAGENS: "Mensagens",
} as const;

const TAB_SIZES = {
  tabBarHeight: 82,
  maxSafeBottom: 14,
  centerButton: 54,
  inactiveIcon: 23,
  activeIcon: 25,
};

type Props = { onLogout: () => void };
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
type DiaristaTabBarItem = {
  route: string;
  label: string;
  icon: IoniconName;
  outlineIcon: IoniconName;
  center?: boolean;
  badge?: string;
};

function DiaristaHomeStack() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="DiaristaHome" component={DiaristaHome} />
    </HomeStack.Navigator>
  );
}

function DiaristaAgendamentosStack() {
  return (
    <AgendamentosStack.Navigator screenOptions={{ headerShown: false }}>
      <AgendamentosStack.Screen name={DIARISTA_STACK_ROUTES.SOLICITACOES} component={DiaristaSolicitacoes} />
      <AgendamentosStack.Screen name={DIARISTA_STACK_ROUTES.DETALHE} component={DiaristaDetalhe} />
      <AgendamentosStack.Screen name={DIARISTA_STACK_ROUTES.CHAT} component={ChatScreen} />
      <AgendamentosStack.Screen name={PERFIL_STACK_ROUTES.REPORT_INCIDENT} component={ReportIncident} />
    </AgendamentosStack.Navigator>
  );
}

function DiaristaMensagensResumo() {
  return (
    <View style={styles.messagesScreen}>
      <View style={styles.messagesHeader}>
        <Text allowFontScaling={false} style={styles.messagesTitle}>Mensagens</Text>
        <Text allowFontScaling={false} style={styles.messagesSubtitle}>Suas conversas e solicitações aparecem aqui.</Text>
      </View>

      <View style={styles.messagesCard}>
        <View style={styles.messagesIcon}>
          <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.primary} />
        </View>
        <View style={styles.messagesCopy}>
          <Text allowFontScaling={false} style={styles.messagesCardTitle}>2 conversas recentes</Text>
          <Text allowFontScaling={false} style={styles.messagesCardText}>
            Acompanhe novas solicitações e combine detalhes com os clientes.
          </Text>
        </View>
      </View>
    </View>
  );
}

function DiaristaSoftTabBar({ state, navigation, insets }: BottomTabBarProps & { insets: { bottom: number } }) {
  const activeRoute = state.routes[state.index]?.name;
  const safeBottom = Math.max(insets.bottom, 0);
  const cappedSafeBottom = Math.min(safeBottom, TAB_SIZES.maxSafeBottom);
  const items: DiaristaTabBarItem[] = [
    {
      route: TAB_ROUTES.HOME,
      label: "Início",
      icon: "home",
      outlineIcon: "home-outline",
    },
    {
      route: DIARISTA_TABS.AGENDAMENTOS,
      label: "Agendamentos",
      icon: "calendar",
      outlineIcon: "calendar-outline",
    },
    {
      route: DIARISTA_TABS.AGENDAMENTOS,
      label: "Novo",
      icon: "add",
      outlineIcon: "add",
      center: true,
    },
    {
      route: DIARISTA_TABS.MENSAGENS,
      label: "Mensagens",
      icon: "chatbubble",
      outlineIcon: "chatbubble-outline",
      badge: "2",
    },
    {
      route: TAB_ROUTES.PERFIL,
      label: "Perfil",
      icon: "person",
      outlineIcon: "person-outline",
    },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: TAB_SIZES.tabBarHeight + cappedSafeBottom,
          paddingBottom: 8 + cappedSafeBottom,
        },
      ]}
    >
      {items.map((item) => {
        const focused = activeRoute === item.route;

        if (item.center) {
          return (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.centerTabItem, pressed && styles.pressed]}
              onPress={() => navigation.navigate(item.route as never)}
            >
              <LinearGradient
                colors={gradients.button}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.centerButton}
              >
                <Ionicons name="add" size={28} color={colors.surface} />
              </LinearGradient>
              <Text
                allowFontScaling={false}
                style={styles.centerLabel}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                Novo
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.tabItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate(item.route as never)}
          >
            <View style={[styles.activeIndicator, focused && styles.activeIndicatorVisible]} />
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={focused ? item.icon : item.outlineIcon}
                size={focused ? TAB_SIZES.activeIcon : TAB_SIZES.inactiveIcon}
                color={focused ? colors.primary : colors.textSecondary}
              />
              {item.badge ? (
                <View style={styles.tabBadge}>
                  <Text allowFontScaling={false} style={styles.tabBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.tabLabel, focused && styles.tabLabelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function DiaristaTabs({ onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const [homeKey, setHomeKey] = useState(0);

  return (
    <Tab.Navigator
      tabBar={(props) => <DiaristaSoftTabBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name={TAB_ROUTES.HOME}
        children={() => <DiaristaHomeStack key={homeKey} />}
        listeners={{
          tabPress: () => {
            setHomeKey((key) => key + 1);
          },
        }}
        options={{ title: TAB_ROUTES.HOME }}
      />
      <Tab.Screen
        name={DIARISTA_TABS.AGENDAMENTOS}
        component={DiaristaAgendamentosStack}
        options={{ title: DIARISTA_TABS.AGENDAMENTOS }}
      />
      <Tab.Screen
        name={TAB_ROUTES.CARTEIRA}
        component={DiaristaCarteira}
        options={{ title: TAB_ROUTES.CARTEIRA }}
      />
      <Tab.Screen
        name={DIARISTA_TABS.MENSAGENS}
        component={DiaristaMensagensResumo}
        options={{ title: DIARISTA_TABS.MENSAGENS }}
      />
      <Tab.Screen
        name={TAB_ROUTES.PERFIL}
        children={() => <DiaristaPerfilStack onLogout={onLogout} />}
        options={{ title: TAB_ROUTES.PERFIL }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 8,
    paddingHorizontal: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    ...shadow.floating,
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  activeIndicator: {
    position: "absolute",
    top: 0,
    width: 54,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: "transparent",
  },
  activeIndicatorVisible: {
    backgroundColor: colors.primary,
  },
  tabIconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadge: {
    position: "absolute",
    top: -4,
    right: 8,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  tabBadgeText: {
    color: colors.surface,
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "800",
  },
  tabLabel: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    width: "100%",
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  centerTabItem: {
    flex: 0.92,
    height: 68,
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: -20,
  },
  centerButton: {
    width: TAB_SIZES.centerButton,
    height: TAB_SIZES.centerButton,
    borderRadius: TAB_SIZES.centerButton / 2,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.primaryButton,
  },
  centerLabel: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    width: "100%",
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  messagesScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 76,
    paddingBottom: 144,
  },
  messagesHeader: {
    marginBottom: 24,
  },
  messagesTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.primaryDark,
    letterSpacing: 0,
  },
  messagesSubtitle: {
    marginTop: 6,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  messagesCard: {
    minHeight: 128,
    borderRadius: radius.xl,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  messagesIcon: {
    width: 62,
    height: 62,
    borderRadius: radius.xl,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  messagesCopy: {
    flex: 1,
    marginLeft: 16,
  },
  messagesCardTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  messagesCardText: {
    marginTop: 5,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    color: colors.textSecondary,
  },
});
