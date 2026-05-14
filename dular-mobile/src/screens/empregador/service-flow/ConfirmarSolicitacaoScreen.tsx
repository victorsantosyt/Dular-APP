import React, { useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { criarServico, prepararPayload } from "@/api/empregadorApi";
import { SERVICE_LABELS, useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader, SummaryCard } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "ConfirmarSolicitacao">;

function formatDate(value: string) {
  if (!value) return "Data não definida";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function ConfirmarSolicitacaoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft } = useServiceFlow();
  const [submitting, setSubmitting] = useState(false);
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const isMontador = draft.tipo === "MONTADOR";

  const confirmRequest = async () => {
    const prepared = prepararPayload(draft);
    if (!prepared.ok) {
      Alert.alert("Não foi possível confirmar", prepared.error);
      return;
    }

    try {
      setSubmitting(true);
      const result = await criarServico(prepared.payload);
      navigation.navigate("SolicitacaoSucesso", { servicoId: result.servicoId });
    } catch {
      Alert.alert("Falha ao enviar", "Não foi possível criar a solicitação agora.");
    } finally {
      setSubmitting(false);
    }
  };

  const address = [
    "Rua Oscar Freire, 245",
    draft.numero ? `número ${draft.numero}` : null,
    "Jardim América, São Paulo - SP",
    "CEP 01426-001",
  ]
    .filter(Boolean)
    .join("\n");
  const rows = useMemo(() => {
    if (isMontador) {
      return [
        { label: "Especialidade", value: draft.especialidadeLabel ?? "Especialidade não selecionada", icon: "Wrench" as const },
        { label: "Descrição", value: draft.observacoes || "Descrição não informada.", icon: "FileText" as const },
        { label: "Data e horário", value: `${formatDate(draft.dataISO)} às ${draft.horario || "--:--"}`, icon: "Calendar" as const },
        { label: "Endereço", value: address, icon: "MapPin" as const },
        { label: "Profissional", value: draft.profissionalNome ?? "Profissional selecionado", icon: "User" as const },
      ];
    }

    return [
      { label: "Serviço", value: SERVICE_LABELS[draft.categoria], icon: "BriefcaseBusiness" as const },
      { label: "Data e horário", value: `${formatDate(draft.dataISO)} às ${draft.horario || "--:--"}`, icon: "Calendar" as const },
      { label: "Endereço", value: address, icon: "MapPin" as const },
      { label: "Observações", value: draft.observacoes || "Nenhuma observação adicionada.", icon: "FileText" as const },
    ];
  }, [address, draft, isMontador]);

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Confirmar solicitação"
          subtitle="Revise tudo antes de enviar para os profissionais."
          step={5}
          total={5}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        <SummaryCard rows={rows} theme={flowTheme} />

        <DCard style={[s.priceCard, { backgroundColor: flowTheme.primarySoft }]}>
          <View>
            <Text style={s.priceLabel}>Valor estimado</Text>
            <Text style={[s.priceValue, { color: flowTheme.textAccent }]}>{isMontador ? "A orçar" : "R$ 160,00"}</Text>
          </View>
          <Text style={s.priceHint}>Pagamento após confirmação</Text>
        </DCard>
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton
          label="Confirmar solicitação"
          theme={flowTheme}
          loading={submitting}
          onPress={confirmRequest}
        />
        <Text style={s.editLink} onPress={() => navigation.navigate("EscolherServico")}>Editar informações</Text>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  priceCard: {
    marginTop: 14,
    borderRadius: radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priceValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
  },
  priceHint: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "right",
  },
  editLink: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
