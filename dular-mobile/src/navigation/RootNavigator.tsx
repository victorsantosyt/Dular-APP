import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as ExpoSplashScreen from "expo-splash-screen";
import OnboardingNavigator from "@/navigation/OnboardingNavigator";
import { GeneroGateScreen } from "@/screens/onboarding/GeneroGateScreen";
import { NichosGateScreen } from "@/screens/onboarding/NichosGateScreen";
import { MontadorEspecialidadesGateScreen } from "@/screens/onboarding/MontadorEspecialidadesGateScreen";
import EmpregadorNavigator from "@/navigation/EmpregadorNavigator";
import DiaristaNavigator from "@/navigation/DiaristaNavigator";
import MontadorNavigator from "@/navigation/MontadorNavigator";
import { useAuthStore } from "@/stores/authStore";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { hasSeenOnboarding, resetOnboardingSeen, shouldResetOnboardingInDev } from "@/lib/onboarding";
import { ThemeScope } from "@/contexts/ThemeContext";
import { CadastroEnderecoScreen } from "@/screens/shared/CadastroEnderecoScreen";
import { DadosPessoaisGateScreen } from "@/screens/onboarding/DadosPessoaisGateScreen";
import { fetchEnderecos } from "@/api/enderecoApi";
import { useSincronizarBadge } from "@/hooks/useSincronizarBadge";
import { colors } from "@/theme";
import { getAuthenticatedGate } from "@/stores/authBootstrap";

function PushNotificationsGate({ children }: { children: React.ReactNode }) {
  usePushNotifications();
  // Aqui, e não em cada navegador: envolve os três perfis, roda depois de
  // todos os gates e já é o lugar do app que cuida de push.
  useSincronizarBadge();
  return <>{children}</>;
}

