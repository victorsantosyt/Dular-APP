import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DAvatar, DBottomNav, DButton, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

type Solicitacao = {
  id: string;
  cliente: string;
  avatarUrl: string;
  online: boolean;
  servico: string;
  bairro: string;
  horario: string;
  dataHora: string;
  status: "Nova" | "Em conversa" | "Confirmada";
  descricao: string;
};

const SOLICITACOES: Solicitacao[] = [
  {
    id: "1",
    cliente: "Carolina Mendes",
    avatarUrl: "",
    online: true,
    servico: "Faxina completa",
    bairro: "Jardim América",
    horario: "09:20",
    dataHora: "Hoje, 14:00 - 18:00",
    status: "Nova",
    descricao: "Solicitação próxima ao seu bairro para hoje à tarde.",
  },
  {
    id: "2",
    cliente: "Juliana Pereira",
    avatarUrl: "",
    online: true,
    servico: "Limpeza geral",
    bairro: "Moema",
    horario: "08:48",
    dataHora: "Amanhã, 09:00 - 13:00",
    status: "Em conversa",
    descricao: "Cliente pediu confirmação sobre materiais de limpeza.",
  },
  {
    id: "3",
    cliente: "Fernanda Costa",
    avatarUrl: "",
    online: false,
    servico: "Passadoria",
    bairro: "Vila Mariana",
    horario: "Ontem",
    dataHora: "Sex, 10:00 - 13:00",
    status: "Confirmada",
    descricao: "Serviço confirmado aguardando o horário agendado.",
  },
];

function statusColor(status: Solicitacao["status"]) {
  if (status === "Nova") return { bg: colors.pinkSoft, fg: colors.pink };
  if (status === "Em conversa") return { bg: colors.primaryLight, fg: colors.primary };
  return { bg: colors.greenSoft, fg: colors.success };
}

function HeaderCard() {
  return (
    <LinearGradient
      colors={[colors.primary, colors.pink]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.topCard}
    >
      <View style={styles.topCardIcon}>
        <AppIcon name="MessageCircle" size={24} color={colors.white} strokeWidth={2.4} />
      </View>
      <View style={styles.topCardCopy}>
        <Text style={styles.topCardTitle}>3 novas conversas</Text>
        <Text style={styles.topCardText}>
          Responda clientes recentes e mantenha sua agenda organizada.
        </Text>
      </View>
    </LinearGradient>
  );
}

function EmptyState() {
  return (
    <DCard style={styles.emptyCard}>
      <AppIcon name="MessageCircle" size={34} color="pink" variant="filled" />
      <Text style={styles.emptyTitle}>Nenhuma solicitação aberta</Text>
      <Text style={styles.emptySubtitle}>
        Novas conversas de clientes aparecerão aqui quando chegarem.
      </Text>
    </DCard>
  );
}

function SolicitacaoCard({ solicitacao }: { solicitacao: Solicitacao }) {
  const navigation = useNavigation<Navigation>();
  const status = statusColor(solicitacao.status);

  const params: ChatAbertoParams = {
    conversaId: solicitacao.id,
    nome: solicitacao.cliente,
    avatarUrl: solicitacao.avatarUrl,
    online: solicitacao.online,
    servico: solicitacao.servico,
    dataHora: solicitacao.dataHora,
    bairro: solicitacao.bairro,
    status: solicitacao.status,
    papel: "diarista",
  };

  return (
    <DCard style={styles.requestCard}>
      <View style={styles.requestTop}>
        <DAvatar
          size="lg"
          uri={solicitacao.avatarUrl}
          initials={solicitacao.cliente.slice(0, 2)}
          online={solicitacao.online}
        />

        <View style={styles.requestCenter}>
          <View style={styles.requestNameRow}>
            <Text style={styles.clientName} numberOfLines={1}>{solicitacao.cliente}</Text>
            <Text style={styles.requestTime}>{solicitacao.horario}</Text>
          </View>
          <Text style={styles.requestDescription} numberOfLines={2}>
            {solicitacao.descricao}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <AppIcon name="Calendar" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{solicitacao.servico}</Text>
        </View>
        <View style={styles.infoItem}>
          <AppIcon name="MapPin" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{solicitacao.bairro}</Text>
        </View>
        <View style={styles.infoItem}>
          <AppIcon name="Clock" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText} numberOfLines={1}>{solicitacao.dataHora}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.fg }]}>{solicitacao.status}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerHint}>
          <AppIcon name="MessageCircle" size={14} color={colors.primary} />
          <Text style={styles.footerHintText}>Responder pelo chat Dular</Text>
        </View>
        <DButton
          label={solicitacao.status === "Nova" ? "Responder" : "Abrir chat"}
          size="sm"
          variant="primary"
          onPress={() => navigation.navigate("ChatAberto", params)}
          style={styles.ctaButton}
        />
      </View>
    </DCard>
  );
}

function TipCard() {
  return (
    <DCard style={styles.tipCard}>
      <View style={styles.tipIcon}>
        <AppIcon name="ShieldCheck" size={20} color="purple" />
      </View>
      <View style={styles.tipTextBlock}>
        <Text style={styles.tipTitle}>Atendimento rápido aumenta suas chances</Text>
        <Text style={styles.tipText}>
          Responda com clareza, confirme horário e mantenha todos os combinados no app.
        </Text>
      </View>
    </DCard>
  );
}

export function MensagensDiaristaScreen() {
  const navigation = useNavigation<Navigation>();

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "search") navigation.navigate("Agendamentos");
    if (tab === "new") navigation.navigate("Novo");
    if (tab === "profile") navigation.navigate("Perfil");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mensagens</Text>
          <Text style={styles.subtitle}>Converse com clientes e acompanhe solicitações.</Text>
        </View>

        <FlatList
          data={SOLICITACOES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <SolicitacaoCard solicitacao={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={<HeaderCard />}
          ListFooterComponent={<TipCard />}
          ListEmptyComponent={<EmptyState />}
        />

        <DBottomNav variant="diarista" activeTab="messages" messagesBadge={3} onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default MensagensDiaristaScreen;

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
  listContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 116,
  },
  separator: {
    height: spacing.sm,
  },
  topCard: {
    minHeight: 116,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.medium,
    shadowColor: colors.primary,
  },
  topCardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.whiteAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  topCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  topCardTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
    color: colors.white,
  },
  topCardText: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.whiteAlpha85,
  },
  requestCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  requestCenter: {
    flex: 1,
    minWidth: 0,
  },
  requestNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  clientName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  requestTime: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.textMuted,
  },
  requestDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  infoGrid: {
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  infoItem: {
    minHeight: 30,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  infoText: {
    maxWidth: 190,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  statusPill: {
    minHeight: 30,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
  },
  cardFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  footerHint: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  footerHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  ctaButton: {
    minWidth: 108,
  },
  tipCard: {
    marginTop: spacing.md,
    backgroundColor: colors.purpleSoft,
    borderColor: "rgba(124,92,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  tipTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: colors.primary,
  },
  tipText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.textSecondary,
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
