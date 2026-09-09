import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as WebBrowser from "expo-web-browser";
import { AppIcon, BackCircleButton, DCard } from "@/components/ui";
import { DularLogo } from "@/assets/brand";
import { PageDots } from "@/components/onboarding/PageDots";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { api, API_BASE_URL } from "@/lib/api";
import { markOnboardingSeen } from "@/lib/onboarding";
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

WebBrowser.maybeCompleteAuthSession();

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type Provider = "google" | "apple";
type AuthRole = "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";
const MOBILE_AUTH_REDIRECT = "dular://auth/callback";
const LOGIN_LOGO_CENTRAL_ASSET = "assets/images/auth/login_logo_central.png";
const LOGIN_LOGO_EDGE_COLOR = "#fbf7ff";
const loginLogoCentral = require("../../../assets/images/auth/login_logo_central.png");

const roleLabels: Record<AuthRole, string> = {
  EMPREGADOR: "Empregador",
  DIARISTA: "Diarista",
  MONTADOR: "Montador",
  ADMIN: "Admin",
};

function normalizeAuthRole(value: string | null): AuthRole | null {
  const normalized = value?.trim().toUpperCase();
  if (
    normalized === "EMPREGADOR" ||
    normalized === "DIARISTA" ||
    normalized === "MONTADOR" ||
    normalized === "ADMIN"
  ) {
    return normalized;
  }
  return null;
}

function getRoleParam(params: URLSearchParams, keys: string[]): AuthRole | null {
  for (const key of keys) {
    const role = normalizeAuthRole(params.get(key));
    if (role) return role;
  }
  return null;
}

const providerLabels: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
};

function getRoleMismatchMessage(
  provider: Provider,
  params: URLSearchParams,
  requestedFallback: AuthRole | null,
) {
  const linkedRole = getRoleParam(params, [
    "linkedRole",
    "existingRole",
    "currentRole",
    "actualRole",
    "accountRole",
    "role",
  ]);
  const requestedRole =
    getRoleParam(params, ["requestedRole", "expectedRole", "targetRole", "selectedRole"]) ?? requestedFallback;

  const linkedRoleLabel = linkedRole ? roleLabels[linkedRole] : "outro perfil";
  const requestedRoleLabel = requestedRole ? roleLabels[requestedRole] : "o perfil selecionado";

  const providerLabel = providerLabels[provider];
  return [
    `Esta conta ${providerLabel} já está vinculada ao perfil ${linkedRoleLabel}.`,
    `Para entrar como ${requestedRoleLabel}, use outra conta ${providerLabel}.`,
  ].join(" ");
}

function getOAuthUrlWarning(provider: Provider, value: string) {
  const providerLabel = providerLabels[provider];
  try {
    const url = new URL(value);
    const host = url.hostname;
    const privateIp =
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (url.protocol !== "https:") {
      return privateIp
        ? `O app está apontando para um IP LAN. Para ${providerLabel} OAuth no Expo Go físico, use uma URL HTTPS pública via ngrok.`
        : `Para ${providerLabel} OAuth no Expo Go físico, use uma URL HTTPS pública no EXPO_PUBLIC_API_URL.`;
    }
    return null;
  } catch {
    return `URL da API inválida para iniciar o ${providerLabel} OAuth.`;
  }
}

/**
 * Marca oficial do Google (o "G" de quatro cores), em SVG.
 *
 * Antes era montada à mão: quatro quadrados coloridos num círculo com a letra
 * "G" por cima. De longe lembrava, de perto não era o logo — as cores ficavam
 * em blocos retos em vez do traço curvo, e a letra era a fonte do app, não a
 * do Google. Ambas as marcas têm regras de uso; reproduzi-las aproximadamente
 * é justamente o que elas proíbem.
 */
function GoogleLogo() {
  return (
    <View style={styles.googleLogoOuter}>
      <Svg width={18} height={18} viewBox="0 0 48 48">
        <Path
          fill="#4285F4"
          d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
        />
        <Path
          fill="#34A853"
          d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
        />
        <Path
          fill="#FBBC05"
          d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
        />
        <Path
          fill="#EA4335"
          d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
        />
      </Svg>
    </View>
  );
}

/**
 * Maçã oficial da Apple, em SVG. O `logo-apple` do Ionicons é um desenho
 * aproximado — a folha e a mordida têm proporções próprias, diferentes da
 * marca registrada.
 */
function AppleLogo() {
  return (
    <View style={styles.appleLogoBox}>
      <Svg width={15} height={18} viewBox="0 0 814 1000">
        <Path
          fill={colors.black}
          d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"
        />
      </Svg>
    </View>
  );
}

