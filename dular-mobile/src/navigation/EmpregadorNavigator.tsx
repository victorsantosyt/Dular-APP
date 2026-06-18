import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { AgendamentosEmpregadorScreen } from "@/screens/empregador/AgendamentosEmpregadorScreen";
import EmpregadorHome from "@/screens/empregador/EmpregadorHome";
import { BuscarScreen } from "@/screens/empregador/BuscarScreen";
import { EmpregadorServiceFlowNavigator } from "@/navigation/EmpregadorServiceFlowNavigator";
import { MensagensEmpregadorScreen } from "@/screens/empregador/MensagensEmpregadorScreen";
import { NotificacoesEmpregadorScreen } from "@/screens/empregador/NotificacoesEmpregadorScreen";
import { DiaristaProfileScreen } from "@/screens/empregador/DiaristaProfileScreen";
import MontadorPublicProfile from "@/screens/empregador/MontadorPublicProfile";
import EmpregadorPerfil from "@/screens/empregador/EmpregadorPerfil";
import EmpregadorDetalhe from "@/screens/empregador/EmpregadorDetalhe";
import FavoritosEmpregadorScreen from "@/screens/empregador/FavoritosEmpregadorScreen";
import HistoricoEmpregadorScreen from "@/screens/empregador/HistoricoEmpregadorScreen";
import { CategoriasTodasScreen } from "@/screens/empregador/CategoriasTodasScreen";
import { DadosContaScreen } from "@/screens/empregador/DadosContaScreen";
import Suporte from "@/screens/perfil/Suporte";
import ProfissionaisSugeridosScreen from "@/screens/empregador/ProfissionaisSugeridosScreen";
import AcoesRapidasEmpregadorScreen from "@/screens/empregador/AcoesRapidasEmpregadorScreen";
import ProfissionaisDestaqueScreen from "@/screens/empregador/ProfissionaisDestaqueScreen";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import Privacidade from "@/screens/perfil/Privacidade";
import ReportIncident from "@/screens/perfil/ReportIncident";
import Termos from "@/screens/perfil/Termos";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SosFlowScreen from "@/screens/perfil/SosFlowScreen";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
import { useAuth } from "@/stores/authStore";
import type { ServiceCategory, TipoProfissional } from "@/screens/empregador/service-flow/ServiceFlowContext";

export type EmpregadorTabParamList = {
  Home: undefined;
  Buscar:
    | undefined
    | {
        categoriaInicial?:
          | "baba"
          | "cozinheira"
          | "diarista"
          | "montador"
          | "faxineira"
          | "cuidadora"
          | "passadeira"
          | "lavadeira";
      };
  Agendamentos: undefined;
  /** Pode receber pré-seleção da Home / Busca / perfil público. Sem params,
   *  abre o flow no estado inicial. */
  SolicitarServico:
    | undefined
    | { categoriaInicial?: ServiceCategory; tipoInicial?: TipoProfissional; profissionalId?: string; profissionalNome?: string; precoEstimadoLabel?: string };
  Mensagens: undefined;
  Notificacoes: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DiaristaProfile: { diaristaId: string; nome: string; categoriaInicial?: ServiceCategory };
  MontadorPublicProfile: {
    montadorId: string;
    montadorUserId?: string;
    nome?: string;
    rating?: number;
    especialidades?: string[];
    cidade?: string | null;
    estado?: string | null;
    avatarUrl?: string | null;
  };
  DetalheServico: { id: string };
  EmpregadorDetalhe: { servicoId: string };
  Paywall: { mensagem?: string };
  VerificacaoDocs: undefined;
  ReportIncident: undefined;
  SosFlow: undefined;
  SafeScore: undefined;
  Termos: undefined;
  Privacidade: undefined;
  Favoritos: undefined;
  Historico: undefined;
  ProfissionaisSugeridos: undefined;
  AcoesRapidas: undefined;
  ProfissionaisDestaque: undefined;
  CategoriasTodas: undefined;
  DadosConta: undefined;
  Suporte: undefined;
};

const Tab = createBottomTabNavigator<EmpregadorTabParamList>();

function PerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <EmpregadorPerfil onLogout={() => { void clearSession(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <EmpregadorDetalhe {...props} />;
}

export function EmpregadorNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DBottomTabBar {...props} variant="empregador" />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="Home" component={EmpregadorHome} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="Agendamentos" component={AgendamentosEmpregadorScreen} />
      <Tab.Screen name="SolicitarServico" component={EmpregadorServiceFlowNavigator} />
      <Tab.Screen name="Mensagens" component={MensagensEmpregadorScreen} />
      <Tab.Screen name="Notificacoes" component={NotificacoesEmpregadorScreen} />
      <Tab.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
      <Tab.Screen name="ProfissionalPerfil" component={DiaristaProfileScreen} />
      <Tab.Screen name="DiaristaProfile" component={DiaristaProfileScreen} />
      <Tab.Screen name="MontadorPublicProfile" component={MontadorPublicProfile} />
      <Tab.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <Tab.Screen name="EmpregadorDetalhe" component={DetalheServicoScreen} />
      <Tab.Screen name="Paywall" component={PaywallScreen} />
      <Tab.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Tab.Screen name="ReportIncident" component={ReportIncident} />
      <Tab.Screen name="SosFlow" component={SosFlowScreen} />
      <Tab.Screen name="SafeScore" component={SafeScoreScreen} />
      <Tab.Screen name="Termos" component={Termos} />
      <Tab.Screen name="Privacidade" component={Privacidade} />
      <Tab.Screen name="Favoritos" component={FavoritosEmpregadorScreen} />
      <Tab.Screen name="Historico" component={HistoricoEmpregadorScreen} />
      <Tab.Screen name="CategoriasTodas" component={CategoriasTodasScreen} />
      <Tab.Screen name="DadosConta" component={DadosContaScreen} />
      <Tab.Screen name="Suporte" component={Suporte} />
      <Tab.Screen name="ProfissionaisSugeridos" component={ProfissionaisSugeridosScreen} />
      <Tab.Screen name="AcoesRapidas" component={AcoesRapidasEmpregadorScreen} />
      <Tab.Screen name="ProfissionaisDestaque" component={ProfissionaisDestaqueScreen} />
    </Tab.Navigator>
  );
}

export default EmpregadorNavigator;
