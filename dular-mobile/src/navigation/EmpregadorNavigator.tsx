import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { useMensagens, totalNaoLidas } from "@/hooks/useMensagens";
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
import Privacidade from "@/screens/perfil/Privacidade";
import ReportIncident from "@/screens/perfil/ReportIncident";
import Termos from "@/screens/perfil/Termos";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SosFlowScreen from "@/screens/perfil/SosFlowScreen";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
import { EnderecoEditRoute, type CadastroEnderecoParams } from "@/screens/shared/EnderecoEditRoute";
import { MeusEnderecosScreen, type MeusEnderecosParams } from "@/screens/shared/MeusEnderecosScreen";
import { useAuth } from "@/stores/authStore";
import type { PrecoInfo, ServiceCategory, TipoProfissional } from "@/screens/empregador/service-flow/ServiceFlowContext";

export type EmpregadorTabParamList = {
  // Container das abas reais (Home/Buscar/Agendamentos/Mensagens/Perfil).
  EmpregadorTabs: undefined;
  Home: undefined;
  Buscar:
    | undefined
    | {
        categoriaInicial?:
          | "baba"
          | "cozinheira"
          | "diarista"
          | "montador"
          | "cuidadora"
          | "passadeira"
          | "lavadeira";
      };
  Agendamentos: undefined;
  /** Pode receber pré-seleção da Home / Busca / perfil público. Sem params,
   *  abre o flow no estado inicial. */
  SolicitarServico:
    | undefined
    | {
        categoriaInicial?: ServiceCategory;
        tipoInicial?: TipoProfissional;
        profissionalId?: string;
        profissionalNome?: string;
        precoEstimadoLabel?: string;
        precos?: { leve: number | null; medio: number | null; pesada: number | null };
        servicosOferecidos?: string[];
        precoInfo?: PrecoInfo;
      };
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
  CadastroEndereco: CadastroEnderecoParams;
  MeusEnderecos: MeusEnderecosParams;
};

const Tab = createBottomTabNavigator<EmpregadorTabParamList>();
const RootStack = createNativeStackNavigator<EmpregadorTabParamList>();

function PerfilScreen() {
  const clearSession = useAuth((state) => state.clearSession);
  return <EmpregadorPerfil onLogout={() => { void clearSession(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <EmpregadorDetalhe {...props} />;
}

// Abas reais (5). A bottom bar só existe aqui dentro.
function EmpregadorTabs() {
  const { rooms } = useMensagens();
  const unreadMessages = totalNaoLidas(rooms);

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <DBottomTabBar
          {...props}
          variant="empregador"
          messagesBadge={unreadMessages > 0 ? unreadMessages : undefined}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="Home" component={EmpregadorHome} />
      <Tab.Screen name="Buscar" component={BuscarScreen} />
      <Tab.Screen name="Agendamentos" component={AgendamentosEmpregadorScreen} />
      <Tab.Screen name="Mensagens" component={MensagensEmpregadorScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

// Stack raiz: abas + TODAS as telas de detalhe/sub-tela empilhadas ACIMA das
// abas (fora da bottom bar). Abertas com navigate() → push real → goBack()
// volta para a tela de origem exata.
export function EmpregadorNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="EmpregadorTabs" component={EmpregadorTabs} />
      <RootStack.Screen name="SolicitarServico" component={EmpregadorServiceFlowNavigator} />
      <RootStack.Screen name="Notificacoes" component={NotificacoesEmpregadorScreen} />
      <RootStack.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <RootStack.Screen name="ProfissionalPerfil" component={DiaristaProfileScreen} />
      <RootStack.Screen name="DiaristaProfile" component={DiaristaProfileScreen} />
      <RootStack.Screen name="MontadorPublicProfile" component={MontadorPublicProfile} />
      <RootStack.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <RootStack.Screen name="EmpregadorDetalhe" component={DetalheServicoScreen} />
      <RootStack.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <RootStack.Screen name="ReportIncident" component={ReportIncident} />
      <RootStack.Screen name="SosFlow" component={SosFlowScreen} />
      <RootStack.Screen name="SafeScore" component={SafeScoreScreen} />
      <RootStack.Screen name="Termos" component={Termos} />
      <RootStack.Screen name="Privacidade" component={Privacidade} />
      <RootStack.Screen name="Favoritos" component={FavoritosEmpregadorScreen} />
      <RootStack.Screen name="Historico" component={HistoricoEmpregadorScreen} />
      <RootStack.Screen name="CategoriasTodas" component={CategoriasTodasScreen} />
      <RootStack.Screen name="DadosConta" component={DadosContaScreen} />
      <RootStack.Screen name="Suporte" component={Suporte} />
      <RootStack.Screen name="ProfissionaisSugeridos" component={ProfissionaisSugeridosScreen} />
      <RootStack.Screen name="AcoesRapidas" component={AcoesRapidasEmpregadorScreen} />
      <RootStack.Screen name="ProfissionaisDestaque" component={ProfissionaisDestaqueScreen} />
      <RootStack.Screen name="CadastroEndereco" component={EnderecoEditRoute} />
      <RootStack.Screen name="MeusEnderecos" component={MeusEnderecosScreen} />
    </RootStack.Navigator>
  );
}

export default EmpregadorNavigator;
