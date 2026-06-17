import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, type AppIconName, BackCircleButton, DAvatar, DCard } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme";
import { getProfileTheme } from "@/theme/profileTheme";
import { useAuth } from "@/stores/authStore";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

/**
 * DadosContaScreen — "Dados da conta" do empregador (foto, nome, telefone…).
 * Somente leitura; a edição continua no perfil. Identidade visual roxa.
 */

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const THEME = getProfileTheme({ role: "EMPREGADOR" });

function generoLabel(g?: string | null): string {
  if (g === "FEMININO") return "Feminino";
  if (g === "MASCULINO") return "Masculino";
  return "Não informado";
}

export function DadosContaScreen() {
  const navigation = useNavigation<Navigation>();
  const user = useAuth((state) => state.user);

  const nome = (user?.nome || "").trim() || "Não informado";
  const initials = nome.slice(0, 2).toUpperCase();

  const linhas: { icon: AppIconName; label: string; value: string }[] = [
    { icon: "User", label: "Nome completo", value: nome },
    { icon: "Phone", label: "Telefone", value: (user?.telefone || "").trim() || "Não informado" },
    { icon: "FileText", label: "E-mail", value: (user?.email || "").trim() || "Não informado" },
    { icon: "UserRound", label: "Gênero", value: generoLabel(user?.genero) },
  ];

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <View style={s.header}>
        <Text style={s.title}>Dados da conta</Text>
        <BackCircleButton onPress={() => navigation.navigate("Perfil")} color={THEME.icon} borderColor={THEME.border} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Foto + nome */}
        <View style={s.hero}>
          <View style={s.avatarRing}>
            <DAvatar size="xl" uri={user?.avatarUrl ?? undefined} initials={initials} />
          </View>
          <Text style={s.heroName}>{nome}</Text>
          <Text style={s.heroRole}>Empregador</Text>
        </View>

        {/* Informações */}
        <DCard style={s.card}>
          {linhas.map((l, i) => (
            <View key={l.label} style={[s.row, i < linhas.length - 1 && s.rowDivider]}>
              <View style={s.rowIcon}>
                <AppIcon name={l.icon} size={18} color={THEME.primary} strokeWidth={2.1} />
              </View>
              <View style={s.rowText}>
                <Text style={s.rowLabel}>{l.label}</Text>
                <Text style={s.rowValue}>{l.value}</Text>
              </View>
            </View>
          ))}
        </DCard>

        <Text style={s.note}>
          Para editar foto, nome ou telefone, use “Nome, telefone e foto” no seu perfil.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

export default DadosContaScreen;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  scroll: { paddingHorizontal: spacing.screenPadding, paddingBottom: 122, gap: 16 },

  hero: { alignItems: "center", gap: 8, paddingTop: 12 },
  avatarRing: {
    borderWidth: 2,
    borderColor: THEME.primary,
    borderRadius: 999,
    padding: 3,
  },
  heroName: { ...typography.title, fontWeight: "800", color: colors.textPrimary, marginTop: 2 },
  heroRole: {
    ...typography.caption,
    fontWeight: "700",
    color: THEME.textAccent,
    backgroundColor: THEME.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  card: { padding: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: THEME.border },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.primarySoft,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  rowValue: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "700" },

  note: { ...typography.caption, color: colors.textMuted, fontWeight: "500", textAlign: "center", paddingHorizontal: 16 },
});