// Gate de endereço (self-contained, NÃO toca no authStore): consulta
// GET /api/me/enderecos no mount. Vazio → tela de cadastro; tem endereço →
// renderiza o app. Falha de rede não bloqueia. Aparece após os gates de
// gênero/catálogo, antes da Home.
function EnderecoGate({
  role,
  children,
}: {
  role: "EMPREGADOR" | "DIARISTA" | "MONTADOR";
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<"loading" | "need" | "ok">("loading");

  useEffect(() => {
    let alive = true;
    fetchEnderecos()
      .then((list) => {
        if (alive) setStatus(list.length > 0 ? "ok" : "need");
      })
      .catch(() => {
        if (alive) setStatus("ok");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (status === "loading") return <View style={styles.bootScreen} />;
  if (status === "need") {
    return (
      <ThemeScope forceLight>
        <CadastroEnderecoScreen role={role} mode="onboarding" onDone={() => setStatus("ok")} />
      </ThemeScope>
    );
  }
  return <>{children}</>;
}

function AuthenticatedFlow({ role, onboardingSeen }: { role: string | null; onboardingSeen: boolean }) {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  const gate = getAuthenticatedGate(role, user);

  // FASE 3 (gate de gênero, subset seguro): conta autenticada que ainda não tem
  // gênero o define agora — grava no backend (fonte de verdade) e o gate some.
  // Para contas que já têm gênero, esta tela nunca aparece. Não toca login/OAuth.
  if (gate === "genero") {
    return (
      <ThemeScope forceLight>
        <GeneroGateScreen />
      </ThemeScope>
    );
  }

  // Gate de dados pessoais (mesmo padrão do gênero): CPF e data de nascimento
  // contam na completude do perfil e não tinham NENHUMA tela que os coletasse
  // — todo mundo ficava travado em "Perfil incompleto" para sempre. Vale para
  // os três papéis e aparece uma vez só.
  if (gate === "dados-pessoais") {
    return (
      <ThemeScope forceLight>
        <DadosPessoaisGateScreen />
      </ThemeScope>
    );
  }

  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === "empregador") {
    return (
      <PushNotificationsGate>
        <EnderecoGate role="EMPREGADOR">
          <EmpregadorNavigator />
        </EnderecoGate>
      </PushNotificationsGate>
    );
  }
  if (normalizedRole === "diarista") {
    // Gate de serviços oferecidos (pós-login, mesmo padrão do gênero): a
    // profissional de casa que ainda não escolheu nenhum serviço define agora —
    // grava no backend (fonte de verdade) e o gate some. Garante que o perfil
    // já nasça com os serviços certos, evitando pedidos fora do que ela faz.
    if (gate === "nichos") {
      return (
        <ThemeScope forceLight>
          <NichosGateScreen />
        </ThemeScope>
      );
    }
    return (
      <PushNotificationsGate>
        <EnderecoGate role="DIARISTA">
          <DiaristaNavigator />
        </EnderecoGate>
      </PushNotificationsGate>
    );
  }
  if (normalizedRole === "montador") {
    // Gate de especialidades (pós-login, mesmo padrão da diarista): o montador
    // que ainda não escolheu nenhuma especialidade define agora — grava no
    // backend e o gate some. Aparece só uma vez (conta nova).
    if (gate === "especialidades") {
      return (
        <ThemeScope forceLight>
          <MontadorEspecialidadesGateScreen />
        </ThemeScope>
      );
    }
    return (
      <PushNotificationsGate>
        <EnderecoGate role="MONTADOR">
          <MontadorNavigator />
        </EnderecoGate>
      </PushNotificationsGate>
    );
  }

  const initialRouteName = onboardingSeen ? "RoleSelect" : "Splash";
  return (
    <ThemeScope forceLight>
      <OnboardingNavigator key={initialRouteName} initialRouteName={initialRouteName} />
    </ThemeScope>
  );
}

function BootstrapRecovery({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.recoveryScreen}>
      <Text style={styles.recoveryTitle}>Não foi possível abrir sua conta</Text>
      <Text style={styles.recoveryMessage}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryButtonText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

function BootstrapLoading() {
  return (
    <View style={styles.bootScreen}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

type RootNavigatorProps = {
  fontsReady?: boolean;
};

export function RootNavigator({ fontsReady = true }: RootNavigatorProps) {
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const bootstrapStatus = useAuthStore((state) => state.bootstrapStatus);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const hydrate = useAuthStore((state) => state.hydrate);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  const splashHiddenRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        await hydrate();
      } finally {
        try {
          if (shouldResetOnboardingInDev()) {
            await resetOnboardingSeen();
          }
          const seen = await hasSeenOnboarding();
          if (mounted) setOnboardingSeen(seen);
        } catch {
          if (mounted) setOnboardingSeen(false);
        }
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [hydrate]);

  useEffect(() => {
    const isReadyToRender =
      fontsReady && bootstrapStatus !== "bootstrapping" && onboardingSeen !== null;
    if (isReadyToRender && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      void ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [bootstrapStatus, fontsReady, onboardingSeen]);

  if (!fontsReady || bootstrapStatus === "bootstrapping" || onboardingSeen === null) {
    return <BootstrapLoading />;
  }

  if (bootstrapStatus === "error") {
    return <BootstrapRecovery message={bootstrapError ?? "Tente novamente."} onRetry={() => { void hydrate(); }} />;
  }

  if (bootstrapStatus === "unauthenticated") {
    const initialRouteName = onboardingSeen ? "RoleSelect" : "Splash";
    return (
      <ThemeScope forceLight>
        <OnboardingNavigator key={initialRouteName} initialRouteName={initialRouteName} />
      </ThemeScope>
    );
  }

  // Invariante do bootstrap: este estado só é publicado depois de /api/me
  // devolver usuário canônico. Nunca usar cache parcial como evidência para
  // montar um gate de cadastro.
  if (bootstrapStatus !== "authenticated" || !user) {
    return <BootstrapRecovery message="Não foi possível validar sua sessão." onRetry={() => { void hydrate(); }} />;
  }

  return <AuthenticatedFlow role={role} onboardingSeen={onboardingSeen} />;
}

export default RootNavigator;

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  recoveryScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  recoveryTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  recoveryMessage: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
