import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DiaristaPerfil from "@/screens/diarista/DiaristaPerfil";
import EditDados from "@/screens/diarista/EditProfile";
import VerificacaoDocs from "@/screens/perfil/VerificacaoDocs";
import EditBairros from "@/screens/diarista/EditNeighborhoods";
import EditDisponibilidade from "@/screens/diarista/EditAvailability";
import EditPrecos from "@/screens/diarista/EditPrices";
import AlterarSenha from "@/screens/perfil/AlterarSenha";
import Suporte from "@/screens/perfil/Suporte";
import Termos from "@/screens/perfil/Termos";
import Privacidade from "@/screens/perfil/Privacidade";
import ReportIncident from "@/screens/perfil/ReportIncident";
import { PERFIL_STACK_ROUTES } from "@/navigation/routes";

export type DiaristaPerfilStackParamList = {
  [PERFIL_STACK_ROUTES.PERFIL_HOME]: undefined;
  [PERFIL_STACK_ROUTES.EDIT_DADOS]: undefined;
  [PERFIL_STACK_ROUTES.VERIFICACAO_DOCS]: undefined;
  [PERFIL_STACK_ROUTES.EDIT_BAIRROS]: undefined;
  [PERFIL_STACK_ROUTES.EDIT_DISPONIBILIDADE]: undefined;
  [PERFIL_STACK_ROUTES.EDIT_PRECOS]: undefined;
  [PERFIL_STACK_ROUTES.ALTERAR_SENHA]: undefined;
  [PERFIL_STACK_ROUTES.SUPORTE]: undefined;
  [PERFIL_STACK_ROUTES.TERMOS]: undefined;
  [PERFIL_STACK_ROUTES.PRIVACIDADE]: undefined;
  [PERFIL_STACK_ROUTES.REPORT_INCIDENT]: undefined;
};

const Stack = createNativeStackNavigator<DiaristaPerfilStackParamList>();

export default function DiaristaPerfilStack({ onLogout }: { onLogout: () => void }) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
      }}
    >
      <Stack.Screen name={PERFIL_STACK_ROUTES.PERFIL_HOME}>
        {(props) => <DiaristaPerfil {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name={PERFIL_STACK_ROUTES.EDIT_DADOS} component={EditDados} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.VERIFICACAO_DOCS} component={VerificacaoDocs} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.EDIT_BAIRROS} component={EditBairros} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.EDIT_DISPONIBILIDADE} component={EditDisponibilidade} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.EDIT_PRECOS} component={EditPrecos} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.ALTERAR_SENHA} component={AlterarSenha} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.SUPORTE} component={Suporte} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.TERMOS} component={Termos} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.PRIVACIDADE} component={Privacidade} />
      <Stack.Screen name={PERFIL_STACK_ROUTES.REPORT_INCIDENT} component={ReportIncident} />
    </Stack.Navigator>
  );
}
