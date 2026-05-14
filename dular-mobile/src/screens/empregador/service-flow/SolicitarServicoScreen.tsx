import React from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { ServiceCategory, useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, ServiceOptionCard, StepHeader } from "./components";
import { MONTADOR_ESPECIALIDADES } from "./montadorEspecialidades";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

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
  { id: "montador", title: "Montador", subtitle: "Montagem, ajustes e pequenos reparos.", icon: "Wrench" },
];

export function SolicitarServicoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft, updateDraft } = useServiceFlow();
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const isMontador = draft.tipo === "MONTADOR";
  const canContinue = !isMontador || Boolean(draft.especialidadeId);

  const leaveFlow = () => {
    const parent = navigation.getParent<BottomTabNavigationProp<EmpregadorTabParamList>>();
    if (parent) {
      parent.navigate("Home");
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

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
                  onPress={() => updateDraft({ categoria: service.id })}
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
});
