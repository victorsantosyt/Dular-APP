import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Platform,
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
import { useNavigation, useRoute } from "@react-navigation/native";

import { api } from "@/lib/api";
import { useAssinaturaPlano, planoAtualDoCatalogo } from "@/hooks/useAssinaturaPlano";
import { alternativasDoPlano, exibicaoDosPlanos, gerenciaAssinaturaNaGoogle, podeFazerUpgradeGoogle, estadoDoPlano, bloqueiaNovaCompra } from "@/components/ui/assinaturaPlano";
import { MotivoPaywall, type PaywallParams } from "@/lib/paywall";
import {
  abrirCheckout,
  comprarPlano,
  lojaDisponivel,
  restaurarCompras,
  type CaminhoDePagamento,
} from "@/lib/compraDePlano";
import { ErroCompraLoja, consultarDisponibilidadeGoogle } from "@/lib/lojaGoogle";
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
  /** Id do produto nas lojas. Sem ele a compra in-app não sabe o que comprar. */
  storeProductId?: string | null;
  /** Google: plano base do produto. */
  storeBasePlanId?: string | null;
};

/**
 * Benefícios por NÍVEL, não por id de plano: diarista e montador têm ids
 * diferentes (`pro_mensal` vs `montador_pro_mensal`) para o mesmo nível, e
 * indexar por id deixaria o montador sem texto. A chave é `plan_interval` —
 * por isso estes três blocos cobrem os seis planos.
 *
 * A lista anuncia SOMENTE o limite de aceites por mês, que é a única coisa
 * que o plano de fato faz: `FeatureLimit.SOLICITACOES_MES`, aplicado em
 * `POST /api/servicos/[id]/aceitar`.
 *
 * Saíram daqui três promessas que não existiam em lugar nenhum do código —
 * selo de assinante, suporte prioritário e destaque na busca. A ordenação da
 * busca não olha assinatura, o `VerifiedBadge` nunca recebe o nível de
 * assinante e `SUPORTE_PRIORITARIO` não tem uma linha que o aplique. Anunciar
 * o que não se entrega custa mais caro do que anunciar pouco.
 *
 * Pro Mensal e Pro Anual liberam EXATAMENTE o mesmo (ambos PREMIUM, limite
 * nulo). O que muda é a duração e o preço, e a copy do anual diz isso — a
 * diferença é desconto por pagar 12 meses de uma vez, não benefício a mais.
 */
const BENEFICIOS: Record<string, string[]> = {
  BASIC_month: [
    "Aceite até 10 solicitações por mês",
    "Tudo do plano gratuito",
  ],
  PREMIUM_month: [
    "Aceite solicitações ilimitadas",
    "Sem limite de aceites por mês",
  ],
  PREMIUM_year: [
    "Aceite solicitações ilimitadas",
    "Mesmo benefício do Pro Mensal, com preço travado por 12 meses",
  ],
};

/**
 * Reserva, para um nível que o catálogo devolva e não esteja no mapa acima.
 *
 * Também prometia "Suporte prioritário", que é uma das promessas cortadas —
 * mantê-la aqui deixaria a promessa viva pelo caminho do fallback. Ficou só o
 * que é verdade em qualquer plano pago: mais aceites por mês.
 */
