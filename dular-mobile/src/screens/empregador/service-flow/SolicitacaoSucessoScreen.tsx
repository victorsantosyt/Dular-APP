import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DButton } from "@/components/ui/DButton";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { goToTab } from "@/navigation/navHelpers";
import { colors, radius, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, SuccessBadge } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "SolicitacaoSucesso">;
type RouteParams = RouteProp<EmpregadorServiceFlowStackParamList, "SolicitacaoSucesso">;

/** Deriva um protocolo legível a partir do servicoId real.
 *  Ex.: servicoId = "abc123..." → "#DL-ABC123" */
function derivarProtocolo(servicoId: string): string {
  const sufixo = servicoId.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `#DL-${sufixo}`;
}

export function SolicitacaoSucessoScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteParams>();
  const { draft, resetDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);

  // servicoId vem do param da rota (passado por ConfirmarSolicitacaoScreen após
  // criação bem-sucedida). Se ausente (navegação direta em dev), omite o bloco.
  const servicoId = route.params?.servicoId;

  const goHome = () => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) goToTab(parent, "EmpregadorTabs", "Home");
  };

  const acompanharSolicitacoes = () => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) goToTab(parent, "EmpregadorTabs", "Agendamentos");
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

        {servicoId ? (
          <DCard style={s.protocolCard}>
            <Text style={s.protocolLabel}>Protocolo</Text>
            <Text style={s.protocolValue}>{derivarProtocolo(servicoId)}</Text>
            <View style={[s.statusPill, { backgroundColor: flowTheme.primarySoft }]}>
              <Text style={[s.statusText, { color: flowTheme.primary }]}>Enviado agora</Text>
            </View>
          </DCard>
        ) : null}
      </View>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Acompanhar solicitações" theme={flowTheme} onPress={acompanharSolicitacoes} />
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
    width: "88%",
    maxWidth: 336,
    alignSelf: "center",
    marginTop: 10,
  },
});
