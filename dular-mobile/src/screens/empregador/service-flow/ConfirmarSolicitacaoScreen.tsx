import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DButton } from "@/components/ui/DButton";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { SERVICE_LABELS, useServiceFlow } from "./ServiceFlowContext";
import { flowStyles, StepHeader, SummaryCard } from "./components";

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

  const payloadPreview = useMemo(
    () => ({
      categoria: draft.categoria,
      data: draft.dataISO,
      horario: draft.horario,
      endereco: {
        rua: "Rua Oscar Freire, 245",
        bairro: "Jardim América",
        cidade: "São Paulo",
        estado: "SP",
        cep: "01426-001",
        numero: draft.numero,
        complemento: draft.complemento,
        referencia: draft.referencia,
      },
      observacoes: draft.observacoes,
      prioridade: draft.prioridade,
      imagens: [],
    }),
    [draft],
  );

  const confirmRequest = () => {
    void payloadPreview;
    navigation.navigate("SolicitacaoSucesso");
  };

  const address = [
    "Rua Oscar Freire, 245",
    draft.numero ? `número ${draft.numero}` : null,
    "Jardim América, São Paulo - SP",
    "CEP 01426-001",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Confirmar solicitação"
          subtitle="Revise tudo antes de enviar para os profissionais."
          step={5}
          total={5}
          onBack={() => navigation.goBack()}
        />

        <SummaryCard
          rows={[
            { label: "Servico", value: SERVICE_LABELS[draft.categoria], icon: "BriefcaseBusiness" },
            { label: "Data e horário", value: `${formatDate(draft.dataISO)} às ${draft.horario || "--:--"}`, icon: "Calendar" },
            { label: "Endereço", value: address, icon: "MapPin" },
            { label: "Observações", value: draft.observacoes || "Nenhuma observação adicionada.", icon: "FileText" },
          ]}
        />

        <DCard style={s.priceCard}>
          <View>
            <Text style={s.priceLabel}>Valor estimado</Text>
            <Text style={s.priceValue}>R$ 160,00</Text>
          </View>
          <Text style={s.priceHint}>Pagamento após confirmação</Text>
        </DCard>
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <DButton label="Confirmar solicitação" variant="primary" size="lg" onPress={confirmRequest} />
        <DButton
          label="Editar informações"
          variant="ghost"
          onPress={() => navigation.navigate("EscolherServico")}
          style={s.secondaryButton}
        />
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
    backgroundColor: colors.lavenderSoft,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priceValue: {
    marginTop: 4,
    color: colors.textPrimary,
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
  secondaryButton: {
    marginTop: 10,
  },
});
