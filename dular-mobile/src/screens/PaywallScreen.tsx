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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { api } from "@/lib/api";
import { AppIcon } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { formatMoneyFromCents } from "@/utils/formatters";

type Props = {
  /** Compatibilidade com o uso inline em Modal que já existia. */
  onClose?: () => void;
};

/** Plano vindo de GET /api/billing/plans. */
type PlanoApi = {
  id: string;
  name: string;
  role: string;
  interval: string | null;
  priceInCents: number;
  plan: "BASIC" | "PREMIUM";
};

/** Benefícios são texto de marketing e não estão no catálogo do backend.
 *  O PREÇO vem sempre da API — era cravado aqui e não batia com a cobrança. */
const BENEFICIOS: Record<string, string[]> = {
  basico_mensal: ["Aceites ilimitados", "Badge Plus", "Suporte prioritário"],
  pro_mensal: ["Tudo do Básico", "Destaque na busca", "Acesso a mais clientes"],
  pro_anual: ["Tudo do Pro", "Dois meses grátis no ano"],
};

const BENEFICIOS_PADRAO = ["Aceites ilimitados", "Suporte prioritário"];

function sufixoPeriodo(interval: string | null) {
  return interval === "year" ? "/ano" : "/mês";
}

/** Quanto o anual economiza contra 12 meses do mensal equivalente. */
function economiaAnual(anual: PlanoApi, mensais: PlanoApi[]): string | null {
  const mensal = mensais.find((m) => m.plan === anual.plan && m.interval !== "year");
  if (!mensal) return null;
  const diff = mensal.priceInCents * 12 - anual.priceInCents;
  if (diff <= 0) return null;
  return `Economize ${formatMoneyFromCents(diff)}`;
}

