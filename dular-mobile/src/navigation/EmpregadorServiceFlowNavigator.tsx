import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ConfirmarSolicitacaoScreen } from "@/screens/empregador/service-flow/ConfirmarSolicitacaoScreen";
import { EnderecoServicoScreen } from "@/screens/empregador/service-flow/EnderecoServicoScreen";
import { EscolherDataScreen } from "@/screens/empregador/service-flow/EscolherDataScreen";
import { ObservacoesServicoScreen } from "@/screens/empregador/service-flow/ObservacoesServicoScreen";
import { ServiceFlowProvider } from "@/screens/empregador/service-flow/ServiceFlowContext";
import { SolicitacaoSucessoScreen } from "@/screens/empregador/service-flow/SolicitacaoSucessoScreen";
import { SolicitarServicoScreen } from "@/screens/empregador/service-flow/SolicitarServicoScreen";

export type EmpregadorServiceFlowStackParamList = {
  EscolherServico: undefined;
  EscolherData: undefined;
  EnderecoServico: undefined;
  ObservacoesServico: undefined;
  ConfirmarSolicitacao: undefined;
  SolicitacaoSucesso: undefined;
};

const Stack = createNativeStackNavigator<EmpregadorServiceFlowStackParamList>();

export function EmpregadorServiceFlowNavigator() {
  return (
    <ServiceFlowProvider>
      <Stack.Navigator
        initialRouteName="EscolherServico"
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen name="EscolherServico" component={SolicitarServicoScreen} />
        <Stack.Screen name="EscolherData" component={EscolherDataScreen} />
        <Stack.Screen name="EnderecoServico" component={EnderecoServicoScreen} />
        <Stack.Screen name="ObservacoesServico" component={ObservacoesServicoScreen} />
        <Stack.Screen name="ConfirmarSolicitacao" component={ConfirmarSolicitacaoScreen} />
        <Stack.Screen name="SolicitacaoSucesso" component={SolicitacaoSucessoScreen} options={{ gestureEnabled: false }} />
      </Stack.Navigator>
    </ServiceFlowProvider>
  );
}

export default EmpregadorServiceFlowNavigator;
