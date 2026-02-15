import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import DiaristaPerfil from "../screens/diarista/DiaristaPerfil";
import EditDados from "../screens/diarista/EditProfile";
import VerificacaoDocs from "../screens/perfil/VerificacaoDocs";
import EditBairros from "../screens/diarista/EditNeighborhoods";
import EditDisponibilidade from "../screens/diarista/EditAvailability";
import EditPrecos from "../screens/diarista/EditPrices";
import AlterarSenha from "../screens/perfil/AlterarSenha";
import Suporte from "../screens/perfil/Suporte";
import Termos from "../screens/perfil/Termos";
import Privacidade from "../screens/perfil/Privacidade";
import ReportIncident from "../screens/perfil/ReportIncident";

export type DiaristaPerfilStackParamList = {
  PerfilHome: undefined;
  EditDados: undefined;
  VerificacaoDocs: undefined;
  EditBairros: undefined;
  EditDisponibilidade: undefined;
  EditPrecos: undefined;
  AlterarSenha: undefined;
  Suporte: undefined;
  Termos: undefined;
  Privacidade: undefined;
  ReportIncident: undefined;
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
      <Stack.Screen name="PerfilHome">
        {(props) => <DiaristaPerfil {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="EditDados" component={EditDados} />
      <Stack.Screen name="VerificacaoDocs" component={VerificacaoDocs} />
      <Stack.Screen name="EditBairros" component={EditBairros} />
      <Stack.Screen name="EditDisponibilidade" component={EditDisponibilidade} />
      <Stack.Screen name="EditPrecos" component={EditPrecos} />
      <Stack.Screen name="AlterarSenha" component={AlterarSenha} />
      <Stack.Screen name="Suporte" component={Suporte} />
      <Stack.Screen name="Termos" component={Termos} />
      <Stack.Screen name="Privacidade" component={Privacidade} />
      <Stack.Screen name="ReportIncident" component={ReportIncident} />
    </Stack.Navigator>
  );
}
