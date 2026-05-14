import React from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui/AppIcon";
import { DButton } from "@/components/ui/DButton";
import { DCard } from "@/components/ui/DCard";
import { DInput } from "@/components/ui/DInput";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, shadows, spacing } from "@/theme";
import { useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EnderecoServico">;

export function EnderecoServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Endereço do serviço"
          subtitle="Confirme onde o atendimento deve acontecer."
          step={3}
          total={5}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        <DCard style={s.addressCard}>
          <View style={s.addressHeader}>
            <View style={[s.addressIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <AppIcon name="MapPin" size={20} color={flowTheme.primary} />
            </View>
            <View style={s.addressText}>
              <Text style={s.addressTitle}>Rua Oscar Freire, 245</Text>
              <Text style={s.addressSubtitle}>Jardim América, São Paulo - SP</Text>
              <Text style={s.addressCep}>CEP 01426-001</Text>
            </View>
          </View>
        </DCard>

        <View style={s.form}>
          <DInput
            placeholder="Número"
            value={draft.numero}
            onChangeText={(numero) => updateDraft({ numero })}
            keyboardType="number-pad"
            icon={<AppIcon name="Home" size={18} color={colors.textMuted} />}
          />
          <DInput
            placeholder="Complemento"
            value={draft.complemento}
            onChangeText={(complemento) => updateDraft({ complemento })}
            icon={<AppIcon name="Plus" size={18} color={colors.textMuted} />}
          />
          <DInput
            placeholder="Ponto de referência"
            value={draft.referencia}
            onChangeText={(referencia) => updateDraft({ referencia })}
            icon={<AppIcon name="Info" size={18} color={colors.textMuted} />}
          />
        </View>

        <DCard style={s.mapCard}>
          <View style={[s.mapGrid, { backgroundColor: flowTheme.primarySoft }]}>
            <View style={s.mapLineA} />
            <View style={s.mapLineB} />
            <View style={s.mapLineC} />
            <View style={[s.mapPin, { backgroundColor: flowTheme.primary, shadowColor: flowTheme.primary }]}>
              <AppIcon name="MapPin" size={22} color={colors.white} />
            </View>
          </View>
          <View style={s.mapLegend}>
            <Text style={s.mapTitle}>Area do atendimento</Text>
            <Text style={s.mapSubtitle}>Mapa ilustrativo para revisão visual do endereço.</Text>
          </View>
        </DCard>

        <DButton
          label="Adicionar novo endereço"
          variant="secondary"
          onPress={() => Alert.alert("Em breve", "Cadastro de novos endereços será conectado em uma próxima etapa.")}
        />
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton label="Continuar" theme={flowTheme} onPress={() => navigation.navigate("ObservacoesServico")} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  addressCard: {
    borderRadius: 24,
  },
  addressHeader: {
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addressText: {
    flex: 1,
    gap: 4,
  },
  addressTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  addressSubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  addressCep: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  form: {
    marginTop: spacing.lg,
    gap: 12,
  },
  mapCard: {
    marginTop: spacing.lg,
    padding: 0,
    overflow: "hidden",
    borderRadius: 24,
  },
  mapGrid: {
    height: 168,
    overflow: "hidden",
  },
  mapLineA: {
    position: "absolute",
    left: -30,
    top: 38,
    width: 260,
    height: 28,
    borderRadius: 16,
    backgroundColor: colors.white,
    transform: [{ rotate: "-18deg" }],
  },
  mapLineB: {
    position: "absolute",
    right: -20,
    top: 92,
    width: 240,
    height: 24,
    borderRadius: 16,
    backgroundColor: colors.lavenderStrong,
    transform: [{ rotate: "16deg" }],
  },
  mapLineC: {
    position: "absolute",
    left: 60,
    bottom: 22,
    width: 220,
    height: 18,
    borderRadius: 12,
    backgroundColor: colors.whiteAlpha80,
  },
  mapPin: {
    position: "absolute",
    top: 54,
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.primaryButton,
  },
  mapLegend: {
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.surface,
  },
  mapTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  mapSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
});
