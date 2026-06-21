/**
 * MontadorPublicProfile — tela "Ver Perfil" que o empregador abre ao tocar num
 * card de MONTADOR. Usa o layout ÚNICO `PerfilPublicoLayout` (a mesma estrutura
 * de todos os perfis públicos), preenchido com os dados do montador. Tema
 * sempre EMPREGADOR (roxo lavanda).
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { api } from "@/lib/api";
import { AppIcon, DButton } from "@/components/ui";
import { getProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadows, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import { MONTADOR_ESPECIALIDADES, type MontadorItem } from "@/types/montador";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { useFavoritos } from "@/hooks/useFavoritos";
import { PerfilPublicoLayout, type PerfilSection } from "@/screens/empregador/PerfilPublicoLayout";
import { goToTab } from "@/navigation/navHelpers";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type RouteProps = RouteProp<EmpregadorTabParamList, "MontadorPublicProfile">;

type DetalheResponse = { ok?: boolean; montador?: MontadorItem };
type ServicoAtivoResponse = {
  ok?: boolean;
  hasActiveService?: boolean;
  servico?: { id?: string; status?: string | null } | null;
  activeService?: { id?: string; status?: string | null } | null;
};

const MONTADOR_LABELS = Object.fromEntries(
  MONTADOR_ESPECIALIDADES.map((item) => [item.id, item.label]),
) as Record<string, string>;

const EMPREGADOR_THEME = getProfileTheme({ role: "EMPREGADOR" });

function statusLabel(status?: string | null) {
  const value = String(status ?? "").toUpperCase();
  if (value === "PENDENTE" || value === "SOLICITADO") return "Aguardando aceite";
  if (value === "ACEITO") return "Aceito";
  if (value === "INICIADO" || value === "EM_ANDAMENTO") return "Em andamento";
  if (value === "CONCLUIDO" || value === "CONCLUÍDO") return "Concluído";
  if (value === "CONFIRMADO") return "Confirmado";
  if (value === "FINALIZADO") return "Finalizado";
  if (value === "CANCELADO") return "Cancelado";
  if (value === "RECUSADO") return "Recusado";
  return "Em acompanhamento";
}

export default function MontadorPublicProfile() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const {
    montadorId,
    montadorUserId: routeMontadorUserId,
    nome: nomeParam,
    rating: ratingParam,
    especialidades: especialidadesParam,
    cidade: cidadeParam,
    estado: estadoParam,
    avatarUrl: avatarUrlParam,
  } = route.params;

  const [montador, setMontador] = useState<MontadorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeService, setActiveService] = useState<{
    hasActiveService: boolean;
    id?: string;
    status?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<DetalheResponse>(`/api/montadores/${montadorId}`).catch(() => null);
        if (cancelled) return;
        setMontador(res?.data?.montador ?? null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [montadorId]);

  const { isFavorito, toggle: toggleFavorito } = useFavoritos();

  const profissionalId = montador?.userId ?? montador?.user.id ?? routeMontadorUserId ?? null;
  const favorito = profissionalId ? isFavorito(profissionalId, "MONTADOR") : false;

  const handleToggleFavorito = async () => {
    if (!profissionalId) return;
    try {
      await toggleFavorito(profissionalId, "MONTADOR");
    } catch {
      Alert.alert("Não foi possível atualizar", "Tente novamente em instantes. Verifique sua conexão.");
    }
  };

  const nome = montador?.user.nome ?? nomeParam ?? "Montador";
  const especialidades = montador?.especialidades ?? especialidadesParam ?? [];
  const totalServicos = montador?.totalServicos ?? 0;
  const rating = montador?.rating ?? ratingParam ?? 0;
  const verificado = montador?.verificado ?? false;
  const cidade = montador?.cidade ?? cidadeParam ?? "—";
  const estado = montador?.estado ?? estadoParam ?? "—";
  const bairros = montador?.bairros ?? [];
  const precoLabel = montador?.precoLabel ?? "A combinar";
  const portfolioFotos = montador?.portfolioFotos ?? [];
  const safeScore = montador?.safeScore;

  useEffect(() => {
    let cancelled = false;
    if (!profissionalId) {
      setActiveService(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        setActiveService(null);
        const res = await api.get<ServicoAtivoResponse>(`/api/montadores/${profissionalId}/servico-ativo`);
        if (cancelled) return;
        const servico = res.data?.servico ?? res.data?.activeService ?? null;
        const hasActiveService = Boolean(res.data?.hasActiveService ?? servico) && !isStatusEncerrado(servico?.status);
        setActiveService({
          hasActiveService,
          id: hasActiveService ? servico?.id : undefined,
          status: hasActiveService ? servico?.status : undefined,
        });
      } catch {
        if (!cancelled) setActiveService({ hasActiveService: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profissionalId]);

  const handleContratar = () => {
    if (montador && montador.profileCompleto === false) {
      Alert.alert("Montador indisponível", "Este perfil ainda não está completo para receber solicitações.");
      return;
    }
    if (!profissionalId) {
      Alert.alert(
        "Montador não identificado",
        "Não foi possível identificar o montador selecionado. Volte e escolha um profissional novamente.",
      );
      return;
    }
    navigation.navigate("SolicitarServico", {
      categoriaInicial: "montador",
      tipoInicial: "MONTADOR",
      profissionalId,
      profissionalNome: nome,
    });
  };

  const handleAcompanharServico = () => {
    if (activeService?.id) {
      navigation.navigate("EmpregadorDetalhe", { servicoId: activeService.id });
      return;
    }
    goToTab(navigation, "EmpregadorTabs", "Agendamentos");
  };

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color={EMPREGADOR_THEME.primary} />
      </View>
    );
  }

  const locationLine =
    cidade && cidade !== "—" ? `${cidade}${estado && estado !== "—" ? ` · ${estado}` : ""}` : null;

  const sections: PerfilSection[] = [
    { key: "sobre", kind: "text", label: "Sobre", text: montador?.bio, empty: "Sem descrição informada." },
    {
      key: "especialidades",
      kind: "chips",
      label: "Especialidades",
      items: especialidades.map((e) => MONTADOR_LABELS[e] ?? e),
      empty: "Especialidades não informadas.",
    },
    {
      key: "area",
      kind: "chips",
      label: "Área de atendimento",
      lead: [cidade, estado].filter((x) => x && x !== "—").join(", ") || "Localização a confirmar",
      items: bairros.slice(0, 6),
      empty: "Bairros não informados.",
    },
    {
      key: "info",
      kind: "infoGrid",
      cells: [
        { label: "Preço", value: precoLabel, hint: montador?.observacaoPreco },
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
        { value: String(montador?.anosExperiencia ?? "—"), label: "Anos de experiência" },
      ],
    },
  ];

  if (activeService?.hasActiveService) {
    sections.push({
      key: "activeService",
      kind: "custom",
      render: () => (
        <View style={s.activeServiceCard}>
          <View style={s.activeServiceIcon}>
            <AppIcon name="Clock" size={20} color={EMPREGADOR_THEME.primary} strokeWidth={2.4} />
          </View>
          <View style={s.activeServiceText}>
            <Text style={s.activeServiceTitle}>Você já tem uma solicitação com este montador.</Text>
            <Text style={s.activeServiceSubtitle}>Status: {statusLabel(activeService.status)}</Text>
          </View>
          <DButton label="Acompanhar" variant="secondary" size="sm" onPress={handleAcompanharServico} />
        </View>
      ),
    });
  }

  const footer =
    activeService?.hasActiveService === false ? (
      <DButton label="Contratar" variant="primary" size="lg" onPress={handleContratar} />
    ) : undefined;

  return (
    <PerfilPublicoLayout
      title="Perfil do Montador"
      onBack={() => navigation.goBack()}
      favorito={favorito}
      onToggleFavorito={profissionalId ? handleToggleFavorito : undefined}
      error={error}
      hero={{
        avatarUrl: montador?.fotoPerfil ?? montador?.user.avatarUrl ?? avatarUrlParam,
        nome,
        papel: "Montador profissional",
        rating,
        verificado,
        locationLine,
      }}
      sections={sections}
      footer={footer}
    />
  );
}

const s = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: EMPREGADOR_THEME.background,
  },
  activeServiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: EMPREGADOR_THEME.border,
    padding: 14,
    gap: 12,
    ...shadows.soft,
  },
  activeServiceIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: EMPREGADOR_THEME.primarySoft,
  },
  activeServiceText: { flex: 1, gap: 4 },
  activeServiceTitle: { ...typography.bodySmMedium, color: colors.textPrimary, fontWeight: "800" },
  activeServiceSubtitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
});
