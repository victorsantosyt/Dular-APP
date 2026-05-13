import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { AppIcon, DCard } from "@/components/ui";
import { DularLogo } from "@/assets/brand";
import { PageDots } from "@/components/onboarding/PageDots";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { API_BASE_URL } from "@/lib/api";
import { markOnboardingSeen } from "@/lib/onboarding";
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

WebBrowser.maybeCompleteAuthSession();

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type Provider = "google" | "apple";
const MOBILE_AUTH_REDIRECT = "dular://auth/callback";
const LOGIN_LOGO_CENTRAL_ASSET = "assets/images/auth/login_logo_central.png";
const LOGIN_LOGO_EDGE_COLOR = "#fbf7ff";
const loginLogoCentral = require("../../../assets/images/auth/login_logo_central.png");

function getGoogleOAuthUrlWarning(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    const privateIp =
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (url.protocol !== "https:") {
      return privateIp
        ? "O app está apontando para um IP LAN. Para Google OAuth no Expo Go físico, use uma URL HTTPS pública via ngrok."
        : "Para Google OAuth no Expo Go físico, use uma URL HTTPS pública no EXPO_PUBLIC_API_URL.";
    }
    return null;
  } catch {
    return "URL da API inválida para iniciar o Google OAuth.";
  }
}

