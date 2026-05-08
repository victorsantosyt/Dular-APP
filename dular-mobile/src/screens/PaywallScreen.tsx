import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";
import { useRestricoes } from "@/hooks/useRestricoes";
import { AppIcon } from "@/components/ui";
import PlanoCard from "@/components/ui/PlanoCard";
import { colors, radius, spacing, typography } from "@/theme/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type Plano = "BASICO" | "PLUS" | "PREMIUM";

type PlanoInfo = {
  id: Plano;
  nome: string;
  preco: string;
  beneficios: string[];
  destaque: boolean;
};

type Props = {
  // Kept for backward compatibility with inline Modal usage in existing screens
  onClose?: () => void;
};

// ─── Plan data ────────────────────────────────────────────────────────────────

const PLANOS_EMPREGADOR: PlanoInfo[] = [
  {
    id: "BASICO",
    nome: "Básico",
    preco: "Grátis",
    beneficios: ["1 serviço por mês", "Acesso a diaristas", "Chat básico"],
    destaque: false,
  },
  {
    id: "PLUS",
    nome: "Plus",
    preco: "R$ 19/mês",
    beneficios: ["Serviços ilimitados", "Suporte prioritário", "Chat dedicado"],
    destaque: true,
  },
  {
    id: "PREMIUM",
    nome: "Premium",
    preco: "R$ 39/mês",
    beneficios: ["Tudo do Plus", "Diaristas verificadas", "Prioridade no agendamento"],
    destaque: false,
  },
];

const PLANOS_DIARISTA: PlanoInfo[] = [
  {
    id: "BASICO",
    nome: "Básico",
    preco: "Grátis",
    beneficios: ["Até 3 aceites por mês", "Perfil básico"],
    destaque: false,
  },
  {
    id: "PLUS",
    nome: "Plus",
    preco: "R$ 9/mês",
    beneficios: ["Aceites ilimitados", "Badge Plus", "Suporte prioritário"],
    destaque: true,
  },
  {
    id: "PREMIUM",
    nome: "Premium",
    preco: "R$ 19/mês",
    beneficios: ["Tudo do Plus", "Destaque na busca", "Acesso a mais clientes"],
    destaque: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const { user } = useAuth();
  const role = user?.role ?? "EMPREGADOR";

  const { restricoes, loading, refetch } = useRestricoes();

  // Loading state per plan being checked out
  const [loadingPlano, setLoadingPlano] = useState<"PLUS" | "PREMIUM" | null>(null);

  // Get mensagem from route params (gate context) — works even in modal context
  // (in modal context, params won't have mensagem, so it defaults to undefined)
  const mensagem = (route.params as { mensagem?: string } | undefined)?.mensagem;

  // Refetch on focus to reflect subscription changes after Stripe redirect
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const planos = role === "DIARISTA" ? PLANOS_DIARISTA : PLANOS_EMPREGADOR;
  const planoAtual: Plano = restricoes?.plano ?? "BASICO";

  const canGoBack = !onClose && navigation.canGoBack();

  // ── Checkout ────────────────────────────────────────────────────────────────

  const handleAssinar = useCallback(
    async (plano: "PLUS" | "PREMIUM") => {
      setLoadingPlano(plano);
      try {
        const res = await api.post<{ url: string }>("/api/billing/checkout", { plano });
        await Linking.openURL(res.data.url);
      } catch {
        Alert.alert(
          "Erro",
          "Não foi possível iniciar o checkout. Tente novamente."
        );
      } finally {
        setLoadingPlano(null);
      }
    },
    []
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: Math.max(32, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={s.header}>
          {canGoBack ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={s.backBtn}
            >
              <AppIcon name="ArrowLeft" size={22} color={colors.textPrimary} strokeWidth={2.5} />
            </Pressable>
          ) : <View style={s.backBtn} />}

          <Text style={s.title}>Escolha seu plano</Text>
        </View>

        {/* Gate message */}
        {mensagem ? (
          <View style={s.gateBox}>
            <AppIcon name="Info" size={16} color={colors.warning} strokeWidth={2.2} />
            <Text style={s.gateText}>{mensagem}</Text>
          </View>
        ) : null}

        {/* Plans */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <View style={s.planList}>
            {planos.map((plano) => (
              <PlanoCard
                key={plano.id}
                nome={plano.nome}
                preco={plano.preco}
                beneficios={plano.beneficios}
                destaque={plano.destaque}
                atual={plano.id === planoAtual}
                carregando={loadingPlano === plano.id}
                onSelecionar={() => {
                  if (plano.id === "BASICO") return;
                  void handleAssinar(plano.id);
                }}
              />
            ))}
          </View>
        )}

        {/* Footer note */}
        <Text style={s.legal}>Cancele quando quiser. Sem fidelidade.</Text>

        {/* Dismiss link for inline modal usage */}
        {onClose ? (
          <Pressable onPress={onClose} style={s.dismissBtn}>
            <Text style={s.dismissText}>Continuar sem assinar</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
  },
  gateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  gateText: {
    ...typography.body,
    color: colors.warning,
    flex: 1,
    fontWeight: "600",
  },
  loadingWrap: {
    paddingVertical: 64,
    alignItems: "center",
  },
  planList: {
    gap: spacing.md,
  },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  dismissText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
