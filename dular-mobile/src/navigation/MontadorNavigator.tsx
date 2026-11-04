import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { useMensagens, totalNaoLidas } from "@/hooks/useMensagens";
import { MontadorHome } from "@/screens/montador/MontadorHome";
import MontadorAgenda from "@/screens/montador/MontadorAgenda";
import MontadorSolicitacoes from "@/screens/montador/MontadorSolicitacoes";
import MontadorMensagens from "@/screens/montador/MontadorMensagens";
import MontadorPerfil from "@/screens/montador/MontadorPerfil";
import MontadorNotificacoes from "@/screens/montador/MontadorNotificacoes";
import MontadorDetalheSolicitacao from "@/screens/montador/MontadorDetalheSolicitacao";
import MontadorDetalheServico from "@/screens/montador/MontadorDetalheServico";
import CarteiraScreen from "@/screens/montador/CarteiraScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import type { PaywallParams } from "@/lib/paywall";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
import SafeScoreGuideScreen from "@/screens/perfil/SafeScoreGuideScreen";
import SosFlowScreen from "@/screens/perfil/SosFlowScreen";
import ReportIncident from "@/screens/perfil/ReportIncident";
import type { ReportIncidentParams } from "@/lib/reportIncident";
import Suporte from "@/screens/perfil/Suporte";
import EnviarFeedback from "@/screens/perfil/EnviarFeedback";
import Termos from "@/screens/perfil/Termos";
import Privacidade from "@/screens/perfil/Privacidade";
import ExcluirConta from "@/screens/perfil/ExcluirConta";
import { EnderecoEditRoute, type CadastroEnderecoParams } from "@/screens/shared/EnderecoEditRoute";
import { MeusEnderecosScreen, type MeusEnderecosParams } from "@/screens/shared/MeusEnderecosScreen";
import { RecebimentosScreen } from "@/screens/shared/RecebimentosScreen";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";

export type MontadorTabParamList = {
  // Container das abas reais.
  MontadorTabs: undefined;
  MontadorHome: undefined;
  MontadorAgenda: undefined;
  MontadorSolicitacoes: undefined;
  MontadorMensagens: undefined;
  MontadorPerfil: undefined;
  MontadorNotificacoes: undefined;
  MontadorDetalheSolicitacao: { servicoId: string };
  MontadorDetalheServico: { servicoId: string };
  MontadorChat: ChatAbertoParams;
  Carteira: { from?: keyof MontadorTabParamList } | undefined;
  Paywall: PaywallParams;
  VerificacaoDocs: { notificacaoId?: string } | undefined;
  SafeScore: undefined;
  SafeScoreGuide: undefined;
  SosFlow: undefined;
  ReportIncident: ReportIncidentParams | undefined;
  Suporte: undefined;
  EnviarFeedback: undefined;
  Termos: undefined;
  Privacidade: undefined;
  ExcluirConta: undefined;
  CadastroEndereco: CadastroEnderecoParams;
  MeusEnderecos: MeusEnderecosParams;
  Recebimentos: undefined;
};

const Tab = createBottomTabNavigator<MontadorTabParamList>();
const RootStack = createNativeStackNavigator<MontadorTabParamList>();

// Abas reais (5). A bottom bar só existe aqui dentro.
function MontadorTabs() {
  const { pendentes } = useMontadorServicos();
  const { rooms } = useMensagens();
  const unreadMessages = totalNaoLidas(rooms);

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <DBottomTabBar
          {...props}
          variant="montador"
          messagesBadge={unreadMessages > 0 ? unreadMessages : undefined}
          requestsBadge={pendentes.length > 0 ? pendentes.length : undefined}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="MontadorHome" component={MontadorHome} />
      <Tab.Screen name="MontadorAgenda" component={MontadorAgenda} />
      <Tab.Screen name="MontadorSolicitacoes" component={MontadorSolicitacoes} />
      <Tab.Screen name="MontadorMensagens" component={MontadorMensagens} />
      <Tab.Screen name="MontadorPerfil" component={MontadorPerfil} />
    </Tab.Navigator>
  );
}

// Stack raiz: abas + telas de detalhe/sub-tela empilhadas acima (fora da bottom
// bar). goBack() volta para a origem real (lista, notificações, solicitação…).
export function MontadorNavigator() {
  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        // Transição lateral igual nos dois sistemas. Sem declarar, cada
        // plataforma usa o próprio padrão (o Android entra de baixo em versões
        // recentes do react-navigation), e a mesma navegação se comportava
        // diferente conforme o aparelho.
        animation: "slide_from_right",
        // Arrastar da borda para voltar. No native-stack quem trata isso é o
        // navegador nativo: no iOS habilita o swipe da borda; no Android não
        // há gesto de borda por tela (o sistema já tem o back próprio), então
        // lá é inócuo. Fica explícito para não parecer esquecimento.
        gestureEnabled: true,
      }}
    >
      <RootStack.Screen name="MontadorTabs" component={MontadorTabs} />
      <RootStack.Screen name="MontadorNotificacoes" component={MontadorNotificacoes} />
      <RootStack.Screen name="MontadorDetalheSolicitacao" component={MontadorDetalheSolicitacao} />
      <RootStack.Screen name="MontadorDetalheServico" component={MontadorDetalheServico} />
      <RootStack.Screen name="MontadorChat" component={ChatAbertoScreen} />
      <RootStack.Screen name="Carteira" component={CarteiraScreen} />
      {/* Faltava aqui: `useLimiteDePlano` navega para "Paywall" a partir das
          telas de aceite do montador. Sem o registro, o montador que
          estourasse o limite era bloqueado e a navegação falhava em silêncio —
          ele ficava sem entender o motivo. */}
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <RootStack.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <RootStack.Screen name="SafeScore" component={SafeScoreScreen} />
      <RootStack.Screen name="SafeScoreGuide" component={SafeScoreGuideScreen} />
      <RootStack.Screen name="SosFlow" component={SosFlowScreen} />
      <RootStack.Screen name="ReportIncident" component={ReportIncident} />
      <RootStack.Screen name="Suporte" component={Suporte} />
      <RootStack.Screen name="EnviarFeedback" component={EnviarFeedback} />
      <RootStack.Screen name="Termos" component={Termos} />
      <RootStack.Screen name="Privacidade" component={Privacidade} />
      <RootStack.Screen name="ExcluirConta" component={ExcluirConta} />
      <RootStack.Screen name="CadastroEndereco" component={EnderecoEditRoute} />
      <RootStack.Screen name="MeusEnderecos" component={MeusEnderecosScreen} />
      <RootStack.Screen name="Recebimentos" component={RecebimentosScreen} />
    </RootStack.Navigator>
  );
}

export default MontadorNavigator;
