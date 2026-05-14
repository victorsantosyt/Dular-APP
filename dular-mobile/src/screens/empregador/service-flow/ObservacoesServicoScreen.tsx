import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader, UploadChip } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "ObservacoesServico">;

const CHIPS_DIARISTA = ["Levar produtos", "Tom geral", "Falar ambiente", "Detalhes"];

export function ObservacoesServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const [submitted, setSubmitted] = useState(false);
  const isMontador = draft.tipo === "MONTADOR";
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const chipsList = CHIPS_DIARISTA;
  const uploadTitle = isMontador ? "Especialidade selecionada" : "Fotos opcionais";
  const uploadSubtitle = isMontador
    ? draft.especialidadeLabel ?? "Volte para escolher a especialidade do serviço."
    : "Inclua referências visuais depois, se precisar.";
  const observacoesPlaceholder = isMontador
    ? "Descreva o serviço em detalhes: o que precisa ser feito, medidas aproximadas, se tem peças/materiais disponíveis…"
    : "Descreva detalhes ou preferências para o(a) profissional…";
  const descriptionLength = draft.observacoes.trim().length;
  const descriptionInvalid = isMontador && submitted && descriptionLength < 20;

  const toggleChip = (label: string) => {
    const next = draft.chips.includes(label)
      ? draft.chips.filter((chip) => chip !== label)
      : [...draft.chips, label];
    updateDraft({ chips: next });
  };

  const continueFlow = () => {
    setSubmitted(true);
    if (isMontador && descriptionLength < 20) return;
    navigation.navigate("ConfirmarSolicitacao");
  };

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Observações"
          subtitle="Adicione detalhes para deixar a solicitação mais precisa."
          step={4}
          total={5}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        <DCard style={s.textareaCard}>
          <TextInput
            value={draft.observacoes}
            onChangeText={(observacoes) => updateDraft({ observacoes })}
            placeholder={observacoesPlaceholder}
            placeholderTextColor={colors.textDisabled}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            style={[s.textarea, descriptionInvalid && { borderColor: colors.danger }]}
          />
          <View style={s.counterRow}>
            {descriptionInvalid ? (
              <Text style={s.errorText}>Descreva o serviço com pelo menos 20 caracteres.</Text>
            ) : <View />}
            <Text style={s.counter}>{draft.observacoes.length}/1000</Text>
          </View>
        </DCard>

        <DCard style={s.uploadCard}>
          <View style={s.uploadHeader}>
            <View style={[s.uploadIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <AppIcon name={isMontador ? "Wrench" : "Camera"} size={19} color={flowTheme.primary} />
            </View>
            <View style={s.uploadText}>
              <Text style={s.uploadTitle}>{uploadTitle}</Text>
              <Text style={s.uploadSubtitle}>{uploadSubtitle}</Text>
            </View>
          </View>
          {!isMontador ? (
            <View style={s.chips}>
              {chipsList.map((chip) => (
                <UploadChip
                  key={chip}
                  label={chip}
                  selected={draft.chips.includes(chip)}
                  theme={flowTheme}
                  onPress={() => toggleChip(chip)}
                />
              ))}
            </View>
          ) : null}
        </DCard>

        <DCard style={s.priorityCard}>
          <View style={s.priorityRow}>
            <View style={[s.uploadIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <AppIcon name="Clock" size={19} color={flowTheme.primary} />
            </View>
            <View style={s.priorityText}>
              <Text style={s.priorityLabel}>Prioridade do agendamento</Text>
              <Text style={s.priorityValue}>{draft.prioridade}</Text>
            </View>
            <AppIcon name="ChevronRight" size={18} color={colors.textMuted} />
          </View>
          <Text style={s.priorityHint}>Mais opções disponíveis para o(a) profissional e para você</Text>
        </DCard>
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={continueFlow} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  textareaCard: {
    minHeight: 188,
    borderRadius: 24,
    padding: spacing.md,
  },
  textarea: {
    minHeight: 130,
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: radius.lg,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  counter: {
    alignSelf: "flex-end",
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  uploadCard: {
    marginTop: spacing.lg,
    borderRadius: 24,
    gap: spacing.md,
  },
  uploadHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "center",
  },
  uploadText: {
    flex: 1,
    gap: 3,
  },
  uploadIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  uploadSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  priorityCard: {
    marginTop: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  priorityText: {
    flex: 1,
    gap: 4,
  },
  priorityLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priorityValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  priorityHint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    paddingLeft: 54,
  },
});
