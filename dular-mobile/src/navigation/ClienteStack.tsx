import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import { colors } from "@/theme/tokens";
import ClienteHome from "@/screens/cliente/ClienteHome";
import ClienteMinhas from "@/screens/cliente/ClienteMinhas";
import ClienteDetalhe from "@/screens/cliente/ClienteDetalhe";
import { CLIENTE_STACK_ROUTES } from "@/navigation/routes";

const Stack = createNativeStackNavigator();

type Props = { onLogout: () => void };

export default function ClienteStack({ onLogout }: Props) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () => (
          <Pressable onPress={onLogout} style={{ paddingHorizontal: 8 }}>
            <Text style={{ color: colors.danger, fontWeight: "600" }}>Sair</Text>
          </Pressable>
        ),
      }}
    >
      <Stack.Screen name={CLIENTE_STACK_ROUTES.HOME} component={ClienteHome} options={{ title: "Cliente" }} />
      <Stack.Screen name={CLIENTE_STACK_ROUTES.MINHAS} component={ClienteMinhas} options={{ title: "Minhas solicitações" }} />
      <Stack.Screen name={CLIENTE_STACK_ROUTES.DETALHE} component={ClienteDetalhe} options={{ title: "Detalhe" }} />
    </Stack.Navigator>
  );
}
