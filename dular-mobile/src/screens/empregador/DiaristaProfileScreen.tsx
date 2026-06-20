/**
 * DiaristaProfileScreen — tela "Ver Perfil" que o empregador abre ao tocar num
 * card de DIARISTA. Usa o layout ÚNICO `PerfilPublicoLayout` (mesma estrutura do
 * perfil do montador), preenchido com os dados da profissional. Não há mais
 * estruturas de perfil diferentes por categoria.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

import { useDiaristaPublico } from "@/hooks/useDiaristaPublico";
import { useFavoritos } from "@/hooks/useFavoritos";
import { DButton } from "@/components/DButton";
import { AppIcon } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import { formatCurrencyBRL, formatDecimalBRL } from "@/api/diaristaApi";
import { fetchServicosMinhas } from "@/api/sharedFetcher";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { ServicoOferecido } from "@/types/diarista";
import { PerfilPublicoLayout, type PerfilSection } from "@/screens/empregador/PerfilPublicoLayout";

type RouteProps = RouteProp<EmpregadorTabParamList, "DiaristaProfile">;
type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;

const SERVICO_LABELS: Record<ServicoOferecido, string> = {
  DIARISTA: "Diarista",
  BABA: "Babá",
  COZINHEIRA: "Cozinheira",
  FAXINEIRA: "Faxineira",
  PASSADEIRA: "Passadeira",
  LAVADEIRA: "Lavadeira",
  CUIDADORA: "Cuidadora",
};

type ServicoAtivoDiarista = {
  id: string;
  status?: string | null;
  diarista?: { id?: string | null } | null;
};

type MinhasServicosResponse = {
  servicos?: ServicoAtivoDiarista[];
};

function tempoLabel(meses: number): string {
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.round(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function precoLinhaLabel(
  tipo: ServicoOferecido,
  precos: { leve: number | null; medio: number | null; pesada: number | null },
  extras: {
    precoBabaHora?: string | number | null;
    precoCozinheiraBase?: string | number | null;
  },
): string {
  if (tipo === "DIARISTA") {
    // precoLeve/Pesada armazenados em CENTAVOS (Int) → ÷100 para exibir.
    const leveFmt = precos.leve != null ? formatCurrencyBRL(precos.leve / 100) : null;
    const pesadaFmt = precos.pesada != null ? formatCurrencyBRL(precos.pesada / 100) : null;
    if (leveFmt && pesadaFmt) return `A partir de ${leveFmt} (leve), ${pesadaFmt} (pesada)`;
    if (leveFmt) return `A partir de ${leveFmt} (leve)`;
    if (pesadaFmt) return `A partir de ${pesadaFmt} (pesada)`;
    return "Sob consulta";
  }
  if (tipo === "BABA") {
    const fmt = formatDecimalBRL(extras.precoBabaHora ?? null);
    return fmt ? `${fmt}/hora` : "A combinar";
  }
  if (tipo === "COZINHEIRA") {
    const fmt = formatDecimalBRL(extras.precoCozinheiraBase ?? null);
    return fmt ? `A partir de ${fmt}` : "A combinar";
  }
  return "A combinar";
}

export function DiaristaProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const { diaristaId, nome: nomeParam, categoriaInicial = "diarista" } = route.params;

  const { diarista, loading, error } = useDiaristaPublico(diaristaId);
  const [activeService, setActiveService] = useState<ServicoAtivoDiarista | null>(null);
  const { isFavorito, toggle: toggleFavorito } = useFavoritos();

  const nome = diarista?.nome || nomeParam;
  const favoritoUserId = diarista?.userId ?? diaristaId ?? null;
  const favorito = favoritoUserId ? isFavorito(favoritoUserId, "DIARISTA") : false;

  const handleToggleFavorito = async () => {
    if (!favoritoUserId) return;
    try {
      await toggleFavorito(favoritoUserId, "DIARISTA");
    } catch {
      Alert.alert("Não foi possível atualizar", "Tente novamente em instantes. Verifique sua conexão.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadActiveService() {
      if (!diaristaId) {
        setActiveService(null);
        return;
      }
      try {
        const data = (await fetchServicosMinhas()) as MinhasServicosResponse;
        if (cancelled) return;
        const servicos = Array.isArray(data?.servicos) ? data.servicos : [];
        const active = servicos.find(
          (servico) => servico.diarista?.id === diaristaId && !isStatusEncerrado(servico.status),
        );
        setActiveService(active ?? null);
      } catch {
        if (!cancelled) setActiveService(null);
      }
    }
    void loadActiveService();
    return () => {
      cancelled = true;
    };
  }, [diaristaId]);

  const handleAcompanharServico = () => {
    if (activeService?.id) {
      navigation.navigate("EmpregadorDetalhe", { servicoId: activeService.id });
      return;
    }
    navigation.navigate("Agendamentos");
  };

  const handleContratar = () => {
    if (!diaristaId) {
      Alert.alert("Perfil inválido", "Não foi possível identificar a profissional.");
      return;
    }
    if (diarista && !diarista.perfilCompleto) {
      Alert.alert(
        "Perfil incompleto",
        "Esta profissional ainda não completou o perfil e não está disponível para contratação.",
      );
      return;
    }

    let precoEstimadoLabel: string | undefined;
    if (diarista) {
      const tipoParaPreco: ServicoOferecido =
        diarista.servicosOferecidos?.[0] ??
        (categoriaInicial?.toUpperCase() as ServicoOferecido | undefined) ??
        "DIARISTA";
      precoEstimadoLabel = precoLinhaLabel(tipoParaPreco, diarista.precos, {
        precoBabaHora: diarista.precoBabaHora,
        precoCozinheiraBase: diarista.precoCozinheiraBase,
      });
    }

    navigation.navigate("SolicitarServico", {
      categoriaInicial,
      tipoInicial: "DIARISTA",
      profissionalId: diaristaId,
      profissionalNome: nome,
      precoEstimadoLabel,
    });
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !diarista) {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>Não foi possível carregar o perfil.</Text>
        <DButton title="Voltar" variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const {
    safeScore,
    totalServicos,
    tempoPlataforma,
    verificado,
    mediaAvaliacao,
    bio,
    servicosOferecidos,
    bairros,
    cidade,
    uf,
    precos,
    atendeTodaCidade,
    precoBabaHora,
    precoCozinheiraBase,
    valorACombinar,
    observacaoPreco,
    perfilCompleto,
  } = diarista;

  const servicosList = servicosOferecidos?.length ? servicosOferecidos : [];
  const tipoParaPreco: ServicoOferecido = servicosList[0] ?? "DIARISTA";
  const precoValue = valorACombinar
    ? "A combinar"
    : precoLinhaLabel(tipoParaPreco, precos, { precoBabaHora, precoCozinheiraBase });

  const cidadeUf = [cidade, uf].filter(Boolean).join(", ") || "Localização a confirmar";
  const bairrosItems = atendeTodaCidade
    ? ["Atende toda a cidade"]
    : (bairros ?? []).map((b) => b.nome).filter(Boolean).slice(0, 6);

  const portfolioFotos = (diarista as { portfolioFotos?: string[] }).portfolioFotos ?? [];

  const sections: PerfilSection[] = [
    { key: "sobre", kind: "text", label: "Sobre", text: bio, empty: "Nenhuma bio cadastrada." },
    {
      key: "servicos",
      kind: "chips",
      label: "Serviços oferecidos",
      items: servicosList.map((sv) => SERVICO_LABELS[sv] ?? sv),
      empty: "Serviços não informados.",
    },
    {
      key: "area",
      kind: "chips",
      label: "Área de atendimento",
      lead: cidadeUf,
      items: bairrosItems,
      empty: "Bairros não informados.",
    },
    {
      key: "info",
      kind: "infoGrid",
      cells: [
        { label: "Preço", value: precoValue, hint: observacaoPreco },
        {
          label: "SafeScore",
          value: safeScore?.faixa ?? "Em análise",
          hint: verificado ? "Verificado" : "Verificação pendente",
        },
      ],
    },
    {
      key: "portfolio",
      kind: "text",
      label: "Portfólio",
      text: portfolioFotos.length > 0 ? `${portfolioFotos.length} foto(s) cadastrada(s).` : null,
      empty: "Portfólio ainda não informado.",
    },
    {
      key: "stats",
      kind: "stats",
      stats: [
        { value: String(totalServicos), label: "Serviços" },
        { value: tempoLabel(tempoPlataforma), label: "Na plataforma" },
      ],
    },
  ];

  const footer = activeService ? (
    <DButton title="Acompanhar" onPress={handleAcompanharServico} />
  ) : perfilCompleto ? (
    <DButton title="Contratar" onPress={handleContratar} />
  ) : (
    <View style={s.unavailableBox}>
      <AppIcon name="AlertTriangle" size={16} color={colors.warning} strokeWidth={2.3} />
      <Text style={s.unavailableText}>Perfil incompleto — não disponível para contratação</Text>
    </View>
  );

  return (
    <PerfilPublicoLayout
      title="Perfil da Profissional"
      onBack={() => navigation.goBack()}
      favorito={favorito}
      onToggleFavorito={favoritoUserId ? handleToggleFavorito : undefined}
      hero={{
        avatarUrl: diarista.avatarUrl,
        nome,
        papel: "Profissional de casa",
        rating: mediaAvaliacao,
        verificado,
        locationLine: cidade ? `${cidade}${uf ? ` · ${uf}` : ""}` : null,
      }}
      sections={sections}
      footer={footer}
    />
  );
}

export default DiaristaProfileScreen;

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  errorTitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  unavailableBox: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  unavailableText: {
    color: colors.warning,
    ...typography.caption,
    fontWeight: "800",
    flexShrink: 1,
  },
});
