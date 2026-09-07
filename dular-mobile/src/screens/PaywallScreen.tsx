import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRestricoes } from "@/hooks/useRestricoes";
import { AppIcon } from "@/components/ui";
import PlanoCard from "@/components/ui/PlanoCard";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { formatMoneyFromCents } from "@/utils/formatters";

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

/** Plano vindo de GET /api/billing/plans. */
type PlanoApi = {
  id: string;
  name: string;
  role: string;
  interval: string | null;
  priceInCents: number;
  plan: "BASIC" | "PREMIUM";
};

/** Nível gratuito: não existe no catálogo do backend porque é a AUSÊNCIA de
 *  assinatura. Só ele fica descrito aqui. */
const PLANO_GRATUITO: PlanoInfo = {
  id: "BASICO",
  nome: "Básico",
  preco: "Grátis",
  beneficios: ["Até 3 aceites por mês", "Perfil básico"],
  destaque: false,
};

/** Benefícios são texto de marketing, não vêm da API. O PREÇO vem — era
 *  cravado aqui ("R$ 9/mês", "R$ 19/mês") e não batia com a cobrança real
 *  (R$ 19,90 e R$ 39,90): a tela prometia um valor e o Stripe cobrava outro. */
const BENEFICIOS: Record<"PLUS" | "PREMIUM", string[]> = {
  PLUS: ["Aceites ilimitados", "Badge Plus", "Suporte prioritário"],
  PREMIUM: ["Tudo do Plus", "Destaque na busca", "Acesso a mais clientes"],
};

/** O checkout ainda fala o nome legado (PLUS/PREMIUM) e o backend traduz para
 *  o id do catálogo — ver legacyPlanoToPlanId em billing/checkout. */
const LEGADO_POR_PLAN: Record<"BASIC" | "PREMIUM", "PLUS" | "PREMIUM"> = {
  BASIC: "PLUS",
  PREMIUM: "PREMIUM",
};

function precoMensal(cents: number, interval: string | null): string {
  const valor = formatMoneyFromCents(cents);
  return interval === "year" ? `${valor}/ano` : `${valor}/mês`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

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

  // Tela de planos exclusiva do profissional. Hoje só o Diarista alcança este
  // paywall (Montador não o registra; Empregador nunca paga — 00-fonte-unica-verdade.md).
  const [planosApi, setPlanosApi] = useState<PlanoApi[] | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<{ plans: PlanoApi[] }>("/api/billing/plans")
      .then((res) => {
        if (vivo) setPlanosApi(res.data?.plans ?? []);
      })
      .catch(() => {
        // Sem o catálogo não dá para mostrar preço. Melhor listar só o
        // gratuito do que arriscar exibir um valor diferente do cobrado.
        if (vivo) setPlanosApi([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const planos: PlanoInfo[] = useMemo(() => {
    if (!planosApi) return [PLANO_GRATUITO];
    const pagos = planosApi
      // mensais apenas: o checkout legado só resolve plano mensal
      .filter((p) => p.interval !== "year")
      .map((p): PlanoInfo => {
        const id = LEGADO_POR_PLAN[p.plan];
        return {
          id,
          nome: p.name,
          preco: precoMensal(p.priceInCents, p.interval),
          beneficios: BENEFICIOS[id],
          destaque: id === "PLUS",
        };
      });
    return [PLANO_GRATUITO, ...pagos];
  }, [planosApi]);
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
