import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DButton } from "@/components/ui/DButton";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, SuccessBadge } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "SolicitacaoSucesso">;

export function SolicitacaoSucessoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, resetDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);

  const goHome = () => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) parent.navigate("Home");
  };

  return (
    <SafeAreaView style={flowStyles.screen}>
      <View style={s.content}>
        <SuccessBadge theme={flowTheme} />
        <View style={s.copy}>
          <Text style={s.title}>Solicitação enviada com sucesso</Text>
          <Text style={s.subtitle}>
            Avisaremos assim que o profissional responder sua solicitação.
          </Text>
        </View>

        <DCard style={s.protocolCard}>
          <Text style={s.protocolLabel}>Protocolo</Text>
          <Text style={s.protocolValue}>#SD250514-8K7D</Text>
          <View style={[s.statusPill, { backgroundColor: flowTheme.primarySoft }]}>
            <Text style={[s.statusText, { color: flowTheme.primary }]}>Enviado há 1 min</Text>
          </View>
        </DCard>
      </View>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Acompanhar solicitação" theme={flowTheme} onPress={goHome} />
        <DButton label="Voltar ao início" variant="ghost" onPress={goHome} style={s.secondaryButton} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: 18,
  },
  copy: {
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
  },
  protocolCard: {
    width: "100%",
    borderRadius: radius.xl,
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
  },
  protocolLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  protocolValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  statusPill: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
  },
});
