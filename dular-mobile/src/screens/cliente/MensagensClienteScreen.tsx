import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DAvatar, DBottomNav, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { ClienteTabParamList } from "@/navigation/ClienteNavigator";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";

type Navigation = BottomTabNavigationProp<ClienteTabParamList>;
type Filtro = "todas" | "ativas" | "finalizadas";

type Conversa = {
  id: string;
  nome: string;
  avatarUrl: string;
  online: boolean;
  servico: string;
  bairro: string;
  dataHora: string;
  status: "Ativa" | "Finalizada";
  ultimaMensagem: string;
  horario: string;
  naoLidas: number;
};

const TABS: { value: Filtro; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "ativas", label: "Ativas" },
  { value: "finalizadas", label: "Finalizadas" },
];

const CONVERSAS: Conversa[] = [
  {
    id: "1",
    nome: "Luciana Silva",
    avatarUrl: "",
    online: true,
    servico: "Faxina completa",
    bairro: "Jardim América",
    dataHora: "Hoje, 14:00",
    status: "Ativa",
    ultimaMensagem: "Confirmo o serviço para amanhã no período da manhã.",
    horario: "09:17",
    naoLidas: 2,
  },
  {
    id: "2",
    nome: "Marina Santos",
    avatarUrl: "",
    online: true,
    servico: "Cozinha semanal",
    bairro: "Vila Mariana",
    dataHora: "Amanhã, 09:00",
    status: "Ativa",
    ultimaMensagem: "Posso adaptar o cardápio conforme sua preferência.",
    horario: "08:42",
    naoLidas: 0,
  },
  {
    id: "3",
    nome: "Renata Lima",
    avatarUrl: "",
    online: false,
    servico: "Passadoria",
    bairro: "Moema",
    dataHora: "Seg, 10:00",
    status: "Finalizada",
    ultimaMensagem: "Serviço concluído. Fico à disposição para uma próxima agenda.",
    horario: "Ontem",
    naoLidas: 0,
  },
];

function EmptyState() {
  return (
    <DCard style={styles.emptyCard}>
      <AppIcon name="MessageCircle" size={34} color="purple" variant="filled" />
      <Text style={styles.emptyTitle}>Nenhuma conversa por aqui</Text>
      <Text style={styles.emptySubtitle}>
        Suas conversas com profissionais aparecerão assim que um serviço for combinado.
      </Text>
    </DCard>
  );
}

function TabPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabPill, active ? styles.tabPillActive : styles.tabPillIdle]}>
      <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ConversaCard({ conversa }: { conversa: Conversa }) {
  const navigation = useNavigation<Navigation>();

  const params: ChatAbertoParams = {
    conversaId: conversa.id,
    nome: conversa.nome,
    avatarUrl: conversa.avatarUrl,
    online: conversa.online,
    servico: conversa.servico,
    dataHora: conversa.dataHora,
    bairro: conversa.bairro,
    status: conversa.status === "Ativa" ? "Confirmado" : "Finalizado",
    papel: "cliente",
  };

  return (
    <Pressable
      onPress={() => navigation.navigate("ChatAberto", params)}
      style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
    >
      <DCard style={styles.conversaCard}>
        <DAvatar
          size="lg"
          uri={conversa.avatarUrl}
          initials={conversa.nome.slice(0, 2)}
          online={conversa.online}
        />

        <View style={styles.conversaCenter}>
          <View style={styles.nameRow}>
            <Text style={styles.nome} numberOfLines={1}>{conversa.nome}</Text>
            <View style={[styles.statusPill, conversa.status === "Ativa" ? styles.statusAtiva : styles.statusFinalizada]}>
              <Text style={[styles.statusText, conversa.status === "Ativa" ? styles.statusTextAtiva : styles.statusTextFinalizada]}>
                {conversa.status}
              </Text>
            </View>
          </View>

          <Text style={styles.ultimaMensagem} numberOfLines={2}>
            {conversa.ultimaMensagem}
          </Text>

          <View style={styles.metaRow}>
            <AppIcon name="Calendar" size={12} color={colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{conversa.servico}</Text>
          </View>
        </View>

        <View style={styles.conversaRight}>
          <Text style={styles.horario}>{conversa.horario}</Text>
          {conversa.naoLidas > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{conversa.naoLidas}</Text>
            </View>
          ) : null}
          <AppIcon name="ChevronRight" size={17} color={colors.textMuted} strokeWidth={2.4} />
        </View>
      </DCard>
    </Pressable>
  );
}

export function MensagensClienteScreen() {
  const navigation = useNavigation<Navigation>();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const conversas = useMemo(() => {
    if (filtro === "ativas") return CONVERSAS.filter((item) => item.status === "Ativa");
    if (filtro === "finalizadas") return CONVERSAS.filter((item) => item.status === "Finalizada");
    return CONVERSAS;
  }, [filtro]);

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "search") navigation.navigate("Buscar");
    if (tab === "new") navigation.navigate("SolicitarServico");
    if (tab === "profile") navigation.navigate("Perfil");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mensagens</Text>
          <Text style={styles.subtitle}>Acompanhe suas conversas e serviços.</Text>
        </View>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <TabPill
              key={tab.value}
              label={tab.label}
              active={filtro === tab.value}
              onPress={() => setFiltro(tab.value)}
            />
          ))}
        </View>

        <FlatList
          data={conversas}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversaCard conversa={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState />}
        />

        <DBottomNav activeTab="messages" messagesBadge={2} onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default MensagensClienteScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  tabsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  tabPill: {
    minHeight: 38,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  tabText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
  },
  tabTextActive: {
    color: colors.white,
  },
  tabTextIdle: {
    color: colors.textSecondary,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: 116,
  },
  separator: {
    height: spacing.sm,
  },
  cardPressable: {
    borderRadius: radius.xl,
  },
  pressed: {
    opacity: 0.92,
  },
  conversaCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.xl,
  },
  conversaCenter: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  nome: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusAtiva: {
    backgroundColor: colors.primaryLight,
  },
  statusFinalizada: {
    backgroundColor: colors.surfaceAlt,
  },
  statusText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
  },
  statusTextAtiva: {
    color: colors.primary,
  },
  statusTextFinalizada: {
    color: colors.textSecondary,
  },
  ultimaMensagem: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  metaRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  conversaRight: {
    minWidth: 44,
    alignItems: "flex-end",
    alignSelf: "stretch",
    justifyContent: "space-between",
  },
  horario: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.textMuted,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pink,
    ...shadows.soft,
  },
  unreadText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: colors.white,
  },
  emptyCard: {
    marginTop: spacing["4xl"],
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.xs,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },
});
