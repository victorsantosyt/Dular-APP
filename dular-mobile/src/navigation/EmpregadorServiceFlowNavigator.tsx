import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { ConfirmarSolicitacaoScreen } from "@/screens/empregador/service-flow/ConfirmarSolicitacaoScreen";
import { EnderecoServicoScreen } from "@/screens/empregador/service-flow/EnderecoServicoScreen";
import { EscolherDataScreen } from "@/screens/empregador/service-flow/EscolherDataScreen";
import { ObservacoesServicoScreen } from "@/screens/empregador/service-flow/ObservacoesServicoScreen";
import {
  ServiceFlowProvider,
  type ServiceCategory,
  type TipoProfissional,
} from "@/screens/empregador/service-flow/ServiceFlowContext";
import { SolicitacaoSucessoScreen } from "@/screens/empregador/service-flow/SolicitacaoSucessoScreen";
import { SolicitarServicoScreen } from "@/screens/empregador/service-flow/SolicitarServicoScreen";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";

export type EmpregadorServiceFlowStackParamList = {
  EscolherServico: undefined;
  EscolherData: undefined;
  EnderecoServico: undefined;
  ObservacoesServico: undefined;
  ConfirmarSolicitacao: undefined;
  SolicitacaoSucesso: { servicoId?: string } | undefined;
};

const Stack = createNativeStackNavigator<EmpregadorServiceFlowStackParamList>();

/** Params aceitos quando o navigator é montado como Tab.Screen via
 *  EmpregadorTabParamList["SolicitarServico"]. Permite que cards de categoria
 *  na Home/Buscar e o perfil público abram o flow já pré-configurado. */
type SolicitarServicoRouteParams = {
  categoriaInicial?: ServiceCategory;
  tipoInicial?: TipoProfissional;
  profissionalId?: string;
  profissionalNome?: string;
};

export function EmpregadorServiceFlowNavigator() {
  // Lê os params da Tab.Screen pai (se houver). Quando o flow é aberto a partir
  // da tab bar central "+" sem params, ambos ficam undefined e o Provider usa
  // o INITIAL_DRAFT padrão.
  const route = useRoute<RouteProp<EmpregadorTabParamList, "SolicitarServico">>();
  const params = route.params as SolicitarServicoRouteParams | undefined;
  const flowKey = [
    params?.tipoInicial ?? "GERAL",
    params?.categoriaInicial ?? "sem-categoria",
    params?.profissionalId ?? "sem-profissional",
  ].join(":");

  return (
    <ServiceFlowProvider
      key={flowKey}
      initialCategoria={params?.categoriaInicial}
      initialTipo={params?.tipoInicial}
      initialProfissionalId={params?.profissionalId}
      initialProfissionalNome={params?.profissionalNome}
    >
      <Stack.Navigator
        initialRouteName="EscolherServico"
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen name="EscolherServico" component={SolicitarServicoScreen} />
        <Stack.Screen name="EscolherData" component={EscolherDataScreen} />
        <Stack.Screen name="EnderecoServico" component={EnderecoServicoScreen} />
        <Stack.Screen name="ObservacoesServico" component={ObservacoesServicoScreen} />
        <Stack.Screen name="ConfirmarSolicitacao" component={ConfirmarSolicitacaoScreen} />
        <Stack.Screen
          name="SolicitacaoSucesso"
          component={SolicitacaoSucessoScreen}
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </ServiceFlowProvider>
  );
}

export default EmpregadorServiceFlowNavigator;
