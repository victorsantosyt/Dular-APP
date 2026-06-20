/**
 * AcoesRapidasEmpregadorScreen
 *
 * Tela sem backend: lista atalhos para as principais rotas do empregador.
 * Apenas rotas REAIS já registradas no Navigator. Sem inventar telas.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { AppIcon, type AppIconName, DScreenHeader } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

type AcaoRapida = {
  key: string;
  icon: AppIconName;
  label: string;
  description: string;
  /** "danger" destaca a ação (ex.: SOS) com a cor de emergência. */
  tone?: "default" | "danger";
  onPress: (navigation: Navigation) => void;
};

const ACOES: AcaoRapida[] = [
  {
    key: "buscar",
    icon: "Search",
    label: "Buscar profissional",
    description: "Encontre diaristas, montadores, babás e cozinheiras.",
    onPress: (navigation) => navigation.navigate("Buscar"),
  },
  {
    key: "agendamentos",
    icon: "Calendar",
    label: "Meus agendamentos",
    description: "Acompanhe os serviços ativos e pedidos em andamento.",
    onPress: (navigation) => navigation.navigate("Agendamentos"),
  },
  {
    key: "favoritos",
    icon: "Heart",
    label: "Favoritos",
    description: "Profissionais que você quer contratar de novo.",
    onPress: (navigation) => navigation.navigate("Favoritos"),
  },
  {
    key: "historico",
    icon: "Clock",
    label: "Histórico",
    description: "Serviços concluídos ou cancelados.",
    onPress: (navigation) => navigation.navigate("Historico"),
  },
  {
    key: "notificacoes",
    icon: "Bell",
    label: "Notificações",
    description: "Atualizações, mensagens e alertas dos seus serviços.",
    onPress: (navigation) => navigation.navigate("Notificacoes"),
  },
  {
    key: "perfil",
    icon: "User",
    label: "Perfil",
    description: "Edite seus dados pessoais e preferências.",
    onPress: (navigation) => navigation.navigate("Perfil"),
  },
  {
    key: "sos",
    icon: "AlertTriangle",
    label: "SOS / Emergência",
    description: "Acione ajuda e registre uma ocorrência com urgência.",
    tone: "danger",
    onPress: (navigation) => navigation.navigate("SosFlow"),
  },
];

function AcaoCard({ item }: { item: AcaoRapida }) {
  const navigation = useNavigation<Navigation>();
  const danger = item.tone === "danger";
  return (
    <Pressable
      onPress={() => item.onPress(navigation)}
      style={({ pressed }) => [s.card, danger && s.cardDanger, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.iconWrap, danger && s.iconWrapDanger]}>
        <AppIcon
          name={item.icon}
          size={22}
          color={danger ? colors.danger : colors.primary}
          strokeWidth={2.1}
        />
      </View>
      <View style={s.cardText}>
        <Text style={[s.cardLabel, danger && s.cardLabelDanger]} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={s.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <AppIcon
        name="ChevronRight"
        size={18}
        color={colors.textMuted}
        strokeWidth={2}
      />
    </Pressable>
  );
}

export function AcoesRapidasEmpregadorScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <DScreenHeader
        title="Ações rápidas"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        <Text style={s.intro}>
          Atalhos para o que você mais usa no dia a dia.
        </Text>
        <View style={s.list}>
          {ACOES.map((item) => (
            <AcaoCard key={item.key} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default AcoesRapidasEmpregadorScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 120,
    gap: spacing.md,
  },
  intro: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.soft,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.lavenderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDanger: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  iconWrapDanger: {
    backgroundColor: colors.surface,
  },
  cardLabelDanger: {
    color: colors.dangerDark,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
