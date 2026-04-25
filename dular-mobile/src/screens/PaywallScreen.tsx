import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";

import { api } from "@/lib/api";
import { useAuth } from "@/stores/authStore";
import { useSubscription } from "@/hooks/useSubscription";
import { DularLogo } from "@/ui/DularLogo";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

WebBrowser.maybeCompleteAuthSession();

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string;
  name: string;
  description: string;
  role: "CLIENTE" | "DIARISTA";
  mode: string;
  interval: "month" | "year";
  priceInCents: number;
  plan: string;
};

type Props = {
  onClose?: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(cents: number, interval: "month" | "year"): string {
  const brl = (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
  return interval === "year" ? `${brl}/ano` : `${brl}/mês`;
}

const BADGES: Record<string, string | undefined> = {
  pro_mensal:  "MAIS POPULAR",
  pro_anual:   "MELHOR VALOR",
};

const DIARISTA_FEATURES: Record<string, string[]> = {
  basico_mensal:  ["Até 10 serviços por mês", "Chat com clientes", "Suporte básico"],
  pro_mensal:     ["Serviços ilimitados", "Chat com clientes", "Histórico completo", "Suporte prioritário"],
  pro_anual:      ["Serviços ilimitados", "Chat com clientes", "Histórico completo", "Suporte prioritário", "2 meses grátis"],
};

const CLIENTE_FEATURES: Record<string, string[]> = {
  cliente_mensal: ["Solicitações ilimitadas", "Chat com diaristas", "Histórico completo"],
};

function planFeatures(planId: string, role: string): string[] {
  if (role === "DIARISTA") return DIARISTA_FEATURES[planId] ?? [];
  return CLIENTE_FEATURES[planId] ?? [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaywallScreen({ onClose }: Props) {
  const { user } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();
  const role = user?.role ?? "CLIENTE";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // ── Fetch plans ─────────────────────────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const res = await api.get<{ ok: boolean; plans: Plan[] }>("/api/billing/plans");
      const filtered = res.data.plans.filter((p) => p.role === role);
      setPlans(filtered);
      // Pré-seleciona o plano do meio ou o único disponível
      const defaultPlan = filtered.find((p) => BADGES[p.id]) ?? filtered[0];
      if (defaultPlan) setSelectedId(defaultPlan.id);
    } catch {
      Alert.alert("Erro", "Não foi possível carregar os planos. Tente novamente.");
    } finally {
      setLoadingPlans(false);
    }
  }, [role]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // ── Checkout ─────────────────────────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (!selectedId || checkingOut) return;
    setCheckingOut(true);
    try {
      const res = await api.post<{ ok: boolean; checkoutUrl: string }>(
        "/api/billing/checkout",
        { planId: selectedId }
      );
      const { checkoutUrl } = res.data;
      if (!checkoutUrl) throw new Error("URL de checkout inválida.");

      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, "dular://");

      if (result.type === "success") {
        // Pagamento provavelmente concluído — atualiza subscription e fecha
        await refreshSubscription();
        onClose?.();
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error?.message ?? e?.message ?? "Falha ao iniciar checkout.");
    } finally {
      setCheckingOut(false);
    }
  }, [selectedId, checkingOut, refreshSubscription, onClose]);

  // ── Render ───────────────────────────────────────────────────────────────────
  const subtitle =
    role === "DIARISTA"
      ? "Escolha o plano e apareça para mais clientes"
      : "Acesse todos os recursos sem limites";

  return (
    <LinearGradient
      colors={[colors.greenLight, colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.root}
    >
      <SafeAreaView style={s.safe}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={s.header}>
            <DularLogo size="md" />
            <Text style={s.title}>Desbloqueie mais recursos</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>

          {/* ── Plans ───────────────────────────────────────────────────── */}
          {loadingPlans ? (
            <View style={s.loadingWrap}>
              <ActivityIndicator color={colors.green} size="large" />
            </View>
          ) : (
            <View style={s.planList}>
              {plans.map((plan) => {
                const selected = plan.id === selectedId;
                const badge = BADGES[plan.id];
                const features = planFeatures(plan.id, role);

                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedId(plan.id)}
                    style={({ pressed }) => [
                      s.planCard,
                      selected && s.planCardSelected,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    {/* Badge */}
                    {badge && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{badge}</Text>
                      </View>
                    )}

                    {/* Header row */}
                    <View style={s.planRow}>
                      <View style={s.planInfo}>
                        <Text style={[s.planName, selected && s.planNameSelected]}>
                          {plan.name}
                        </Text>
                        <Text style={s.planPrice}>
                          {formatPrice(plan.priceInCents, plan.interval)}
                        </Text>
                      </View>
                      <View style={[s.radio, selected && s.radioSelected]}>
                        {selected && <View style={s.radioDot} />}
                      </View>
                    </View>

                    {/* Features */}
                    <View style={s.featureList}>
                      {features.map((feat) => (
                        <View key={feat} style={s.featureRow}>
                          <Ionicons
                            name="checkmark-circle"
                            size={15}
                            color={selected ? colors.green : colors.sub}
                            style={{ marginTop: 1 }}
                          />
                          <Text style={[s.featureText, selected && s.featureTextSelected]}>
                            {feat}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── CTA ─────────────────────────────────────────────────────── */}
          <View style={s.ctaWrap}>
            <Pressable
              onPress={handleCheckout}
              disabled={!selectedId || checkingOut || loadingPlans}
              style={({ pressed }) => [
                s.ctaBtn,
                (!selectedId || loadingPlans) && s.ctaBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              {checkingOut ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={s.ctaBtnText}>Assinar agora</Text>
              )}
            </Pressable>

            {onClose && (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [s.dismissBtn, pressed && { opacity: 0.6 }]}
              >
                <Text style={s.dismissText}>Continuar sem assinar</Text>
              </Pressable>
            )}

            <Text style={s.legal}>
              Cancele a qualquer momento. Cobrança automática via Stripe.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:  { flex: 1 },
  safe:  { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
    gap: spacing.xl,
  },

  // Header
  header: {
    alignItems: "center",
    paddingTop: spacing.xl,
    gap: 8,
  },
  title: {
    ...typography.h1,
    textAlign: "center",
    marginTop: 14,
  },
  subtitle: {
    ...typography.sub,
    textAlign: "center",
    fontSize: 14,
  },

  // Plans
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  planList: { gap: 12 },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.stroke,
    padding: 16,
    gap: 12,
    ...shadow.card,
  },
  planCardSelected: {
    borderColor: colors.green,
    backgroundColor: "#FAFFFE",
  },

  // Badge
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.green,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFF",
    letterSpacing: 0.6,
  },

  // Plan header row
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planInfo: { gap: 2 },
  planName: {
    ...typography.h2,
    color: colors.sub,
  },
  planNameSelected: { color: colors.ink },
  planPrice: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.green,
    letterSpacing: -0.4,
  },

  // Radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.green },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
  },

  // Features
  featureList: { gap: 6 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  featureText: {
    ...typography.body,
    color: colors.sub,
    flex: 1,
  },
  featureTextSelected: { color: colors.ink },

  // CTA
  ctaWrap: {
    gap: 12,
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  ctaBtn: {
    width: "100%",
    height: 54,
    borderRadius: radius.btn,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.float,
  },
  ctaBtnDisabled: { opacity: 0.45 },
  ctaBtnText: {
    ...typography.btn,
    fontSize: 16,
    fontWeight: "800",
  },
  dismissBtn: { paddingVertical: 6 },
  dismissText: {
    ...typography.sub,
    fontSize: 13,
    fontWeight: "600",
  },
  legal: {
    ...typography.sub,
    fontSize: 11,
    textAlign: "center",
    color: colors.sub,
    opacity: 0.7,
  },
});
