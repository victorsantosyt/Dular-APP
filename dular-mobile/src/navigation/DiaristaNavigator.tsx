import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DBottomTabBar } from "@/navigation/DBottomTabBar";
import { useMensagens, totalNaoLidas } from "@/hooks/useMensagens";
import { useAgendamentosDiarista } from "@/hooks/useAgendamentosDiarista";
import { DiaristaHomeScreen } from "@/screens/diarista/DiaristaHomeScreen";
import { AgendamentosDiaristaScreen } from "@/screens/diarista/AgendamentosDiaristaScreen";
import { ServicosDiaristaScreen } from "@/screens/diarista/ServicosDiaristaScreen";
import { MensagensDiaristaScreen } from "@/screens/diarista/MensagensDiaristaScreen";
import DiaristaNotificacoes from "@/screens/diarista/DiaristaNotificacoes";
import DiaristaPerfil from "@/screens/diarista/DiaristaPerfil";
import DiaristaDetalhe from "@/screens/diarista/DiaristaDetalhe";
import { ChatAbertoScreen } from "@/screens/shared/ChatAbertoScreen";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import PaywallScreen from "@/screens/PaywallScreen";
import type { PaywallParams } from "@/lib/paywall";
import SegurancaScreen from "@/screens/diarista/SegurancaScreen";
import DiaristaCarteira from "@/screens/diarista/DiaristaCarteira";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import SafeScoreScreen from "@/screens/perfil/SafeScoreScreen";
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
import { useAuth } from "@/stores/authStore";

export type DiaristaTabParamList = {
  // Container das abas reais (Home/Agendamentos/Novo/Mensagens/Perfil).
  DiaristaTabs: undefined;
  Home: undefined;
  Agendamentos: undefined;
  Novo: undefined;
  Mensagens: undefined;
  Notificacoes: undefined;
  ChatAberto: ChatAbertoParams;
  Perfil: undefined;
  ProfissionalPerfil: { id: string };
  DetalheServico: { id: string };
  DiaristaDetalhe: { servicoId: string };
  Paywall: PaywallParams;
  Seguranca: { servicoId: string; enderecoServico?: string };
  Carteira: { from?: keyof DiaristaTabParamList } | undefined;
  VerificacaoDocs: undefined;
  SafeScore: undefined;
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

const Tab = createBottomTabNavigator<DiaristaTabParamList>();
const RootStack = createNativeStackNavigator<DiaristaTabParamList>();

function PerfilScreen() {
  const sair = useAuth((state) => state.sair);
  return <DiaristaPerfil onLogout={() => { void sair(); }} />;
}

function ProfissionalPerfilScreen() {
  const sair = useAuth((state) => state.sair);
  return <DiaristaPerfil onLogout={() => { void sair(); }} />;
}

function DetalheServicoScreen(props: any) {
  return <DiaristaDetalhe {...props} />;
}

// Abas reais (5). A bottom bar só existe aqui dentro.
function DiaristaTabs() {
  const { rooms } = useMensagens();
  const unreadMessages = totalNaoLidas(rooms);
  // Badge de "Serviços" (aba "Novo"): conta solicitações pendentes, mesmo
  // padrão do montador (useMontadorServicos.pendentes).
  const { agendamentos } = useAgendamentosDiarista();
  const pendentes = agendamentos.filter((a) => a.status === "pendente");

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <DBottomTabBar
          {...props}
          variant="diarista"
          messagesBadge={unreadMessages > 0 ? unreadMessages : undefined}
          requestsBadge={pendentes.length > 0 ? pendentes.length : undefined}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { position: "absolute", borderTopWidth: 0, elevation: 0, backgroundColor: "transparent" },
      }}
    >
      <Tab.Screen name="Home" component={DiaristaHomeScreen} />
      <Tab.Screen name="Agendamentos" component={AgendamentosDiaristaScreen} />
      <Tab.Screen name="Novo" component={ServicosDiaristaScreen} />
      <Tab.Screen name="Mensagens" component={MensagensDiaristaScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}

// Stack raiz: abas + telas de detalhe/sub-tela empilhadas acima (fora da bottom
// bar). goBack() volta para a origem real.
export function DiaristaNavigator() {
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
      <RootStack.Screen name="DiaristaTabs" component={DiaristaTabs} />
      <RootStack.Screen name="Notificacoes" component={DiaristaNotificacoes} />
      <RootStack.Screen name="ChatAberto" component={ChatAbertoScreen} />
      <RootStack.Screen name="ProfissionalPerfil" component={ProfissionalPerfilScreen} />
      <RootStack.Screen name="DetalheServico" component={DetalheServicoScreen} />
      <RootStack.Screen name="DiaristaDetalhe" component={DetalheServicoScreen} />
      {/* transparentModal: a tela de planos flutua sobre o que estava atrás,
          que é o que o desfoque do fundo mostra. Como tela normal, o fundo
          seria branco e o blur não teria o que desfocar. */}
      <RootStack.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: "transparentModal", animation: "fade" }}
      />
      <RootStack.Screen name="Seguranca" component={SegurancaScreen} />
      <RootStack.Screen name="Carteira" component={DiaristaCarteira} />
      <RootStack.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <RootStack.Screen name="SafeScore" component={SafeScoreScreen} />
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

export default DiaristaNavigator;