function LoginLogo() {
  if (loginLogoCentral) {
    return (
      <Image
        source={loginLogoCentral}
        style={styles.logoImage}
        // "cover" é o ajuste automático: escala a arte para preencher a caixa
        // em qualquer tela, centralizada, cortando o excesso. O "contain" de
        // antes fazia o oposto — cabia a arte inteira e sobrava faixa da cor
        // do cartão nas beiradas, que era a borda branca visível.
        resizeMode="cover"
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
  const servicosOferecidos = useAuthStore((state) => state.servicosOferecidos);
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
    // FASE 3 — gênero deixou de ser requisito pré-login. Só a role é exigida
    // antes do OAuth; o gênero é coletado pós-login pelo GeneroGate quando faltar.
    if (!preLoginRole || !callbackRole) {
      navigation.replace("RoleSelect");
    }
  }, [navigation, callbackRole, preLoginRole]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace("RoleSelect");
  };

  // ── Login por senha — SOMENTE EM DESENVOLVIMENTO ──────────────────────────
  // `__DEV__` é false em build de produção, então este bloco inteiro (estado,
  // handler e UI) some do app publicado.
  //
  // Existe porque o app é OAuth-only e o simulador tem uma conta Google só:
  // sem isto não há como testar os perfis de montador e empregador, já que
  // cada um tem sua própria conta.
  const [devTelefone, setDevTelefone] = useState("");
  const [devSenha, setDevSenha] = useState("");
  const [devEntrando, setDevEntrando] = useState(false);

  const handleDevLogin = useCallback(async () => {
    if (!devTelefone.trim() || !devSenha) {
      Alert.alert("Faltam dados", "Informe telefone e senha.");
      return;
    }
    setDevEntrando(true);
    try {
      const res = await api.post<{ token?: string; user?: { role?: string } }>(
        "/api/auth/login",
        { login: devTelefone.trim(), senha: devSenha },
      );
      const token = res.data?.token;
      const role = res.data?.user?.role;
      if (!token || !role) {
        Alert.alert("Erro", "Resposta inválida do servidor.");
        return;
      }
      await markOnboardingSeen();
      await setSession({ token, role: role as never });
    } catch (e: any) {
      Alert.alert(
        "Não foi possível entrar",
        e?.response?.data?.message ?? e?.response?.data?.error ?? "Confira telefone e senha.",
      );
    } finally {
      setDevEntrando(false);
    }
  }, [devTelefone, devSenha, setSession]);

  const handleOAuthLogin = async (provider: Provider) => {
    if (!callbackRole) {
      Alert.alert("Perfil obrigatório", "Escolha Empregador, Diarista ou Montador antes de fazer login.");
      navigation.replace("RoleSelect");
      return;
    }

    if (!API_BASE_URL) {
      Alert.alert("Erro", "URL da API não configurada.");
      return;
    }

    // Apple e Google exigem HTTPS público para o fluxo OAuth em aparelho físico.
    const oauthWarning = getOAuthUrlWarning(provider, API_BASE_URL);
    if (oauthWarning) {
      Alert.alert(
        `${providerLabels[provider]} OAuth no aparelho`,
        `${oauthWarning}\n\nUse a mesma URL no AUTH_URL do backend para manter os cookies do NextAuth no mesmo domínio.`,
      );
      return;
    }

    setLoadingProvider(provider);
    try {
      // FASE 5C — gênero não é mais coletado no pré-login; é definido pós-login
      // pelo GeneroGate (backend é a fonte). O callback não recebe mais genero.
      const callbackPath = `/auth/callback/${callbackRole}?platform=mobile`;
      // Ambos os providers usam o proxy mobile do backend: NextAuth v5 não
      // inicia OAuth com GET em /api/auth/signin/:provider.
      const loginUrl = new URL(
        provider === "google" ? "/api/auth/mobile-google" : "/api/auth/mobile-apple",
        API_BASE_URL,
      );
      loginUrl.searchParams.set("role", callbackRole);
      loginUrl.searchParams.set("callbackUrl", callbackPath);

      const result = await WebBrowser.openAuthSessionAsync(loginUrl.toString(), MOBILE_AUTH_REDIRECT);
      if (result.type !== "success") return;

      const url = new URL(result.url);
      const token = url.searchParams.get("token");
      const requestedRole = normalizeAuthRole(preLoginRole);
      const returnedRole = normalizeAuthRole(url.searchParams.get("role"));
      const error = url.searchParams.get("error");

      if (error) {
        if (error.toUpperCase() === "ROLE_MISMATCH") {
          Alert.alert(
            `Perfil ${providerLabels[provider]} já vinculado`,
            getRoleMismatchMessage(provider, url.searchParams, requestedRole),
          );
          return;
        }

        Alert.alert("Erro", error === "no_role" ? "Perfil sem role definido." : "Falha na autenticação.");
        return;
      }

      if (!token || !returnedRole) {
        Alert.alert("Erro", "Resposta inválida do servidor.");
        return;
      }

      await markOnboardingSeen();
      await setSession({ token, role: returnedRole });
      if (returnedRole === "DIARISTA") {
        try {
          await api.patch("/api/diarista/me", {
            servicosOferecidos: servicosOferecidos.length > 0 ? servicosOferecidos : ["DIARISTA"],
          });
        } catch {
          // O login não deve falhar se a sincronização dos serviços não completar.
        }
      }
    } catch {
      Alert.alert("Erro", "Não foi possível concluir o login. Tente novamente.");
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <BackCircleButton onPress={handleBack} color={colors.primary} />
        <View style={styles.headerCenter}>
          <PageDots total={2} active={1} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            Faça seu <Text style={styles.titleAccent}>login</Text>
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

        {__DEV__ ? (
          <View style={styles.devBox}>
            <Text style={styles.devTitulo}>Entrar por senha (dev)</Text>
            <Text style={styles.devAviso}>
              Só aparece em desenvolvimento. Serve para alternar entre os perfis sem OAuth.
            </Text>
            <TextInput
              value={devTelefone}
              onChangeText={setDevTelefone}
              placeholder="Telefone"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              autoCapitalize="none"
              style={styles.devInput}
            />
            <TextInput
              value={devSenha}
              onChangeText={setDevSenha}
              placeholder="Senha"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              style={styles.devInput}
            />
            <Pressable
              onPress={handleDevLogin}
              disabled={devEntrando}
              style={({ pressed }) => [styles.devBotao, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.devBotaoTexto}>{devEntrando ? "Entrando…" : "Entrar"}</Text>
            </Pressable>
          </View>
        ) : null}

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
      {/* Marca + rótulo centralizados como um bloco só. A seta saiu junto:
          ela sugere "abrir uma tela", e estes botões disparam uma ação de
          login — e, com o conteúdo centralizado, um elemento preso à direita
          deixava o grupo fora de eixo. O indicador de carregamento entra no
          lugar da marca, mantendo o bloco no mesmo ponto. */}
      <View style={styles.loginRow}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {provider === "apple" ? <AppleLogo /> : <GoogleLogo />}
            <Text style={styles.loginLabel}>{label}</Text>
          </>
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
    // Sem `transform` nem cor de fundo: o scale 1.09 e o translateY 7 eram
    // números calibrados num aparelho só, para empurrar a arte por cima da
    // faixa do "contain". Em tela mais larga ou mais estreita eles erravam o
    // alvo — ora sobrava borda, ora cortava a ilustração torto.
  },
  titleBlock: {
    gap: spacing.sm,
  },
  title: {
    // Mesmo token das telas de onboarding: um só lugar define o título do
    // fluxo inteiro, do primeiro passo até o login.
    ...typography.onboardingTitle,
    color: colors.textPrimary,
    textAlign: "center",
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
    // Proporção da própria arte (1536x1024 = 3:2) em vez de altura fixa: a
    // caixa acompanha a largura do aparelho e bate exatamente com a imagem,
    // então o "cover" não corta nada em nenhuma tela. O teto evita que ela
    // domine a tela em aparelho muito largo.
    width: "100%",
    aspectRatio: 3 / 2,
    maxHeight: 260,
    borderRadius: radius.xxl,
    backgroundColor: LOGIN_LOGO_EDGE_COLOR,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // Sem borda: a linha de 1px em #eadffd era a moldura clara em volta da
    // ilustração.
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
    justifyContent: "center",
    gap: spacing.md,
    minHeight: 24,
  },
  appleLogoBox: {
    // Sem caixa preta: o botão do Google mostra a marca solta sobre o cartão
    // claro, e o quadrado escuro em volta da maçã destoava. A marca da Apple
    // sobre fundo claro é usada em preto, sem contorno.
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogoOuter: {
    // Sem círculo nem borda: o "G" já é a marca completa e o anel branco só
    // criava uma diferença de tratamento em relação ao botão da Apple.
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
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
  // ── bloco de login por senha (só DEV) ──────────────────────────────────
  devBox: {
    marginTop: spacing.lg,
    marginHorizontal: 24,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  devTitulo: { ...typography.bodySmMedium, color: colors.textPrimary, fontWeight: "700" },
  devAviso: { ...typography.caption, color: colors.textMuted },
  devInput: {
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    fontSize: 15,
  },
  devBotao: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  devBotaoTexto: { ...typography.bodySmMedium, color: colors.textOnPrimary, fontWeight: "700" },
});
