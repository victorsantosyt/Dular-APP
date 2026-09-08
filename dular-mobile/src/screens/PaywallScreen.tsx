import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
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
import { AppIcon, type AppIconName } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { formatMoneyFromCents, plural } from "@/utils/formatters";

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
/** Benefícios por plano. O primeiro item é sempre o LIMITE — é o que o plano
 *  de fato faz (`FeatureLimit.SOLICITACOES_MES`) e o que o catálogo descreve
 *  em lib/stripe.ts. Os demais são o que vem junto. */
/** Benefícios por NÍVEL, não por id de plano: diarista e montador têm ids
 *  diferentes (`pro_mensal` vs `montador_pro_mensal`) para o mesmo nível, e
 *  indexar por id deixaria o montador sem texto. A chave é `plan_interval`.
 *
 *  O primeiro item é sempre o LIMITE — é o que o plano de fato faz
 *  (`FeatureLimit.SOLICITACOES_MES`) e o que o catálogo descreve. */
const BENEFICIOS: Record<string, string[]> = {
  BASIC_month: [
    "Até 10 serviços aceitos por mês",
    "Selo de assinante no seu perfil",
    "Suporte prioritário no atendimento",
  ],
  PREMIUM_month: [
    "Serviços ilimitados por mês",
    "Tudo do Básico Mensal",
    "Destaque na busca dos empregadores",
  ],
  PREMIUM_year: [
    "Serviços ilimitados o ano todo",
    "Tudo do Pro Mensal",
    "Preço travado por 12 meses",
  ],
};

const BENEFICIOS_PADRAO = ["Mais serviços por mês", "Suporte prioritário"];

/**
 * Identidade visual por NÍVEL (mesma chave `plan_interval` dos benefícios —
 * diarista e montador têm ids diferentes para o mesmo nível).
 *
 * Os quatro ícones contam uma progressão: broto → raio → coroa → gema. E
 * `forte` marca os níveis que ganham bolha em gradiente com ícone branco, em
 * vez da bolha suave — o card sobe de tom junto com o plano, em vez de os
 * três serem a mesma linha com preços diferentes.
 */
type IdentidadePlano = {
  icone: AppIconName;
  /** Bolha em gradiente (níveis Pro) em vez do fundo suave. */
  forte: boolean;
  /** Selo de recomendação; só um plano deve ter. */
  destaque?: string;
};

const IDENTIDADE: Record<string, IdentidadePlano> = {
  BASIC_month: { icone: "Zap", forte: false },
  PREMIUM_month: { icone: "Crown", forte: true, destaque: "Mais escolhido" },
  PREMIUM_year: { icone: "Gem", forte: true },
};

const IDENTIDADE_PADRAO: IdentidadePlano = { icone: "Sparkles", forte: false };

function identidadeDe(p: { plan: string; interval: string | null }): IdentidadePlano {
  return IDENTIDADE[chaveBeneficio(p)] ?? IDENTIDADE_PADRAO;
}

function chaveBeneficio(p: { plan: string; interval: string | null }): string {
  return `${p.plan}_${p.interval === "year" ? "year" : "month"}`;
}

function beneficiosDe(p: { plan: string; interval: string | null }): string[] {
  return BENEFICIOS[chaveBeneficio(p)] ?? BENEFICIOS_PADRAO;
}

/** Resumo de uma linha para a lista; a tela de detalhe mostra tudo. */
function resumo(p: { plan: string; interval: string | null }): string {
  const [primeiro] = beneficiosDe(p);
  return primeiro ?? "";
}

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

/**
 * Card de plano da lista.
 *
 * Entra com fade + subida escalonada por índice e responde ao toque com uma
 * leve compressão. Usa o `Animated` do próprio RN: o projeto não tem
 * reanimated, e a animação é simples o bastante para não precisar.
 *
 * Respeita "reduzir movimento" do sistema: com a preferência ligada o card
 * aparece direto, sem deslocamento nem escala.
 */
