import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DBottomNav } from "@/components/ui";
import { useMensagens } from "@/hooks/useMensagens";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import {
  NotificationCard,
  NotificationItem,
  NotificationSection,
  NotificationTab,
  NotificationTabs,
} from "./notifications/components";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "sos-hoje",
    section: "Hoje",
    filter: "importantes",
    type: "SOS",
    title: "Alerta SOS recebido",
    text: "Uma ocorrência de emergência foi registrada. Toque para acompanhar os detalhes e o status do atendimento.",
    time: "Agora",
    icon: "AlertTriangle",
    tone: "urgent",
    badge: "Urgente",
    unread: true,
  },
  {
    id: "reclamacao-hoje",
    section: "Hoje",
    filter: "importantes",
    type: "Reclamação",
    title: "Resposta do chamado de reclamação",
    text: "Nossa equipe respondeu ao seu relato sobre o serviço #SD250514-8K7D. Veja a atualização.",
    time: "12 min",
    icon: "FileText",
    tone: "analysis",
    badge: "Em análise",
    unread: true,
  },
  {
    id: "sistema-hoje",
    section: "Hoje",
    filter: "sistema",
    type: "Sistema",
    title: "Melhorias no sistema",
    text: "Atualizamos a experiência de agendamento e notificações para deixar seu uso mais rápido e seguro.",
    time: "1 h",
    icon: "Sparkles",
    tone: "system",
  },
  {
    id: "solicitacao-hoje",
    section: "Hoje",
    filter: "importantes",
    type: "Solicitação",
    title: "Solicitação confirmada",
    text: "Sua solicitação para Diarista foi confirmada com sucesso. Acompanhe o andamento em Solicitações.",
    time: "2 h",
    icon: "CheckCircle",
    tone: "success",
    unread: true,
  },
  {
    id: "seguranca-ontem",
    section: "Ontem",
    filter: "sistema",
    type: "Segurança",
    title: "Atualização de segurança",
    text: "Seus dados continuam protegidos. Revise suas preferências e mantenha o app sempre atualizado.",
    time: "Ontem",
    icon: "ShieldCheck",
    tone: "security",
  },
  {
    id: "novidades-ontem",
    section: "Ontem",
    filter: "sistema",
    type: "Novidades",
    title: "Novidades do app Dular",
    text: "Conheça novos recursos que chegaram para facilitar sua rotina e melhorar sua experiência.",
    time: "Ontem",
    icon: "Megaphone",
    tone: "news",
  },
];

export function NotificacoesEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [activeTab, setActiveTab] = useState<NotificationTab>("todas");
  const { rooms } = useMensagens();

  const messagesBadge = useMemo(() => {
    const unread = rooms.reduce((total, room) => total + Math.max(0, Number(room.naoLidas) || 0), 0);
    return unread > 0 ? unread : undefined;
  }, [rooms]);

  const filtered = useMemo(() => {
    if (activeTab === "todas") return MOCK_NOTIFICATIONS;
    return MOCK_NOTIFICATIONS.filter((item) => item.filter === activeTab);
  }, [activeTab]);

  const grouped = useMemo(
    () => ({
      Hoje: filtered.filter((item) => item.section === "Hoje"),
      Ontem: filtered.filter((item) => item.section === "Ontem"),
    }),
    [filtered],
  );

  const handleBottomNav = useCallback(
    (tab: "home" | "search" | "new" | "messages" | "profile") => {
      if (tab === "home") navigation.navigate("Home");
      else if (tab === "search") navigation.navigate("Buscar");
      else if (tab === "new") navigation.navigate("SolicitarServico");
      else if (tab === "messages") navigation.navigate("Mensagens");
      else if (tab === "profile") navigation.navigate("Perfil");
    },
    [navigation],
  );

  const openNotification = (item: NotificationItem) => {
    Alert.alert(item.title, item.text);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.headerTop}>
            <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [s.roundButton, pressed && { opacity: 0.78 }]} hitSlop={10}>
              <AppIcon name="ArrowLeft" size={21} color={colors.textPrimary} strokeWidth={2.3} />
            </Pressable>
            <Text style={s.title}>Notificações</Text>
            <View style={s.bellButton}>
              <AppIcon name="Bell" size={21} color={colors.primary} strokeWidth={2.2} />
            </View>
          </View>

          <Text style={s.subtitle}>
            Acompanhe alertas, novidades e atualizações importantes.
          </Text>

          <NotificationTabs activeTab={activeTab} onChange={setActiveTab} />

          {grouped.Hoje.length > 0 ? (
            <NotificationSection title="Hoje">
              {grouped.Hoje.map((item) => (
                <NotificationCard key={item.id} item={item} onPress={() => openNotification(item)} />
              ))}
            </NotificationSection>
          ) : null}

          {grouped.Ontem.length > 0 ? (
            <NotificationSection title="Ontem">
              {grouped.Ontem.map((item) => (
                <NotificationCard key={item.id} item={item} onPress={() => openNotification(item)} />
              ))}
            </NotificationSection>
          ) : null}
        </ScrollView>

        <DBottomNav
          activeTab={null}
          variant="empregador"
          messagesBadge={messagesBadge}
          onPress={handleBottomNav}
        />
      </View>
    </SafeAreaView>
  );
}

export default NotificacoesEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 122,
    gap: 14,
  },
  headerTop: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  bellButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: 0,
    textAlign: "center",
  },
  subtitle: {
    marginTop: -5,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: spacing.md,
  },
});
