import React from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DButton } from "@/components/ui/DButton";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { ServiceCategory, useServiceFlow } from "./ServiceFlowContext";
import { flowStyles, ServiceOptionCard, StepHeader } from "./components";

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
          title="Escolha o serviço"
          subtitle="Selecione o tipo de ajuda que você precisa agora."
          step={1}
          total={5}
          onBack={leaveFlow}
        />
        <ScrollView contentContainerStyle={s.list} scrollEnabled={false}>
          {SERVICES.map((service) => (
            <ServiceOptionCard
              key={service.id}
              title={service.title}
              subtitle={service.subtitle}
              icon={service.icon}
              selected={draft.categoria === service.id}
              onPress={() => updateDraft({ categoria: service.id })}
            />
          ))}
        </ScrollView>
      </ScrollView>
      <SafeAreaView style={flowStyles.footer}>
        <DButton label="Continuar" variant="primary" size="lg" onPress={() => navigation.navigate("EscolherData")} />
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  list: {
    gap: 14,
  },
});