function PlanoCard({
  plano,
  identidade,
  economia,
  resumoTexto,
  precoTexto,
  periodoTexto,
  indice,
  tema,
  onPress,
}: {
  plano: PlanoApi;
  identidade: IdentidadePlano;
  economia: string | null;
  resumoTexto: string;
  precoTexto: string;
  periodoTexto: string;
  indice: number;
  tema: ReturnType<typeof useGenderTheme>;
  onPress: () => void;
}) {
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const entrada = useRef(new Animated.Value(0)).current;
  const escala = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => vivo && setReduzirMovimento(v));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (reduzirMovimento) {
      entrada.setValue(1);
      return;
    }
    const anim = Animated.timing(entrada, {
      toValue: 1,
      duration: 260,
      delay: indice * 70,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [entrada, indice, reduzirMovimento]);

  const comprimir = (para: number) => {
    if (reduzirMovimento) return;
    Animated.spring(escala, { toValue: para, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };

  const destacado = Boolean(identidade.destaque);

  return (
    <Animated.View
      style={{
        opacity: entrada,
        transform: [
          { scale: escala },
          { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => comprimir(0.975)}
        onPressOut={() => comprimir(1)}
        accessibilityRole="button"
        accessibilityLabel={`Ver o que o plano ${plano.name} libera`}
        style={({ pressed }) => [
          s.opcao,
          destacado && { borderColor: tema.primary, backgroundColor: tema.primarySoft + "40" },
          pressed && { borderColor: tema.primary },
        ]}
      >
        {identidade.forte ? (
          <LinearGradient
            colors={[tema.primaryLight, tema.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.opcaoIcone}
          >
            <AppIcon name={identidade.icone} size={19} color={colors.white} strokeWidth={2.2} />
          </LinearGradient>
        ) : (
          <View style={[s.opcaoIcone, { backgroundColor: tema.primarySoft }]}>
            <AppIcon name={identidade.icone} size={19} color={tema.primary} strokeWidth={2.2} />
          </View>
        )}

        {/* Nome, benefício e selos em LINHAS separadas. Tudo na mesma linha
            espremia o nome contra os selos: "Pro Anual" quebrava no meio
            ("Pro An / ual") e o benefício truncava em três palavras. */}
        <View style={s.opcaoTexto}>
          <Text style={s.opcaoNome} numberOfLines={1}>
            {plano.name}
          </Text>
          <Text style={s.opcaoBeneficio} numberOfLines={2}>
            {resumoTexto}
          </Text>
          {identidade.destaque || economia ? (
            <View style={s.opcaoSelos}>
              {identidade.destaque ? (
                <View style={[s.selinho, { backgroundColor: tema.primary }]}>
                  <Text style={s.selinhoTexto}>{identidade.destaque}</Text>
                </View>
              ) : null}
              {economia ? (
                <View style={s.etiqueta}>
                  <Text style={s.etiquetaTexto}>{economia}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Sem chevron: o card inteiro é tocável e o preço já ancora a
            direita — o ícone só roubava largura do nome. */}
        <View style={s.precoCol}>
          <Text style={s.preco}>{precoTexto}</Text>
          <Text style={s.periodo}>{periodoTexto}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function PaywallScreen({ onClose }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  // Antes usava o roxo global: no perfil verde da diarista a tela destoava.
  const tema = useGenderTheme();

  const [planoAtual, setPlanoAtual] = useState<string | null>(null);
  const [uso, setUso] = useState<{ used: number; limit: number | null } | null>(null);

  const [planosApi, setPlanosApi] = useState<PlanoApi[] | null>(null);
  // Distingue "a busca falhou" de "não existe plano para este papel": hoje o
  // catálogo só tem planos de DIARISTA, então o montador cai no segundo caso
  // e dizer "não foi possível carregar" seria mentira.
  const [falhouBusca, setFalhouBusca] = useState(false);
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
        .get<{ plan?: string; usage?: { solicitacoesMes?: { used: number; limit: number | null } } }>(
          "/api/me/subscription",
        )
        .then((res) => {
          if (!vivo) return;
          setPlanoAtual(res.data?.plan ?? "FREE");
          setUso(res.data?.usage?.solicitacoesMes ?? null);
        })
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
      .catch(() => {
        if (!vivo) return;
        setPlanosApi([]);
        setFalhouBusca(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const planos = useMemo(() => planosApi ?? [], [planosApi]);
  const carregando = planosApi === null;

  const noPlanoGratuito = (planoAtual ?? "FREE") === "FREE";
  const planoEscolhido = planos.find((p) => p.id === escolhido) ?? null;
  const economiaDoAnual =
    planoEscolhido && planoEscolhido.interval === "year"
      ? economiaAnual(planoEscolhido, planos)
      : null;

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
    <View style={[s.root, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}>
      {/* Fundo desfocado: a tela flutua sobre o que estava atrás. */}
      <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={fechar}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />

      <View style={s.cartao}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.conteudo} bounces={false}>
          {/* Sem "X": a saída fica no rodapé ("Agora não"), e no passo 2 o
              rodapé vira "Ver outros planos". Dois fechos na mesma tela
              disputavam atenção com a ação principal.

              A pílula "PLANOS" saiu: com o ícone acima do título ela virava
              um segundo rótulo dizendo a mesma coisa. */}

          {planoEscolhido ? (
            /* ── Passo 2: o que o plano libera + assinar ─────────────────── */
            <>
              {/* Repete a identidade da lista: quem tocou em "Pro Mensal"
                  reconhece a coroa e sabe que continua no mesmo plano. */}
              <View style={s.cabecalhoCentro}>
                {identidadeDe(planoEscolhido).forte ? (
                  <LinearGradient
                    colors={[tema.primaryLight, tema.primary]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.cabecalhoIcone}
                  >
                    <AppIcon
                      name={identidadeDe(planoEscolhido).icone}
                      size={24}
                      color={colors.white}
                      strokeWidth={2.1}
                    />
                  </LinearGradient>
                ) : (
                  <View style={[s.cabecalhoIcone, { backgroundColor: tema.primarySoft }]}>
                    <AppIcon
                      name={identidadeDe(planoEscolhido).icone}
                      size={24}
                      color={tema.primary}
                      strokeWidth={2.1}
                    />
                  </View>
                )}
                <Text style={s.titulo}>{planoEscolhido.name}</Text>
                <View style={s.precoLinha}>
                  <Text style={[s.precoGrande, { color: tema.primary }]}>
                    {formatMoneyFromCents(planoEscolhido.priceInCents)}
                  </Text>
                  <Text style={s.precoPeriodo}>{sufixoPeriodo(planoEscolhido.interval)}</Text>
                </View>
                {economiaDoAnual ? (
                  <View style={s.etiquetaSolta}>
                    <Text style={s.etiquetaTexto}>{economiaDoAnual}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={s.secao}>O que este plano libera</Text>
              <View style={s.beneficios}>
                {beneficiosDe(planoEscolhido).map((b) => (
                  <View key={b} style={s.beneficio}>
                    <View style={[s.beneficioIcone, { backgroundColor: tema.primarySoft }]}>
                      <AppIcon name="Check" size={13} color={tema.primary} strokeWidth={3} />
                    </View>
                    <Text style={s.beneficioTexto}>{b}</Text>
                  </View>
                ))}
              </View>

              <Pressable onPress={assinar} disabled={assinando} style={s.ctaWrap}>
                <LinearGradient
                  colors={[tema.primaryLight, tema.primary]}
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
              <Text style={s.legal}>Cancele quando quiser. Sem fidelidade.</Text>
            </>
          ) : (
            /* ── Passo 1: só as opções, sem botão de ação ─────────────────── */
            <>
              <View style={s.cabecalhoCentro}>
                <View style={[s.cabecalhoIcone, { backgroundColor: tema.primarySoft }]}>
                  <AppIcon name="Sparkles" size={24} color={tema.primary} strokeWidth={2.1} />
                </View>
                <Text style={s.titulo}>Escolha seu plano</Text>
                <Text style={s.subtitulo}>Toque em um plano para ver o que ele libera.</Text>
              </View>

              {mensagem ? (
                <View style={s.aviso}>
                  <AppIcon name="Info" size={15} color={colors.warning} strokeWidth={2.3} />
                  <Text style={s.avisoTexto}>{mensagem}</Text>
                </View>
              ) : null}

              {noPlanoGratuito ? (
                <View style={s.atual}>
                  {/* Mesma bolha dos pagos: sem ela o gratuito parecia de
                      outra família e a progressão broto → raio → coroa → gema
                      começava do nada. */}
                  <View style={[s.opcaoIcone, { backgroundColor: colors.border }]}>
                    <AppIcon name="Sprout" size={19} color={colors.textSecondary} strokeWidth={2.2} />
                  </View>
                  <View style={s.atualEsq}>
                    <Text style={s.atualNome}>Gratuito</Text>
                    {/* Limite e uso vêm de /api/me/subscription (FeatureLimit),
                        não de texto fixo: se o limite mudar no banco, a tela
                        acompanha em vez de mentir. */}
                    <Text style={s.atualDesc}>
                      {uso?.limit != null
                        ? `${uso.used} de ${plural(uso.limit, "serviço", "serviços")} usados neste mês`
                        : "Serviços limitados por mês"}
                    </Text>
                  </View>
                  <View style={s.atualTag}>
                    <Text style={s.atualTagTexto}>Plano atual</Text>
                  </View>
                </View>
              ) : null}

              {carregando ? (
                <View style={s.carregando}>
                  <ActivityIndicator color={tema.primary} />
                </View>
              ) : planos.length === 0 ? (
                <Text style={s.vazio}>
                  {falhouBusca
                    ? "Não foi possível carregar os planos agora."
                    : "Ainda não há planos disponíveis para o seu perfil."}
                </Text>
              ) : (
                <View style={s.lista}>
                  {planos.map((p, i) => (
                    <PlanoCard
                      key={p.id}
                      plano={p}
                      identidade={identidadeDe(p)}
                      economia={p.interval === "year" ? economiaAnual(p, planos) : null}
                      resumoTexto={resumo(p)}
                      precoTexto={formatMoneyFromCents(p.priceInCents)}
                      periodoTexto={sufixoPeriodo(p.interval)}
                      indice={i}
                      tema={tema}
                      onPress={() => setEscolhido(p.id)}
                    />
                  ))}
                </View>
              )}
            </>
          )}

          {planoEscolhido ? (
            <Pressable
              onPress={() => setEscolhido(null)}
              style={s.secundario}
              accessibilityRole="button"
              accessibilityLabel="Ver outros planos"
            >
              <AppIcon name="ArrowLeft" size={16} color={colors.textSecondary} strokeWidth={2.5} />
              <Text style={s.secundarioTexto}>Ver outros planos</Text>
            </Pressable>
          ) : (
            <Pressable onPress={fechar} style={s.secundario} accessibilityRole="button">
              <Text style={s.secundarioTexto}>Agora não</Text>
            </Pressable>
          )}
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
    // Teto em vez de margens: com marginTop/marginBottom brigando contra o
    // justifyContent:"center" o cartão saía descentralizado, e a altura pulava
    // entre a lista e o detalhe. Agora ele cresce com o conteúdo até 84% e
    // rola por dentro.
    maxHeight: "84%",
    shadowColor: "#1B1235",
    shadowOpacity: 0.28,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
  },
  conteudo: { padding: spacing.lg, gap: spacing.md },


  /** Bloco de cabeçalho centralizado: ícone → título → apoio. */
  cabecalhoCentro: { alignItems: "center", gap: 6 },
  cabecalhoIcone: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  /**
   * Peso 700 (era 800) e um pouco mais de corpo: no 800 o título ficava
   * pesado e "gordo" ao lado do resto da tela. Com mais tamanho e o
   * letter-spacing negativo, ele lê como título de destaque em vez de bloco
   * em negrito.
   *
   * A família continua sendo a do sistema — o app não carrega nenhuma fonte
   * própria hoje (expo-font está instalado, mas sem arquivo e sem useFonts).
   */
  titulo: {
    ...typography.h2,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  subtitulo: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },

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
    // `gap` no lugar de space-between: com o ícone à esquerda, o
    // space-between empurrava a bolha e a tag para as bordas e abria um vão.
    gap: spacing.md,
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
    minHeight: 72,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  opcaoIcone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  selinho: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  selinhoTexto: { ...typography.caption, color: colors.white, fontWeight: "800", fontSize: 10 },
  opcaoTexto: { flex: 1, minWidth: 0, gap: 3 },
  opcaoSelos: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
  opcaoNome: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "700" },
  opcaoBeneficio: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  etiqueta: { backgroundColor: colors.successSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  etiquetaTexto: { ...typography.caption, color: colors.success, fontWeight: "700", fontSize: 10 },

  precoCol: { alignItems: "flex-end" },
  preco: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: "800" },
  periodo: { ...typography.caption, color: colors.textSecondary },

  ctaWrap: { borderRadius: radius.lg, overflow: "hidden" },
  cta: { minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  ctaTexto: { ...typography.bodyMedium, color: colors.textOnPrimary, fontWeight: "800" },

  // ── passo 2: detalhe do plano ──────────────────────────────────────────
  voltar: { flexDirection: "row", alignItems: "center", gap: 6 },
  voltarTexto: { ...typography.caption, fontWeight: "700" },
  precoLinha: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 },
  precoGrande: { ...typography.h1, fontWeight: "800" },
  precoPeriodo: { ...typography.bodySm, color: colors.textSecondary },
  etiquetaSolta: {
    alignSelf: "center",
    backgroundColor: colors.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  secao: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "700", marginTop: spacing.xs },
  beneficios: { gap: spacing.sm },
  beneficio: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  beneficioIcone: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  beneficioTexto: { ...typography.bodySm, color: colors.textPrimary, flex: 1 },

  legal: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  /** Ação secundária com corpo próprio: como link de texto solto ela não
   *  parecia clicável e competia mal com o CTA. */
  secundario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 46,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  secundarioTexto: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "700" },
});
