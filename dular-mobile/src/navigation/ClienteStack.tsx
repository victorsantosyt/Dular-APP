import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import ClienteHome from "../screens/cliente/ClienteHome";
import ClienteMinhas from "../screens/cliente/ClienteMinhas";
import ClienteDetalhe from "../screens/cliente/ClienteDetalhe";

const Stack = createNativeStackNavigator();

type Props = { onLogout: () => void };

export default function ClienteStack({ onLogout }: Props) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () => (
          <Pressable onPress={onLogout} style={{ paddingHorizontal: 8 }}>
            <Text style={{ color: "#d00", fontWeight: "600" }}>Sair</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name="ClienteHome" component={ClienteHome} options={{ title: "Cliente" }} />
      <Stack.Screen name="ClienteMinhas" component={ClienteMinhas} options={{ title: "Minhas solicitações" }} />
      <Stack.Screen name="ClienteDetalhe" component={ClienteDetalhe} options={{ title: "Detalhe" }} />
    </Stack.Navigator>
  );
}