function StepperComponent({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.stepperWrap}>
      <View style={styles.stepperRow}>
        {Array.from({ length: total }).map((_, index) => {
          const number = index + 1;
          const done = number < step;
          const active = number <= step;
          return (
            <React.Fragment key={number}>
              <View style={[styles.stepCircle, active ? styles.stepCircleActive : styles.stepCircleIdle]}>
                {done ? (
                  <AppIcon name="Check" size={15} color={colors.surface} strokeWidth={3} />
                ) : (
                  <Text style={[styles.stepText, active ? styles.stepTextActive : styles.stepTextIdle]}>
                    {number}
                  </Text>
                )}
              </View>
              {number < total ? (
                <View style={[styles.stepLine, number < step ? styles.stepLineDone : styles.stepLineIdle]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={styles.stepCaption}>{step} de {total}</Text>
    </View>
  );
}

function GoogleLogo() {
  return (
    <View style={styles.googleLogoOuter}>
      <View style={styles.googleLogoInner}>
        <View style={[styles.googleQuadrant, styles.googleQuadrantTL]} />
        <View style={[styles.googleQuadrant, styles.googleQuadrantTR]} />
        <View style={[styles.googleQuadrant, styles.googleQuadrantBL]} />
        <View style={[styles.googleQuadrant, styles.googleQuadrantBR]} />
        <View style={styles.googleCenter}>
          <Text style={styles.googleG}>G</Text>
        </View>
      </View>
    </View>
  );
}

function AppleLogo() {
  return (
    <View style={styles.appleLogoBox}>
      <Ionicons name="logo-apple" size={19} color={colors.white} />
    </View>
  );
}

function LoginLogo() {
  if (loginLogoCentral) {
    return (
      <Image
        source={loginLogoCentral}
        style={styles.logoImage}
        resizeMode="contain"
      />
    );
  }

  return (
    <View style={styles.logoFallback} accessibilityLabel={`Fallback para ${LOGIN_LOGO_CENTRAL_ASSET}`}>
      <DularLogo size="md" />
    </View>
  );
}

export function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const preLoginRole = useAuthStore((state) => state.selectedRole);
  const preLoginGenero = useAuthStore((state) => state.selectedGenero);
  const setSession = useAuthStore((state) => state.setSession);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const callbackRole =
    preLoginRole === "DIARISTA"
      ? "diarista"
      : preLoginRole === "EMPREGADOR"
        ? "empregador"
        : preLoginRole === "MONTADOR"
          ? "montador"
          : null;

  useEffect(() => {
    if (!preLoginRole || !callbackRole) {
      navigation.replace("RoleSelect");
      return;
    }
    if (!preLoginGenero) {
      navigation.replace("GeneroSelect");
    }
  }, [navigation, callbackRole, preLoginGenero, preLoginRole]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace("GeneroSelect");
  };

  const handleOAuthLogin = async (provider: Provider) => {
    if (!callbackRole) {
      Alert.alert("Perfil obrigatório", "Escolha Empregador, Diarista ou Montador antes de fazer login.");
      navigation.replace("RoleSelect");
      return;
    }

    if (!preLoginGenero) {
      Alert.alert("Gênero obrigatório", "Escolha Homem ou Mulher antes de fazer login.");
      navigation.replace("GeneroSelect");
      return;
    }

    if (!API_BASE_URL) {
      Alert.alert("Erro", "URL da API não configurada.");
      return;
    }

    const googleOAuthWarning = provider === "google" ? getGoogleOAuthUrlWarning(API_BASE_URL) : null;
    if (googleOAuthWarning) {
      Alert.alert(
        "Google OAuth no aparelho",
        `${googleOAuthWarning}\n\nUse a mesma URL no AUTH_URL do backend para manter os cookies do NextAuth no mesmo domínio.`,
      );
      return;
    }

    setLoadingProvider(provider);
    try {
      const callbackPath = `/auth/callback/${callbackRole}?platform=mobile&genero=${preLoginGenero}`;
      const loginUrl = new URL(
        provider === "google" ? "/api/auth/mobile-google" : "/api/auth/signin/apple",
        API_BASE_URL,
      );
      if (provider === "google") loginUrl.searchParams.set("role", callbackRole);
      loginUrl.searchParams.set("callbackUrl", callbackPath);

      const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), MOBILE_AUTH_REDIRECT);
      if (result.type !== "success") return;

      const url = new URL(result.url);
      const token = url.searchParams.get("token");
      const returnedRole = url.searchParams.get("role") as "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN" | null;
      const error = url.searchParams.get("error");

      if (error) {
        Alert.alert("Erro", error === "no_role" ? "Perfil sem role definido." : "Falha na autenticação.");
        return;
      }

      if (!token || !returnedRole) {
        Alert.alert("Erro", "Resposta inválida do servidor.");
        return;
      }

      await markOnboardingSeen();
      await setSession({ token, role: returnedRole });
    } catch {
      Alert.alert("Erro", "Não foi possível concluir o login. Tente novamente.");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voltar para escolha de gênero"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <AppIcon name="ArrowLeft" size={20} color={colors.primary} strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerCenter}>
          <PageDots total={3} active={2} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            Vamos fazer seu login <Text style={styles.titleAccent}>para continuar</Text>
          </Text>
          <Text style={styles.subtitle}>
            Entre com uma conta segura para acessar seu perfil no Dular.
          </Text>
        </View>

        <View style={styles.illustration}>
          <LoginLogo />
        </View>

        <View style={styles.loginButtons}>
          <LoginCard
            provider="google"
            label="Continuar com Google"
            loading={loadingProvider === "google"}
            disabled={!!loadingProvider}
            onPress={() => handleOAuthLogin("google")}
          />
          <LoginCard
            provider="apple"
            label="Continuar com Apple"
            loading={loadingProvider === "apple"}
            disabled={!!loadingProvider}
            onPress={() => handleOAuthLogin("apple")}
          />
        </View>

        <View style={styles.infoCard}>
          <AppIcon name="ShieldCheck" variant="soft" color="purple" />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Segurança em primeiro lugar</Text>
            <Text style={styles.infoSubtitle}>Todas as contas são verificadas para proteger empregadores e profissionais.</Text>
          </View>
          <AppIcon name="Sparkles" size={20} color={colors.accent} strokeWidth={2.4} />
        </View>

        <View style={styles.securityTextRow}>
          <AppIcon name="Lock" size={16} color="purple" />
          <Text style={styles.securitySmallText}>
            Não compartilhamos seus dados sem autorização. Sua conta fica protegida com autenticação segura.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoginCard({
  provider,
  label,
  loading,
  disabled,
  onPress,
}: {
  provider: Provider;
  label: string;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <DCard style={styles.loginCard} onPress={disabled ? undefined : onPress}>
      <View style={styles.loginRow}>
        <View style={styles.loginLabelRow}>
          {provider === "apple" ? <AppleLogo /> : <GoogleLogo />}
          <Text style={styles.loginLabel}>{label}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <AppIcon name="ChevronRight" size={20} color={colors.textSecondary} />
        )}
      </View>
    </DCard>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    minHeight: 58,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.72,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: {
    width: 40,
  },
  stepperWrap: {
    alignItems: "center",
    gap: spacing.xs,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: colors.primary,
  },
  stepCircleIdle: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  stepText: {
    ...typography.bodySm,
    fontWeight: "700",
  },
  stepTextActive: {
    color: colors.surface,
  },
  stepTextIdle: {
    color: colors.textSecondary,
  },
  stepLine: {
    width: 38,
    height: 2,
    marginHorizontal: spacing.xs,
  },
  stepLineDone: {
    backgroundColor: colors.primary,
  },
  stepLineIdle: {
    backgroundColor: colors.border,
  },
  stepCaption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing["4xl"],
    gap: spacing.xl,
  },
  logoFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LOGIN_LOGO_EDGE_COLOR,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: LOGIN_LOGO_EDGE_COLOR,
    transform: [{ scale: 1.09 }, { translateY: 7 }],
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    textAlign: "center",
    ...typography.h1,
    
    fontWeight: "700",
    color: colors.textPrimary,
  },
  titleAccent: {
    color: colors.accent,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: "center",
  },
  illustration: {
    height: 224,
    borderRadius: radius.xxl,
    backgroundColor: LOGIN_LOGO_EDGE_COLOR,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eadffd",
    ...shadows.soft,
  },
  loginButtons: {
    gap: spacing.md,
  },
  loginCard: {
    padding: spacing.lg,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loginLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  appleLogoBox: {
    width: 24,
    height: 24,
    backgroundColor: colors.black,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogoOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  googleLogoInner: {
    width: 24,
    height: 24,
    position: "relative",
  },
  googleQuadrant: {
    position: "absolute",
    width: 12,
    height: 12,
  },
  googleQuadrantTL: {
    top: 0,
    left: 0,
    backgroundColor: colors.googleBlue,
  },
  googleQuadrantTR: {
    top: 0,
    right: 0,
    backgroundColor: colors.googleRed,
  },
  googleQuadrantBL: {
    bottom: 0,
    left: 0,
    backgroundColor: colors.googleGreen,
  },
  googleQuadrantBR: {
    bottom: 0,
    right: 0,
    backgroundColor: colors.googleYellow,
  },
  googleCenter: {
    position: "absolute",
    top: 4,
    left: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  googleG: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.googleBlue,
    
  },
  loginLabel: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  securityTextRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    maxWidth: 330,
    marginTop: -spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  securitySmallText: {
    flexShrink: 1,
    ...typography.caption,
    
    color: colors.textSecondary,
    textAlign: "center",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.lavenderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.lavender,
  },
  infoText: {
    flex: 1,
    gap: spacing.xs,
  },
  infoTitle: {
    ...typography.bodySmMedium,
    fontWeight: "700",
    color: colors.primary,
  },
  infoSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
