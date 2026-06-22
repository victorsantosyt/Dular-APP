import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
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
import { fetchEnderecos } from "@/api/enderecoApi";
import { colors } from "@/theme";

function PushNotificationsGate({ children }: { children: React.ReactNode }) {
  usePushNotifications();
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

  // FASE 3 (gate de gênero, subset seguro): conta autenticada que ainda não tem
  // gênero o define agora — grava no backend (fonte de verdade) e o gate some.
  // Para contas que já têm gênero, esta tela nunca aparece. Não toca login/OAuth.
  if (user && user.genero == null) {
    return (
      <ThemeScope forceLight>
        <GeneroGateScreen />
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
    if (user && (user.servicosOferecidos?.length ?? 0) === 0) {
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
    if (user && (user.especialidades?.length ?? 0) === 0) {
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

export function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrate = useAuthStore((state) => state.hydrate);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

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
    if (hydrated && onboardingSeen !== null) {
      ExpoSplashScreen.hideAsync().catch(() => {});
    }
  }, [hydrated, onboardingSeen]);

  if (!hydrated || onboardingSeen === null) {
    return <View style={styles.bootScreen} />;
  }

  if (!isAuthenticated) {
    const initialRouteName = onboardingSeen ? "RoleSelect" : "Splash";
    return (
      <ThemeScope forceLight>
        <OnboardingNavigator key={initialRouteName} initialRouteName={initialRouteName} />
      </ThemeScope>
    );
  }

  // FASE 5B — autenticado mas objeto user ainda não resolvido (ex.: hydrate sem
  // cache aguardando /api/me): segura na tela de boot. Nunca avança para o app
  // nem pula o gate de gênero com user == null.
  if (!user) {
    return <View style={styles.bootScreen} />;
  }

  return <AuthenticatedFlow role={role} onboardingSeen={onboardingSeen} />;
}

export default RootNavigator;

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
