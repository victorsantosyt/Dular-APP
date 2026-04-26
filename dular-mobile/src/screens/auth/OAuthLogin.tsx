import { useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { radius, shadow, spacing, typography } from "@/theme/tokens";
import { AUTH_ROUTES } from "@/navigation/routes";
import { API_BASE_URL } from "@/lib/api";
import { useAuth } from "@/stores/authStore";

WebBrowser.maybeCompleteAuthSession();

const HERO = require("../../../assets/dular-hero.png");

type AuthParamList = {
  [AUTH_ROUTES.ROLE_SELECT]: undefined;
  [AUTH_ROUTES.OAUTH_LOGIN]: { role: "CLIENTE" | "DIARISTA" };
};

type Props = NativeStackScreenProps<AuthParamList, typeof AUTH_ROUTES.OAUTH_LOGIN>;

const ROLE_LABEL: Record<string, string> = {
  CLIENTE: "Cliente",
  DIARISTA: "Diarista",
};

export default function OAuthLogin({ route, navigation }: Props) {
  const { role } = route.params;
  const insets = useSafeAreaInsets();
  const { setSession } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  async function handleOAuth(provider: "google" | "apple") {
    if (!API_BASE_URL) {
      Alert.alert("Erro", "URL da API não configurada.");
      return;
    }
    const setLoading = provider === "google" ? setGoogleLoading : setAppleLoading;
    setLoading(true);
    try {
      const callbackUrl = encodeURIComponent(`/auth/callback/${role.toLowerCase()}?platform=mobile`);
      const loginUrl =
        provider === "google"
          ? `${API_BASE_URL}/api/auth/mobile-google?role=${role.toLowerCase()}&callbackUrl=${callbackUrl}`
          : `${API_BASE_URL}/api/auth/signin/apple?callbackUrl=${callbackUrl}`;
      console.log("[OAuthLogin] opening:", loginUrl);
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, "dular://auth");

      if (result.type !== "success") return;

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
    } catch {
      Alert.alert("Erro", "Não foi possível concluir o login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const anyLoading = googleLoading || appleLoading;

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

        {/* ── Logo ── */}
        <View style={s.logoWrap}>
          <Image source={HERO} style={s.hero} resizeMode="contain" />
          <Text style={s.brand}>dular.</Text>
        </View>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Entrar como {ROLE_LABEL[role]}</Text>
          <Text style={s.subtitle}>Escolha como deseja continuar</Text>
        </View>

        {/* ── Buttons ── */}
        <View style={s.buttons}>

          {/* Google */}
          <Pressable
            onPress={() => handleOAuth("google")}
            disabled={anyLoading}
            style={({ pressed }) => [s.btnGoogle, pressed && s.pressed]}
          >
            {googleLoading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <>
                <View style={s.googleG}>
                  <Text style={s.googleGText}>G</Text>
                </View>
                <Text style={s.btnGoogleText}>Continuar com Google</Text>
              </>
            )}
          </Pressable>

          {/* Apple */}
          <Pressable
            onPress={() => handleOAuth("apple")}
            disabled={anyLoading}
            style={({ pressed }) => [s.btnApple, pressed && s.pressed]}
          >
            {appleLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color="#fff" />
                <Text style={s.btnAppleText}>Continuar com Apple</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* ── Back ── */}
        <Pressable
          onPress={() => navigation.goBack()}
          disabled={anyLoading}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="arrow-back-outline" size={14} color="#6b7280" />
          <Text style={s.backText}>Voltar</Text>
        </Pressable>

      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#EAF5EF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  content: {
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
    gap: 32,
  },

  // Logo
  logoWrap: {
    alignItems: "center",
    gap: 4,
  },
  hero: {
    width: 52,
    height: 52,
  },
  brand: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f1a10",
    letterSpacing: -0.5,
    marginTop: 2,
  },

  // Header
  header: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f1a10",
    textAlign: "center",
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
  },

  // Buttons
  buttons: {
    width: "100%",
    gap: 12,
  },

  // Google button
  btnGoogle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 54,
    borderRadius: radius.btn,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    ...shadow.card,
  },
  googleG: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#4285F4",
    alignItems: "center",
    justifyContent: "center",
  },
  googleGText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 16,
  },
  btnGoogleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f1a10",
  },

  // Apple button
  btnApple: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    height: 54,
    borderRadius: radius.btn,
    backgroundColor: "#0f1a10",
    ...shadow.card,
  },
  btnAppleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Pressed state
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },

  // Back
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    marginTop: -8,
  },
  backText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
});
