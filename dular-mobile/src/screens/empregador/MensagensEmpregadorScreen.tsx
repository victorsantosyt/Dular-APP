import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DCard } from "@/components/ui";
import { useMensagens } from "@/hooks/useMensagens";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  ConversationCard,
  ConversationItem,
  EmptyArchiveState,
  MessagesTab,
  MessagesTabs,
} from "./messages/components";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const MOCK_CONVERSATIONS: ConversationItem[] = [
  {
    id: "room-luciana-silva",
    servicoId: "servico-mock-luciana",
    nome: "Luciana Silva",
    categoria: "Diarista",
    categoriaIcon: "BrushCleaning",
    localizacao: "Jardim América, SP",
    rating: "4.9",
    experiencia: "5 anos",
    horario: "14:32",
    initials: "LS",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "room-juliana-castro",
    servicoId: "servico-mock-juliana",
    nome: "Juliana Castro",
    categoria: "Babá",
    categoriaIcon: "Baby",
    localizacao: "Vila Mariana, SP",
    rating: "4.8",
    experiencia: "3 anos",
    horario: "13:15",
    initials: "JC",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "room-renata-lima",
    servicoId: "servico-mock-renata",
    nome: "Renata Lima",
    categoria: "Cozinheira",
    categoriaIcon: "ChefHat",
    localizacao: "Moema, SP",
    rating: "4.9",
    experiencia: "7 anos",
    horario: "11:07",
    initials: "RL",
    avatarUrl: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "room-carla-souza",
    servicoId: "servico-mock-carla",
    nome: "Carla Souza",
    categoria: "Exp",
    categoriaIcon: "UserRound",
    localizacao: "Perdizes, SP",
    rating: "4.7",
    experiencia: "4 anos",
    horario: "Hoje",
    initials: "CS",
    avatarUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "room-marina-santos",
    servicoId: "servico-mock-marina",
    nome: "Marina Santos",
    categoria: "Diarista",
    categoriaIcon: "BrushCleaning",
    localizacao: "Pinheiros, SP",
    rating: "4.8",
    experiencia: "6 anos",
    horario: "Ontem",
    initials: "MS",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
  {
    id: "room-aline-ferreira",
    servicoId: "servico-mock-aline",
    nome: "Aline Ferreira",
    categoria: "Babá",
    categoriaIcon: "Baby",
    localizacao: "Itaim Bibi, SP",
    rating: "4.9",
    experiencia: "2 anos",
    horario: "Ontem",
    initials: "AF",
    avatarUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&facepad=2&w=180&h=180&q=80",
  },
];

export function MensagensEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();
  const [activeTab, setActiveTab] = useState<MessagesTab>("conversas");
  const { rooms } = useMensagens();

  const visibleConversations = useMemo(
    () => (activeTab === "conversas" ? MOCK_CONVERSATIONS : []),
    [activeTab],
  );

  const openChat = useCallback(
    (item: ConversationItem) => {
      navigation.navigate("ChatAberto", {
        roomId: item.id,
        servicoId: item.servicoId,
        nomeUsuario: item.nome,
      });
    },
    [navigation],
  );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.root}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          <View style={s.header}>
            <View style={s.headerCopy}>
              <Text style={s.title}>Mensagens</Text>
              <Text style={s.subtitle}>
                Converse com os profissionais que confirmaram suas solicitações.
              </Text>
            </View>
          </View>

          <MessagesTabs activeTab={activeTab} onChange={setActiveTab} />

          <DCard style={s.infoCard}>
            <View style={s.infoIcon}>
              <AppIcon name="MessageCircle" size={30} color={colors.primary} strokeWidth={2.1} />
              <View style={s.infoCheck}>
                <AppIcon name="CheckCircle" size={16} color={colors.primary} strokeWidth={2.4} />
              </View>
            </View>
            <View style={s.infoCopy}>
              <Text style={s.infoTitle}>Profissionais que confirmaram</Text>
              <Text style={s.infoText}>Inicie uma conversa para combinar os detalhes do serviço.</Text>
            </View>
          </DCard>

          {activeTab === "arquivadas" ? (
            <EmptyArchiveState />
          ) : (
            <View style={s.list}>
              {visibleConversations.map((item) => (
                <ConversationCard key={item.id} item={item} onPress={() => openChat(item)} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

export default MensagensEmpregadorScreen;

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
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.primaryDark,
    ...typography.h1,
    
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    maxWidth: 275,
    color: colors.textSecondary,
    ...typography.bodySm,
    
    fontWeight: "500",
  },

  infoCard: {
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavenderDivider,
    ...shadows.soft,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  infoCheck: {
    position: "absolute",
    right: 4,
    bottom: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    color: colors.primaryDark,
    ...typography.bodySmMedium,
    
    fontWeight: "700",
  },
  infoText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  list: {
    gap: 8,
  },
});
