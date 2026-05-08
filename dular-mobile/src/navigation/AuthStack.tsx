import { createNativeStackNavigator } from "@react-navigation/native-stack";
import RoleSelect from "@/screens/auth/RoleSelect";
import OAuthLogin from "@/screens/auth/OAuthLogin";
import { AUTH_ROUTES } from "@/navigation/routes";

type AuthParamList = {
  [AUTH_ROUTES.ROLE_SELECT]: undefined;
  [AUTH_ROUTES.OAUTH_LOGIN]: { role: "EMPREGADOR" | "DIARISTA" | "MONTADOR" };
};

const Stack = createNativeStackNavigator<AuthParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name={AUTH_ROUTES.ROLE_SELECT} component={RoleSelect} />
      <Stack.Screen name={AUTH_ROUTES.OAUTH_LOGIN} component={OAuthLogin} />
    </Stack.Navigator>
  );
}