const BENEFICIOS_PADRAO = ["Mais aceites por mês"];

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
  // Sem a barra: "R$ 39,90 /mês" deixava um traço solto colado no preço.
  return interval === "year" ? "por ano" : "por mês";
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
  selecionado,
  atual,
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
  /**
   * Este é o card em foco agora. Exatamente um card por vez: começa no plano
   * recomendado e passa para o que a pessoa abrir — nunca os dois juntos.
   */
  selecionado: boolean;
  atual: boolean;
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

  // Foco do card escolhido: sobe um pouco e ganha sombra desfocada na cor do
  // tema. A escala fica baixa (1.02) de propósito — o suficiente para o card
  // "saltar", pouco o bastante para não invadir os vizinhos quando o usuário
  // volta da tela de detalhe e encontra o card ainda em destaque.
  //
  // DOIS valores para o mesmo foco porque os drivers não se misturam: sombra
  // e elevação só existem no driver JS, escala roda no nativo, e combinar os
  // dois no mesmo nó derruba a tela ("animated node that has been moved to
  // native earlier"). Um valor por camada, animados juntos.
  const focoSombra = useRef(new Animated.Value(selecionado ? 1 : 0)).current;
  const focoEscala = useRef(new Animated.Value(selecionado ? 1 : 0)).current;
  useEffect(() => {
    const alvo = selecionado ? 1 : 0;
    if (reduzirMovimento) {
      focoSombra.setValue(alvo);
      focoEscala.setValue(alvo);
      return;
    }
    const anim = Animated.parallel([
      Animated.spring(focoSombra, { toValue: alvo, useNativeDriver: false, speed: 14, bounciness: 6 }),
      Animated.spring(focoEscala, { toValue: alvo, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [focoSombra, focoEscala, selecionado, reduzirMovimento]);

  return (
    /* Camada externa: só sombra/elevação (driver JS). */
    <Animated.View
      style={{
        borderRadius: radius.lg,
        shadowColor: tema.primary,
        shadowOpacity: focoSombra.interpolate({ inputRange: [0, 1], outputRange: [0, 0.38] }),
        shadowRadius: focoSombra.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }),
        shadowOffset: { width: 0, height: 8 },
        elevation: focoSombra.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
      }}
    >
    {/* Camada interna: opacidade e transform (driver nativo). */}
    <Animated.View
      style={{
        opacity: entrada,
        transform: [
          {
            scale: Animated.multiply(
              escala,
              focoEscala.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }),
            ),
          },
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
        // Realce SÓ no plano escolhido. O "Mais escolhido" continua sendo
        // informação (o selo), não destaque visual do card: com borda e fundo
        // próprios ele parecia já selecionado antes de qualquer toque, e
        // disputava com o card que a pessoa de fato abriu.
        style={({ pressed }) => [
          s.opcao,
          selecionado && { borderColor: tema.primary, borderWidth: 2 },
          pressed && { borderColor: tema.primary },
        ]}
      >
        {/* Bolha com gradiente e halo próprio em TODOS os níveis: o disco
            chapado com ícone de traço fino era o que deixava os cards sem
            vida. Os níveis Pro usam o gradiente cheio com ícone branco; o
            Básico e o gratuito usam o mesmo desenho em versão suave, então a
            família se mantém e a escada continua legível. */}
        <View
          style={[
            s.opcaoIconeHalo,
            { shadowColor: tema.primary, shadowOpacity: identidade.forte ? 0.45 : 0.18 },
          ]}
        >
          <LinearGradient
            colors={
              identidade.forte
                ? [tema.primaryLight, tema.primary]
                : [tema.primarySoft, tema.primarySoft]
            }
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={s.opcaoIcone}
          >
            <AppIcon
              name={identidade.icone}
              size={21}
              color={identidade.forte ? colors.white : tema.primary}
              strokeWidth={2.4}
            />
          </LinearGradient>
        </View>

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
          {atual || identidade.destaque || economia ? (
            <View style={s.opcaoSelos}>
              {atual ? (
                <View style={[s.selinho, { backgroundColor: tema.primary }]}><Text style={s.selinhoTexto}>Plano atual</Text></View>
              ) : identidade.destaque ? (
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
    </Animated.View>
  );
}

/**
 * Botão de assinar com o mesmo foco dos cards: sombra desfocada na cor do
 * tema e leve compressão ao toque, para a ação principal ter o mesmo peso
 * visual da escolha que a levou até ela.
 */
function BotaoAssinar({
  tema,
  rotulo,
  carregando,
  disabled,
  onPress,
}: {
  tema: ReturnType<typeof useGenderTheme>;
  rotulo: string;
  carregando: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [reduzirMovimento, setReduzirMovimento] = useState(false);
  const escala = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => vivo && setReduzirMovimento(v));
    return () => {
      vivo = false;
    };
  }, []);

  const comprimir = (para: number) => {
    if (reduzirMovimento) return;
    Animated.spring(escala, { toValue: para, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  };

  return (
    /* Mesmo destaque do card escolhido: anel na cor do tema + halo desfocado.
       Como o botão é preenchido com o gradiente, o anel fica AFASTADO por um
       padding — encostado nele, uma borda da mesma cor seria invisível. */
    <Animated.View
      style={{
        transform: [{ scale: escala }],
        shadowColor: tema.primary,
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
        borderRadius: radius.lg + 5,
        borderWidth: 2,
        borderColor: tema.primary + "55",
        padding: 3,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={carregando || disabled}
        onPressIn={() => comprimir(0.97)}
        onPressOut={() => comprimir(1)}
        style={s.ctaWrap}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
      >
        <LinearGradient
          colors={[tema.primaryLight, tema.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cta}
        >
          {carregando ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={s.ctaTexto}>{rotulo}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const MSG_RENOVACAO_PENDENTE =
  "A Google Play ainda não confirmou a renovação da sua assinatura. Não assine novamente; atualize o status em instantes.";

const MSG_PENDENTE =
  "A Google Play ainda está confirmando o pagamento. Assim que ele for aprovado, o plano é liberado automaticamente.";

/** Mensagem para quem tentou comprar ou restaurar pela loja. */
function mensagemDeErroDaCompra(e: unknown): string {
  if (e instanceof ErroCompraLoja) {
    if (e.codigo === "IAP_INDISPONIVEL") return "A compra pela loja ainda não está disponível nesta versão do app.";
    if (e.codigo === "UPGRADE_INDISPONIVEL") return "Não foi possível preparar a troca. Atualize seu plano e tente novamente.";
    if (e.codigo === "PRODUTO_INDISPONIVEL") return "Este plano ainda não está disponível na Google Play.";
  }
  const codigo = (e as { response?: { data?: { error?: { code?: string } } } } | null)?.response?.data?.error?.code;
  if (codigo === "COMPRA_DE_OUTRA_CONTA") return "Esta assinatura da Google Play já está vinculada a outra conta.";
  if (codigo === "COMPRA_SEM_TITULARIDADE") return "Esta assinatura da Google Play não pertence a esta conta.";
  return "Não foi possível confirmar a assinatura agora.";
}

export default function PaywallScreen({ onClose }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  // Antes usava o roxo global: no perfil verde da diarista a tela destoava.
  const tema = useGenderTheme();

  const assinatura = useAssinaturaPlano();
  const uso = assinatura.data?.usage?.solicitacoesMes ?? null;
  const [retornoCompra, setRetornoCompra] = useState<{ tipo: "sucesso" | "pendente" | "erro"; texto: string } | null>(null);
  const operacaoRef = useRef(false);
  const planoEmConfirmacao = useRef<string | null>(null);
  const [requerVerificacao, setRequerVerificacao] = useState(false);

  const [planosApi, setPlanosApi] = useState<PlanoApi[] | null>(null);
  const [pagamento, setPagamento] = useState<CaminhoDePagamento | null>(null);
  // Distingue "a busca falhou" de "não existe plano para este papel": hoje o
  // catálogo só tem planos de DIARISTA, então o montador cai no segundo caso
  // e dizer "não foi possível carregar" seria mentira.
  const [falhouBusca, setFalhouBusca] = useState(false);
  const [upgrade, setUpgrade] = useState(false);
  const [disponiveisGoogle, setDisponiveisGoogle] = useState<string[] | null>(null);
  const [falhouDisponibilidade, setFalhouDisponibilidade] = useState(false);
  const [tentativaDisponibilidade, setTentativaDisponibilidade] = useState(0);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  // `escolhido` volta a null ao tocar em "Ver outros planos" — este guarda o
  // último plano aberto para o card continuar em destaque na lista.
  const [ultimoEscolhido, setUltimoEscolhido] = useState<string | null>(null);
  const [assinando, setAssinando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);

  // Por que esta tela abriu. Sem motivo declarado, trata como abertura manual:
  // é o caso de quem chegou por "Meu plano" ou pela barra de limite, e é o
  // padrão seguro — nenhuma regra de exibição depende disto.
  const params = route.params as PaywallParams | undefined;
  const motivo = params?.motivo ?? MotivoPaywall.USER_REQUESTED;
  // O aviso é do limite esgotado, e só dele. Amarrado ao motivo, e não à mera
  // presença de um texto, para que um `mensagem` vindo de outro caminho não
  // herde a moldura de alerta sem querer.
  const mensagem = motivo === MotivoPaywall.FREE_LIMIT_REACHED ? params?.mensagem : undefined;

  useEffect(() => {
    let vivo = true;
    api
      .get<{ plans: PlanoApi[]; pagamento?: CaminhoDePagamento }>("/api/billing/plans")
      .then((res) => {
        if (!vivo) return;
        setPlanosApi(res.data?.plans ?? []);
        setPagamento(res.data?.pagamento ?? null);
      })
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

  const noPlanoGratuito = assinatura.data?.plan === "FREE";
  const planoEscolhido = planos.find((p) => p.id === escolhido) ?? null;
  const escolhidoAtual = Boolean(planoEscolhido && planoAtualDoCatalogo(assinatura.data, planoEscolhido.id));
  const temPlanoPago = Boolean(assinatura.data && assinatura.data.plan !== "FREE");
  const exibicao = exibicaoDosPlanos(assinatura.data, upgrade);
  const mostrarResumo = exibicao === "resumo";
  const alternativas = useMemo(() => alternativasDoPlano(assinatura.data, planos), [assinatura.data, planos]);
  const consultaLoja = upgrade && Platform.OS === "android" && lojaDisponivel(pagamento);
  const alternativasVisiveis = consultaLoja
    ? alternativas.filter((p) => disponiveisGoogle?.includes(p.id))
    : alternativas;

  useEffect(() => {
    if (!consultaLoja || carregando || falhouBusca) return;
    let vivo = true;
    setDisponiveisGoogle(null);
    setFalhouDisponibilidade(false);
    consultarDisponibilidadeGoogle(alternativas).then((ids) => {
      if (vivo) setDisponiveisGoogle(ids);
    }).catch(() => {
      if (vivo) setFalhouDisponibilidade(true);
    });
    return () => { vivo = false; };
  }, [consultaLoja, carregando, falhouBusca, alternativas, tentativaDisponibilidade]);
  const planoAtual = planos.find((p) => planoAtualDoCatalogo(assinatura.data, p.id)) ?? null;
  const subAtual = assinatura.data?.subscription;
  const beneficiosAtuais = assinatura.data
    ? beneficiosDe({ plan: assinatura.data.plan, interval: subAtual?.interval ?? null })
    : [];
  const trocaPelaGoogle = gerenciaAssinaturaNaGoogle(assinatura.data);
  const gerenciarGoogle = () => {
    const produto = subAtual?.storeProductId;
    const url = produto
      ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(produto)}&package=br.com.dular.app`
      : "https://play.google.com/store/account/subscriptions";
    void Linking.openURL(url).catch(() => setRetornoCompra({ tipo: "erro", texto: "Não foi possível abrir a Google Play. Abra a Play Store e acesse Pagamentos e assinaturas." }));
  };
  const operando = assinando || restaurando;
  const upgradeGoogle = Boolean(planoEscolhido && lojaDisponivel(pagamento) && podeFazerUpgradeGoogle(assinatura.data, planoEscolhido));
  const bloqueioPlano = Boolean(planoEscolhido && bloqueiaNovaCompra(assinatura.data, planoEscolhido.id, lojaDisponivel(pagamento)) && !upgradeGoogle);
  const renovacaoPendente = assinatura.data?.verificacaoLoja === "pendente";
  const compraBloqueada = assinatura.carregando || !pagamento || !assinatura.data || bloqueioPlano || requerVerificacao || retornoCompra?.tipo === "pendente" || renovacaoPendente;
  const economiaDoAnual =
    planoEscolhido && planoEscolhido.interval === "year"
      ? economiaAnual(planoEscolhido, planos)
      : null;

  useEffect(() => {
    if (retornoCompra?.tipo === "pendente" && planoEmConfirmacao.current && planoAtualDoCatalogo(assinatura.data, planoEmConfirmacao.current) && !assinatura.carregando && assinatura.apresentacao) {
      setRetornoCompra({ tipo: "sucesso", texto: `Seu plano ${assinatura.apresentacao.nome} está ativo.` });
      setEscolhido(null);
      setUpgrade(false);
      setRequerVerificacao(false);
    }
  }, [retornoCompra?.tipo, assinatura.data, assinatura.carregando, assinatura.apresentacao?.nome]);

  const fechar = useCallback(() => {
    if (onClose) return onClose();
    if (navigation.canGoBack()) navigation.goBack();
  }, [onClose, navigation]);

  const assinar = useCallback(async () => {
    if (!planoEscolhido || compraBloqueada || operacaoRef.current) return;
    operacaoRef.current = true;
    planoEmConfirmacao.current = planoEscolhido.id;
    setAssinando(true);
    setRequerVerificacao(true);
    setRetornoCompra(null);
    try {
      const r = await comprarPlano(planoEscolhido, pagamento);
      if (r.via === "stripe") {
        await abrirCheckout(r.url);
        setRetornoCompra({ tipo: "pendente", texto: "Conclua o pagamento no checkout. Ao voltar, vamos consultar seu plano." });
      } else if ("pendente" in r) {
        setRetornoCompra({ tipo: "pendente", texto: MSG_PENDENTE });
        await assinatura.atualizar();
      } else {
        const atual = await assinatura.atualizar();
        if (planoAtualDoCatalogo(atual, planoEscolhido.id)) {
          setRequerVerificacao(false);
          setRetornoCompra({ tipo: "sucesso", texto: `Assinatura confirmada. Seu plano ${atual?.subscription?.name ?? planoEscolhido.name} está ativo.` });
          setEscolhido(null);
          setUpgrade(false);
        } else {
          setRetornoCompra({ tipo: "pendente", texto: "A compra foi recebida, mas ainda não conseguimos confirmar seu plano. Atualize o status ou restaure a compra. Não assine novamente." });
        }
      }
    } catch (e) {
      if (e instanceof ErroCompraLoja && e.codigo === "COMPRA_CANCELADA") {
        setRequerVerificacao(false);
        planoEmConfirmacao.current = null;
      } else if (e instanceof ErroCompraLoja && (e.codigo === "COMPRA_EM_CONFIRMACAO" || e.codigo === "COMPRA_JA_EXISTENTE")) {
        setRetornoCompra({ tipo: "pendente", texto: "A Google Play pode já ter concluído esta compra. Atualize o status ou use Restaurar compras para vinculá-la. Não assine novamente." });
        await assinatura.atualizar();
      } else {
        if (pagamento && !lojaDisponivel(pagamento)) setRequerVerificacao(false);
        if (e instanceof ErroCompraLoja && (e.codigo === "IAP_INDISPONIVEL" || e.codigo === "PRODUTO_INDISPONIVEL" || e.codigo === "SEM_TOKEN_DA_CONTA")) setRequerVerificacao(false);
        setRetornoCompra({ tipo: "erro", texto: mensagemDeErroDaCompra(e) + " Se a Google Play já confirmou a compra, use Restaurar compras." });
      }
    } finally {
      operacaoRef.current = false;
      setAssinando(false);
    }
  }, [planoEscolhido, pagamento, compraBloqueada, assinatura.atualizar]);

  const restaurar = useCallback(async () => {
    if (operacaoRef.current) return;
    operacaoRef.current = true;
    setRestaurando(true);
    setRetornoCompra(null);
    try {
      const r = await restaurarCompras(pagamento);
      const atual = await assinatura.atualizar();
      setRequerVerificacao(r.pendentes > 0 || r.falhas > 0 || (r.restauradas > 0 && (!atual || atual.plan === "FREE")));
      if (r.restauradas > 0 && atual && atual.plan !== "FREE") {
        planoEmConfirmacao.current = null;
        setRetornoCompra({ tipo: "sucesso", texto: `Assinatura restaurada. Seu plano ${atual.subscription?.name ?? assinatura.apresentacao?.nome ?? "pago"} está ativo.` });
        setEscolhido(null);
        setUpgrade(false);
      } else if (r.pendentes > 0) {
        setRetornoCompra({ tipo: "pendente", texto: MSG_PENDENTE });
      } else if (r.falhas > 0 || (r.restauradas > 0 && !atual)) {
        setRetornoCompra({ tipo: "erro", texto: "Não foi possível confirmar seu plano agora. Tente restaurar novamente. Não assine novamente." });
      } else {
        setRetornoCompra({ tipo: "erro", texto: r.recusadas > 0
          ? "Encontramos uma assinatura na Google Play, mas ela pertence a outra conta ou já terminou."
          : r.restauradas > 0
            ? "A compra foi recebida, mas o plano ainda não está ativo. Atualize o status."
            : "Nenhuma assinatura ativa foi encontrada na Google Play para esta conta." });
      }
    } catch (e) {
      setRetornoCompra({ tipo: "erro", texto: mensagemDeErroDaCompra(e) });
    } finally {
      operacaoRef.current = false;
      setRestaurando(false);
    }
  }, [pagamento, assinatura.atualizar, assinatura.apresentacao?.nome]);

  const atualizarStatus = async () => {
    const atual = await assinatura.atualizar();
    if (atual && atual.plan !== "FREE" && (!planoEmConfirmacao.current || planoAtualDoCatalogo(atual, planoEmConfirmacao.current))) {
      setRequerVerificacao(false);
      setRetornoCompra({ tipo: "sucesso", texto: `Seu plano ${atual.subscription?.name ?? "pago"} está ativo.` });
      setEscolhido(null);
      setUpgrade(false);
    }
  };

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
          {/* Sem "X": a saída é o último item ("Agora não"), e no passo 2 ela
              vira "Ver outros planos". Dois fechos na mesma tela
              disputavam atenção com a ação principal.

              A pílula "PLANOS" saiu: com o ícone acima do título ela virava
              um segundo rótulo dizendo a mesma coisa. */}

          {operando ? <Text style={s.subtitulo} accessibilityLiveRegion="polite">{assinando ? "Processando sua assinatura…" : "Restaurando sua assinatura…"}</Text> : null}
          {retornoCompra ? (
            <View style={[s.aviso, { backgroundColor: retornoCompra.tipo === "sucesso" ? colors.successSoft : retornoCompra.tipo === "erro" ? colors.dangerSoft : colors.warningSoft }]} accessibilityLiveRegion="polite">
              <AppIcon name={retornoCompra.tipo === "sucesso" ? "CheckCircle" : retornoCompra.tipo === "erro" ? "AlertCircle" : "Clock"} size={20} color={tema.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.atualNome}>{retornoCompra.tipo === "sucesso" ? "Assinatura confirmada" : retornoCompra.tipo === "erro" ? "Não foi possível confirmar" : "Aguardando confirmação"}</Text>
                <Text style={s.atualDesc}>{retornoCompra.texto}</Text>
              </View>
            </View>
          ) : renovacaoPendente ? (
            <View style={[s.aviso, { backgroundColor: colors.warningSoft }]} accessibilityLiveRegion="polite">
              <AppIcon name="Clock" size={20} color={tema.primary} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.atualNome}>Aguardando confirmação</Text>
                <Text style={s.atualDesc}>{MSG_RENOVACAO_PENDENTE}</Text>
              </View>
            </View>
          ) : null}
          {assinatura.erro ? <Text style={s.vazio}>Não foi possível consultar seu plano. Atualize o status antes de assinar.</Text> : null}
          {assinatura.carregando ? <View style={s.carregando}><ActivityIndicator color={tema.primary} /><Text style={s.atualDesc}>Consultando seu plano…</Text></View> : null}
          {mostrarResumo && assinatura.apresentacao ? (
            <>
              <View style={s.cabecalhoCentro}>
                <LinearGradient colors={[tema.primaryLight, tema.primary]} style={s.cabecalhoIcone}>
                  <AppIcon name={assinatura.apresentacao.icone} size={28} color={colors.white} />
                </LinearGradient>
                <Text style={s.subtitulo}>Meu plano</Text>
                <Text style={s.titulo}>{assinatura.apresentacao.nome}</Text>
                <View style={s.atualTag}><Text style={s.atualTagTexto}>Plano atual</Text></View>
                <Text style={s.subtitulo}>{assinatura.data ? estadoDoPlano(assinatura.data) : ""}</Text>
                {subAtual?.expiresAt && Number.isFinite(Date.parse(subAtual.expiresAt)) ? (
                  <Text style={s.atualDesc}>Acesso até {new Date(subAtual.expiresAt).toLocaleDateString("pt-BR")}</Text>
                ) : null}
                {planoAtual ? <Text style={s.subtitulo}>{formatMoneyFromCents(planoAtual.priceInCents)} {sufixoPeriodo(planoAtual.interval)}</Text> : null}
              </View>
              <Text style={s.secao}>Benefícios do seu plano</Text>
              <View style={s.beneficios}>{beneficiosAtuais.map((beneficio) => (
                <View key={beneficio} style={s.beneficio}>
                  <View style={[s.beneficioIcone, { backgroundColor: tema.primarySoft }]}><AppIcon name="Check" size={13} color={tema.primary} /></View>
                  <Text style={s.beneficioTexto}>{beneficio}</Text>
                </View>
              ))}</View>
              <BotaoAssinar tema={tema} rotulo="Upgrade" carregando={false} disabled={operando} onPress={() => { setEscolhido(null); setDisponiveisGoogle(null); setFalhouDisponibilidade(false); setUpgrade(true); }} />
              {trocaPelaGoogle ? <Pressable onPress={gerenciarGoogle} style={s.secundario} accessibilityRole="button"><Text style={s.secundarioTexto}>Gerenciar assinatura na Google Play</Text></Pressable> : null}
            </>
          ) : null}

          {!mostrarResumo && exibicao !== "consulta" ? planoEscolhido ? (
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

              {bloqueioPlano && temPlanoPago ? (
                <View style={s.aviso}><Text style={s.avisoTexto}>Esta mudança não está disponível pelo aplicativo. Seu plano atual continua válido; consulte o gerenciamento da assinatura.</Text></View>
              ) : <BotaoAssinar
                tema={tema}
                rotulo={escolhidoAtual ? "Plano atual" : bloqueioPlano && temPlanoPago ? "Você já possui um plano ativo" : requerVerificacao ? "Verifique sua assinatura abaixo" : upgradeGoogle ? `Fazer upgrade para ${planoEscolhido.name}` : `Assinar ${planoEscolhido.name}`}
                carregando={operando}
                disabled={compraBloqueada}
                onPress={assinar}
              />}
              {trocaPelaGoogle ? <Pressable onPress={gerenciarGoogle} style={s.secundario} accessibilityRole="button"><Text style={s.secundarioTexto}>Gerenciar assinatura na Google Play</Text></Pressable> : null}
              <Text style={s.legal}>{upgradeGoogle ? "A Google Play substituirá sua assinatura atual e apresentará as condições antes da confirmação." : "Cancele quando quiser. Sem fidelidade."}</Text>
            </>
          ) : (
            /* ── Passo 1: só as opções, sem botão de ação ─────────────────── */
            <>
              <View style={s.cabecalhoCentro}>
                <View style={[s.cabecalhoIcone, { backgroundColor: tema.primarySoft }]}>
                  <AppIcon name="Sparkles" size={24} color={tema.primary} strokeWidth={2.1} />
                </View>
                <Text style={s.titulo}>{temPlanoPago ? "Upgrade" : "Escolha seu plano"}</Text>
                <Text style={s.subtitulo}>{temPlanoPago ? "Compare as outras opções. Seu plano atual continua ativo." : "Toque em um plano para ver o que ele libera."}</Text>
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
                  <View style={s.opcaoIconeHalo}>
                    <View style={[s.opcaoIcone, { backgroundColor: colors.border }]}>
                      <AppIcon name="Sprout" size={21} color={colors.textSecondary} strokeWidth={2.4} />
                    </View>
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


              {carregando || (consultaLoja && !falhouBusca && !falhouDisponibilidade && disponiveisGoogle === null) ? (
                <View style={s.carregando}>
                  <ActivityIndicator color={tema.primary} />
                </View>
              ) : consultaLoja && falhouDisponibilidade ? (
                <>
                  <Text style={s.vazio}>Não foi possível consultar os planos na Google Play.</Text>
                  <Pressable onPress={() => setTentativaDisponibilidade((v) => v + 1)} style={s.secundario} accessibilityRole="button"><Text style={s.secundarioTexto}>Tentar novamente</Text></Pressable>
                </>
              ) : alternativasVisiveis.length === 0 ? (
                <Text style={s.vazio}>
                  {falhouBusca
                    ? "Não foi possível carregar os planos agora."
                    : temPlanoPago ? "Não há outros planos disponíveis para o seu perfil." : "Ainda não há planos disponíveis para o seu perfil."}
                </Text>
              ) : (
                <View style={s.lista}>
                  {alternativasVisiveis.map((p, i) => (
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
                      // Sem escolha ainda, o foco fica no recomendado; a
                      // partir da primeira escolha ele passa para ela.
                      atual={planoAtualDoCatalogo(assinatura.data, p.id)}
                      selecionado={
                        ultimoEscolhido
                          ? ultimoEscolhido === p.id
                          : Boolean(identidadeDe(p).destaque)
                      }
                      onPress={() => {
                        setUltimoEscolhido(p.id);
                        setEscolhido(p.id);
                      }}
                    />
                  ))}
                </View>
              )}
            </>
          ) : null}

          {/* A saída é o último item da lista, não um rodapé fixo. Fixa, ela
              ficava num bloco separado e a rolagem cortava o último plano numa
              linha seca logo acima — medido no v27: o card "Pro Anual" perdia a
              borda de baixo e encostava no rodapé. Com o cartão em 92% a lista
              inteira cabe no caso comum; quando não cabe (aviso de limite), a
              saída chega rolando, e o "voltar" do Android continua fechando. */}
          {Platform.OS === "android" && lojaDisponivel(pagamento) ? (
            <Pressable
              onPress={restaurar}
              disabled={operando || assinatura.carregando}
              style={({ pressed }) => [s.secundario, pressed && s.secundarioPressionado]}
              accessibilityRole="button"
            >
              {restaurando ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={s.secundarioTexto}>Restaurar compras</Text>
              )}
            </Pressable>
          ) : null}

          <Pressable onPress={() => { void atualizarStatus(); }} disabled={operando || assinatura.carregando} style={s.secundario} accessibilityRole="button">
            <Text style={s.secundarioTexto}>Atualizar status</Text>
          </Pressable>
          {mostrarResumo ? (
            <Pressable onPress={fechar} style={s.secundario} accessibilityRole="button"><Text style={s.secundarioTexto}>Concluir</Text></Pressable>
          ) : planoEscolhido ? (
            <Pressable onPress={() => setEscolhido(null)} style={s.secundario} accessibilityRole="button">
              <AppIcon name="ArrowLeft" size={16} color={colors.textSecondary} />
              <Text style={s.secundarioTexto}>Ver outros planos</Text>
            </Pressable>
          ) : temPlanoPago ? (
            <Pressable onPress={() => { setEscolhido(null); setUpgrade(false); }} style={s.secundario} accessibilityRole="button">
              <AppIcon name="ArrowLeft" size={16} color={colors.textSecondary} />
              <Text style={s.secundarioTexto}>Voltar ao meu plano</Text>
            </Pressable>
          ) : (
            <Pressable onPress={fechar} style={s.secundario} accessibilityRole="button"><Text style={s.secundarioTexto}>{exibicao === "consulta" ? "Fechar" : "Agora não"}</Text></Pressable>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.md },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: "hidden",
    // Teto em vez de margens: com marginTop/marginBottom brigando contra o
    // justifyContent:"center" o cartão saía descentralizado, e a altura pulava
    // entre a lista e o detalhe. Agora ele cresce com o conteúdo até 92% e
    // rola por dentro. Era 84%: com a saída dentro da lista, 84% cortava o
    // último plano mesmo sem aviso. O `root` já desconta os insets, então 92%
    // ainda não encosta nas barras do sistema.
    maxHeight: "92%",
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

  // Espaço maior que o gap padrão: o card em foco sobe 2% e ganha uma
  // sombra de 18px de desfoque — com o gap antigo ela encostava no vizinho.
  lista: { gap: 14 },
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
  /** Halo colorido atrás da bolha — é o que tira o ícone do "adesivo chapado". */
  opcaoIconeHalo: {
    borderRadius: 21,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  opcaoIcone: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
  /**
   * Saída com cara de card, sem borda: mesmo raio e mesmo respiro dos cards
   * de plano, e o fundo do card "Gratuito" — o único preenchido da lista. O
   * fundo branco dos outros cards não serve aqui: eles só se distinguem do
   * cartão pela borda, e sem ela o botão sumiria.
   */
  secundario: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 56,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  secundarioPressionado: { opacity: 0.7 },
  secundarioTexto: { ...typography.bodySm, color: colors.textSecondary, fontWeight: "700" },
});