export default function PaywallScreen({ onClose }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const [planoAtual, setPlanoAtual] = useState<string | null>(null);

  const [planosApi, setPlanosApi] = useState<PlanoApi[] | null>(null);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);

  const mensagem = (route.params as { mensagem?: string } | undefined)?.mensagem;

  // Refaz ao focar para refletir a assinatura logo após voltar do Stripe.
  // Fonte: /api/me/subscription — `useRestricoes` tipa um campo `plano` que a
  // rota /api/me/restrictions não devolve (ela traz restrições administrativas).
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      api
        .get<{ plan?: string }>("/api/me/subscription")
        .then((res) => vivo && setPlanoAtual(res.data?.plan ?? "FREE"))
        .catch(() => vivo && setPlanoAtual("FREE"));
      return () => {
        vivo = false;
      };
    }, []),
  );

  useEffect(() => {
    let vivo = true;
    api
      .get<{ plans: PlanoApi[] }>("/api/billing/plans")
      .then((res) => vivo && setPlanosApi(res.data?.plans ?? []))
      // Sem catálogo não há preço confiável: melhor lista vazia do que um
      // valor diferente do que o Stripe vai cobrar.
      .catch(() => vivo && setPlanosApi([]));
    return () => {
      vivo = false;
    };
  }, []);

  const planos = useMemo(() => planosApi ?? [], [planosApi]);
  const carregando = planosApi === null;

  const noPlanoGratuito = (planoAtual ?? "FREE") === "FREE";
  const planoEscolhido = planos.find((p) => p.id === escolhido) ?? null;

  const fechar = useCallback(() => {
    if (onClose) return onClose();
    if (navigation.canGoBack()) navigation.goBack();
  }, [onClose, navigation]);

  const assinar = useCallback(async () => {
    if (!planoEscolhido) return;
    setAssinando(true);
    try {
      // `planId` em vez do nome legado (PLUS/PREMIUM): é o que alcança o
      // plano anual, que o mapeamento legado não resolve.
      const res = await api.post<{ url: string }>("/api/billing/checkout", {
        planId: planoEscolhido.id,
      });
      await Linking.openURL(res.data.url);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o checkout. Tente novamente.");
    } finally {
      setAssinando(false);
    }
  }, [planoEscolhido]);

  return (
    <View style={s.root}>
      {/* Fundo desfocado: a tela flutua sobre o que estava atrás. */}
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={fechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />

      <View style={[s.cartao, { marginTop: insets.top + spacing.xl, marginBottom: insets.bottom + spacing.lg }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.conteudo}
          bounces={false}
        >
          <View style={s.cabecalho}>
            <View style={s.selo}>
              <AppIcon name="Sparkles" size={13} color={colors.primary} strokeWidth={2.4} />
              <Text style={s.seloTexto}>PLANOS</Text>
            </View>
            <Pressable onPress={fechar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
              <AppIcon name="XCircle" size={22} color={colors.textSecondary} strokeWidth={2.4} />
            </Pressable>
          </View>

          <Text style={s.titulo}>Escolha seu plano</Text>
          <Text style={s.subtitulo}>Mais aceites, mais destaque, mais clientes.</Text>

          {mensagem ? (
            <View style={s.aviso}>
              <AppIcon name="Info" size={15} color={colors.warning} strokeWidth={2.3} />
              <Text style={s.avisoTexto}>{mensagem}</Text>
            </View>
          ) : null}

          {/* Plano atual */}
          {noPlanoGratuito ? (
            <View style={s.atual}>
              <View style={s.atualEsq}>
                <Text style={s.atualNome}>Básico</Text>
                <Text style={s.atualDesc}>Até 3 aceites por mês</Text>
              </View>
              <View style={s.atualTag}>
                <Text style={s.atualTagTexto}>Plano atual</Text>
              </View>
            </View>
          ) : null}

          {carregando ? (
            <View style={s.carregando}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : planos.length === 0 ? (
            <Text style={s.vazio}>Não foi possível carregar os planos agora.</Text>
          ) : (
            <View style={s.lista}>
              {planos.map((p) => {
                const sel = p.id === escolhido;
                const economia = p.interval === "year" ? economiaAnual(p, planos) : null;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setEscolhido(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sel }}
                    style={[s.opcao, sel && s.opcaoSel]}
                  >
                    <View style={[s.radio, sel && s.radioSel]}>
                      {sel ? <View style={s.radioPonto} /> : null}
                    </View>

                    <View style={s.opcaoTexto}>
                      <View style={s.opcaoLinha}>
                        <Text style={s.opcaoNome}>{p.name}</Text>
                        {economia ? (
                          <View style={s.etiqueta}>
                            <Text style={s.etiquetaTexto}>{economia}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={s.opcaoBeneficio} numberOfLines={1}>
                        {(BENEFICIOS[p.id] ?? BENEFICIOS_PADRAO).join(" · ")}
                      </Text>
                    </View>

                    <View style={s.precoCol}>
                      <Text style={s.preco}>{formatMoneyFromCents(p.priceInCents)}</Text>
                      <Text style={s.periodo}>{sufixoPeriodo(p.interval)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* CTA único: só aparece depois da escolha. */}
          {planoEscolhido ? (
            <Pressable onPress={assinar} disabled={assinando} style={s.ctaWrap}>
              <LinearGradient
                colors={[colors.primaryLight, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.cta}
              >
                {assinando ? (
                  <ActivityIndicator color={colors.textOnPrimary} />
                ) : (
                  <Text style={s.ctaTexto}>Assinar {planoEscolhido.name}</Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={s.ctaVazio}>
              <Text style={s.ctaVazioTexto}>Selecione um plano para continuar</Text>
            </View>
          )}

          <Text style={s.legal}>Cancele quando quiser. Sem fidelidade.</Text>

          <Pressable onPress={fechar} hitSlop={8}>
            <Text style={s.depois}>Agora não</Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#1B1235",
    shadowOpacity: 0.28,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  conteudo: { padding: spacing.lg, gap: spacing.md },

  cabecalho: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.lavender,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  seloTexto: { ...typography.caption, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },

  titulo: { ...typography.h2, color: colors.textPrimary, fontWeight: "800" },
  subtitulo: { ...typography.bodySm, color: colors.textSecondary, marginTop: -spacing.xs },

  aviso: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  avisoTexto: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },

  atual: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  atualEsq: { flex: 1, minWidth: 0 },
  atualNome: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "700" },
  atualDesc: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  atualTag: { backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  atualTagTexto: { ...typography.caption, color: colors.success, fontWeight: "700" },

  carregando: { paddingVertical: spacing.xl, alignItems: "center" },
  vazio: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.lg },

  lista: { gap: spacing.sm },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  opcaoSel: { borderColor: colors.primary, backgroundColor: colors.lavenderSoft },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSel: { borderColor: colors.primary },
  radioPonto: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },

  opcaoTexto: { flex: 1, minWidth: 0 },
  opcaoLinha: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  opcaoNome: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "700", flexShrink: 1 },
  opcaoBeneficio: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  etiqueta: { backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  etiquetaTexto: { ...typography.caption, color: colors.success, fontWeight: "700", fontSize: 10 },

  precoCol: { alignItems: "flex-end" },
  preco: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "800" },
  periodo: { ...typography.caption, color: colors.textSecondary },

  ctaWrap: { borderRadius: radius.lg, overflow: "hidden" },
  cta: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ctaTexto: { ...typography.bodyMedium, color: colors.textOnPrimary, fontWeight: "800" },
  ctaVazio: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaVazioTexto: { ...typography.bodySm, color: colors.textMuted, fontWeight: "600" },

  legal: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  depois: { ...typography.bodySm, color: colors.textSecondary, textAlign: "center", fontWeight: "600" },
});
