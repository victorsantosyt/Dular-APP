import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { AppIcon, DCard } from "@/components/ui";
import { DularLogo } from "@/assets/brand";
import { LoginSecurity3DIcon } from "@/assets/icons";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { API_BASE_URL } from "@/lib/api";
import { markOnboardingSeen } from "@/lib/onboarding";
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

WebBrowser.maybeCompleteAuthSession();

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type Provider = "google" | "apple";

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

export function LoginScreen() {
  const navigation = useNavigation<Navigation>();
  const role = useAuthStore((state) => state.role);
  const setSession = useAuthStore((state) => state.setSession);
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);

  const selectedRole =
    role === "DIARISTA"
      ? "diarista"
      : role === "EMPREGADOR"
        ? "cliente"
        : role === "MONTADOR"
          ? "montador"
          : null;

  useEffect(() => {
    if (!selectedRole) {
      navigation.replace("RoleSelect");
    }
  }, [navigation, selectedRole]);

  const handleOAuthLogin = async (provider: Provider) => {
    if (!selectedRole) {
      Alert.alert("Perfil obrigatório", "Escolha Empregador, Diarista ou Montador antes de fazer login.");
      navigation.replace("RoleSelect");
      return;
    }

    if (!API_BASE_URL) {
      Alert.alert("Erro", "URL da API não configurada.");
      return;
    }

    setLoadingProvider(provider);
    try {
      const callbackUrl = encodeURIComponent(`/auth/callback/${selectedRole}?platform=mobile`);
      const loginUrl =
        provider === "google"
          ? `${API_BASE_URL}/api/auth/mobile-google?role=${selectedRole}&callbackUrl=${callbackUrl}`
          : `${API_BASE_URL}/api/auth/signin/apple?callbackUrl=${callbackUrl}`;

      const result = await WebBrowser.openAuthSessionAsync(loginUrl, "dular://auth");
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
        <StepperComponent step={2} total={2} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <DularLogo size="md" />
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            Vamos fazer seu login <Text style={styles.titleAccent}>para continuar</Text>
          </Text>
          <Text style={styles.subtitle}>
            Entre com uma conta segura para acessar seu perfil no Dular.
          </Text>
        </View>

        <View style={styles.illustration}>
          <LoginSecurity3DIcon size={180} />
          <View style={styles.sparkleTop}>
            <AppIcon name="Sparkles" size={22} color={colors.primary} strokeWidth={2.4} />
          </View>
          <View style={styles.sparkleBottom}>
            <AppIcon name="Sparkles" size={22} color={colors.accent} strokeWidth={2.4} />
          </View>
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

        <View style={styles.securityTextRow}>
          <AppIcon name="Lock" size={16} color="purple" />
          <Text style={styles.securitySmallText}>
            Não compartilhamos seus dados sem autorização. Sua conta fica protegida com autenticação segura.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <AppIcon name="ShieldCheck" variant="soft" color="purple" />
          <View style={styles.infoText}>
          <Text style={styles.infoTitle}>Segurança em primeiro lugar</Text>
          <Text style={styles.infoSubtitle}>Todas as contas são verificadas para proteger clientes e diaristas.</Text>
        </View>
          <AppIcon name="Sparkles" size={20} color={colors.accent} strokeWidth={2.4} />
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
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
    fontSize: 13,
    fontWeight: "800",
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
  logoWrap: {
    alignSelf: "center",
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    textAlign: "center",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
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
    height: 180,
    borderRadius: radius.xxl,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.soft,
  },
  sparkleTop: {
    position: "absolute",
    top: spacing.lg,
    right: spacing.xl,
  },
  sparkleBottom: {
    position: "absolute",
    bottom: spacing.lg,
    left: spacing.xl,
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
    fontSize: 11,
    fontWeight: "700",
    color: colors.googleBlue,
    lineHeight: 14,
  },
  loginLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  securityTextRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  securitySmallText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  infoText: {
    flex: 1,
    gap: spacing.xs,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
  },
  infoSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
