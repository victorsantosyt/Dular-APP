import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DButton } from "@/components/ui/DButton";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { flowStyles, StepHeader, UploadChip } from "./components";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "ObservacoesServico">;

const CHIPS_DIARISTA = ["Levar produtos", "Tom geral", "Falar ambiente", "Detalhes"];
const CHIPS_MONTADOR = [
  "Montagem de móveis",
  "Pequenos reparos",
  "Instalação elétrica",
  "Instalação hidráulica",
  "Pintura",
];

export function ObservacoesServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const isMontador = draft.tipoProfissional === "MONTADOR";
  const chipsList = isMontador ? CHIPS_MONTADOR : CHIPS_DIARISTA;
  const uploadTitle = isMontador ? "Tipo de trabalho" : "Fotos opcionais";
  const uploadSubtitle = isMontador
    ? "Selecione as categorias que se aplicam — ajuda o profissional a dar um orçamento mais preciso."
    : "Inclua referências visuais depois, se precisar.";
  const observacoesPlaceholder = isMontador
    ? "Descreva o serviço em detalhes (objeto, ambiente, urgência)…"
    : "Descreva detalhes ou preferências para o(a) profissional…";

  const toggleChip = (label: string) => {
    const next = draft.chips.includes(label)
      ? draft.chips.filter((chip) => chip !== label)
      : [...draft.chips, label];
    updateDraft({ chips: next });
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
        />

        <DCard style={s.textareaCard}>
          <TextInput
            value={draft.observacoes}
            onChangeText={(observacoes) => updateDraft({ observacoes })}
            placeholder={observacoesPlaceholder}
            placeholderTextColor={colors.textDisabled}
            multiline
            maxLength={300}
            textAlignVertical="top"
            style={s.textarea}
          />
          <Text style={s.counter}>{draft.observacoes.length}/300</Text>
        </DCard>

        <DCard style={s.uploadCard}>
          <View style={s.uploadHeader}>
            <AppIcon name={isMontador ? "Wrench" : "Camera"} size={21} color="purple" variant="soft" />
            <View style={s.uploadText}>
              <Text style={s.uploadTitle}>{uploadTitle}</Text>
              <Text style={s.uploadSubtitle}>{uploadSubtitle}</Text>
            </View>
          </View>
          <View style={s.chips}>
            {chipsList.map((chip) => (
              <UploadChip key={chip} label={chip} selected={draft.chips.includes(chip)} onPress={() => toggleChip(chip)} />
            ))}
          </View>
        </DCard>

        <DCard style={s.priorityCard}>
          <View style={s.priorityRow}>
            <AppIcon name="Clock" size={21} color="purple" variant="soft" />
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
        <DButton label="Continuar" variant="primary" size="lg" onPress={() => navigation.navigate("ConfirmarSolicitacao")} />
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
