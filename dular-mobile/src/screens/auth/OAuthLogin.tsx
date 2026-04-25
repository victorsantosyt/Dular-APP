import { useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { DularLogo } from "@/ui/DularLogo";
import { AUTH_ROUTES } from "@/navigation/routes";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/stores/authStore";

WebBrowser.maybeCompleteAuthSession();

type AuthParamList = {
  [AUTH_ROUTES.ROLE_SELECT]: undefined;
  [AUTH_ROUTES.OAUTH_LOGIN]: { role: "CLIENTE" | "DIARISTA" };
};

type Props = NativeStackScreenProps<AuthParamList, typeof AUTH_ROUTES.OAUTH_LOGIN>;

const ROLE_LABEL: Record<string, string> = {
  CLIENTE: "Cliente",
  DIARISTA: "Diarista",
};

function GoogleIcon() {
  return (
    // SVG paths inline como View já que RN não tem SVG nativo sem lib adicional
    // Usando Ionicons como fallback
    <Ionicons name="logo-google" size={20} color={colors.ink} />
  );
}

export default function OAuthLogin({ route, navigation }: Props) {
  const { role } = route.params;
  const insets = useSafeAreaInsets();
  const { setSession } = useAuth();
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  async function handleGoogleLogin() {
    if (!API_BASE_URL) {
      Alert.alert("Erro", "URL da API não configurada.");
      return;
    }

    setLoading(true);
    try {
      const callbackUrl = encodeURIComponent(`/auth/callback/${role.toLowerCase()}?platform=mobile`);
      const loginUrl = `${API_BASE_URL}/api/auth/signin/google?callbackUrl=${callbackUrl}`;
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, "dular://auth");

      if (result.type !== "success") return; // usuário cancelou

      // result.url = "dular://auth?token=JWT&role=CLIENTE"
      const url = new URL(result.url);
      const token = url.searchParams.get("token");
      const returnedRole = url.searchParams.get("role") as "CLIENTE" | "DIARISTA" | "ADMIN" | null;
      const error = url.searchParams.get("error");

      if (error) {
        Alert.alert("Erro", error === "no_role" ? "Perfil sem role definido." : "Falha na autenticação.");
        return;
      }

      if (!token || !returnedRole) {
        Alert.alert("Erro", "Resposta inválida do servidor.");
        return;
      }

      await setSession({ token, role: returnedRole });
      // App.tsx reage ao store e renderiza as tabs automaticamente
    } catch (err) {
      Alert.alert("Erro", "Não foi possível concluir o login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient
      colors={[colors.greenLight, colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.root}
    >
      <View style={[s.inner, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>

        <Animated.View
          style={[s.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <DularLogo size="lg" />
          <Text style={s.title}>Entrar como {ROLE_LABEL[role]}</Text>
          <Text style={s.subtitle}>Escolha como deseja continuar</Text>
        </Animated.View>

        <Animated.View
          style={[s.buttons, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable
            onPress={handleGoogleLogin}
            disabled={loading}
            style={({ pressed }) => [s.oauthBtn, pressed && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <GoogleIcon />
                <Text style={s.oauthText}>Continuar com Google</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

        <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-back-outline" size={16} color={colors.sub} />
            <Text style={s.backText}>Voltar</Text>
          </Pressable>
        </Animated.View>

      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.h1,
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    ...typography.sub,
    textAlign: "center",
  },
  buttons: {
    gap: spacing.md,
  },
  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 54,
    borderRadius: radius.btn,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    ...shadow.card,
  },
  oauthText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  footer: {
    alignItems: "center",
    marginTop: "auto" as any,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  backText: {
    ...typography.sub,
    fontSize: 13,
    fontWeight: "600",
  },
});
