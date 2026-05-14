import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { ServiceCategory, useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, ServiceOptionCard, StepHeader } from "./components";
import { MONTADOR_ESPECIALIDADES } from "./montadorEspecialidades";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";
import { colors, radius, spacing, typography } from "@/theme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "EscolherServico">;

const SERVICES: Array<{
  id: ServiceCategory;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof ServiceOptionCard>["icon"];
}> = [
  { id: "baba", title: "Babá", subtitle: "Cuidado infantil com segurança e carinho.", icon: "Baby" },
  { id: "cozinheira", title: "Cozinheira", subtitle: "Refeições do dia, preparo e organização.", icon: "ChefHat" },
  { id: "diarista", title: "Diarista", subtitle: "Limpeza residencial com profissional verificado.", icon: "WashingMachine" },
  { id: "montador", title: "Montador", subtitle: "Para montagem, escolha primeiro um profissional disponível.", icon: "Wrench" },
];

export function SolicitarServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft, resetDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const isMontador = draft.tipo === "MONTADOR";
  const missingMontador = isMontador && !draft.profissionalId;
  const canContinue = !isMontador || Boolean(draft.especialidadeId);

  const leaveFlow = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      parent.navigate("Home");
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const goToMontadores = () => {
    resetDraft();
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      parent.navigate("Buscar", { categoriaInicial: "montador" });
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  const selectGeneralService = (service: ServiceCategory) => {
    if (service === "montador") {
      goToMontadores();
      return;
    }

    const sameProfessionalCategory = draft.tipo === "DIARISTA" && draft.categoria === service;
    updateDraft({
      categoria: service,
      tipo: "DIARISTA",
      tipoProfissional: "DIARISTA",
      ...(sameProfessionalCategory ? {} : { profissionalId: undefined, profissionalNome: undefined }),
      especialidadeId: undefined,
      especialidadeLabel: undefined,
      categoriaBackend: undefined,
    });
  };

  if (missingMontador) {
    return (
      <SafeAreaView style={flowStyles.screen}>
        <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
          <StepHeader
            title="Escolha um montador"
            subtitle="Selecione um profissional antes de solicitar o serviço."
            step={1}
            total={5}
            onBack={goToMontadores}
            theme={flowTheme}
          />

          <View style={[s.blockCard, { borderColor: flowTheme.border, backgroundColor: flowTheme.surface }]}>
            <View style={[s.blockIcon, { backgroundColor: flowTheme.primarySoft }]}>
              <Text style={[s.blockIconText, { color: flowTheme.textAccent }]}>!</Text>
            </View>
            <Text style={s.blockTitle}>Selecione um montador antes de solicitar o serviço.</Text>
            <Text style={s.blockText}>
              O fluxo de montagem precisa começar no perfil público do profissional para que a solicitação seja enviada ao montador correto.
            </Text>
          </View>
        </ScrollView>

        <SafeAreaView style={flowStyles.footer}>
          <FlowPrimaryButton
            label="Escolher montador"
            theme={flowTheme}
            onPress={goToMontadores}
          />
        </SafeAreaView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title={isMontador ? "Escolha a especialidade" : "Escolha o serviço"}
          subtitle={isMontador ? "Selecione o tipo de trabalho para o montador." : "Selecione o tipo de ajuda que você precisa agora."}
          step={1}
          total={5}
          onBack={leaveFlow}
          theme={flowTheme}
        />
        <ScrollView contentContainerStyle={s.list} scrollEnabled={false}>
          {isMontador
            ? MONTADOR_ESPECIALIDADES.map((especialidade) => (
                <ServiceOptionCard
                  key={especialidade.id}
                  title={especialidade.label}
                  subtitle="Serviço técnico residencial"
                  icon={especialidade.icon}
                  selected={draft.especialidadeId === especialidade.id}
                  theme={flowTheme}
                  onPress={() =>
                    updateDraft({
                      categoria: "montador",
                      tipo: "MONTADOR",
                      tipoProfissional: "MONTADOR",
                      especialidadeId: especialidade.id,
                      especialidadeLabel: especialidade.label,
                      categoriaBackend: especialidade.categoriaBackend,
                    })
                  }
                />
              ))
            : SERVICES.map((service) => (
                <ServiceOptionCard
                  key={service.id}
                  title={service.title}
                  subtitle={service.subtitle}
                  icon={service.icon}
                  selected={draft.categoria === service.id}
                  theme={flowTheme}
                  onPress={() => selectGeneralService(service.id)}
                />
              ))}
        </ScrollView>
      </ScrollView>
      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton
          label="Continuar"
          theme={flowTheme}
          disabled={!canContinue}
          onPress={() => navigation.navigate("EscolherData")}
        />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 14,
  },
  blockCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: 10,
  },
  blockIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  blockIconText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  blockTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
  },
  blockText: {
    color: colors.textSecondary,
    ...typography.bodySm,
    fontWeight: "500",
  },
});
