import React, { useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  aceitarSolicitacaoMontador,
  recusarSolicitacaoMontador,
  type MontadorSafeScore,
  type MontadorServico,
} from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  canOpenChat,
  formatDateTime,
  formatMoneyFromCents,
  labelServico,
  labelSubcategoria,
  localResumo,
  statusLabel,
  upperStatus,
} from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;
type Tab = "novas" | "aceitas" | "recusadas" | "expiradas";

const TABS: { id: Tab; label: string }[] = [
  { id: "novas", label: "Novas" },
  { id: "aceitas", label: "Aceitas" },
  { id: "recusadas", label: "Recusadas" },
  { id: "expiradas", label: "Expiradas" },
];

function inTab(servico: MontadorServico, tab: Tab) {
  const status = upperStatus(servico.status);
  if (tab === "novas") return status === "SOLICITADO" || status === "PENDENTE";
  if (tab === "aceitas") return ["ACEITO", "CONFIRMADO", "EM_ANDAMENTO", "FINALIZADO", "CONCLUIDO"].includes(status);
  if (tab === "recusadas") return status === "RECUSADO" || status === "CANCELADO";
  return status === "EXPIRADO";
}

function TabChip({
  label,
  active,
  accent,
  soft,
  onPress,
}: {
  label: string;
  active: boolean;
  accent: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tabChip,
        active
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: colors.surface, borderColor: soft },
      ]}
    >
      <Text style={[styles.tabText, { color: active ? colors.white : colors.textSecondary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ScoreLine({ score, accent }: { score?: MontadorSafeScore | null; accent: string }) {
  return (
    <View style={styles.scoreLine}>
      <AppIcon name="ShieldCheck" size={15} color={accent} />
      <Text style={styles.scoreText}>
        SafeScore do empregador: {score?.faixa ?? "não disponível"}
      </Text>
    </View>
  );
}

function SolicitacaoCard({
  servico,
  score,
  accent,
  soft,
  loading,
  onAceitar,
  onRecusar,
  onDetalhe,
  onEmpregador,
  onFotos,
  onChat,
}: {
  servico: MontadorServico;
  score?: MontadorSafeScore | null;
  accent: string;
  soft: string;
  loading: boolean;
  onAceitar: () => void;
  onRecusar: () => void;
  onDetalhe: () => void;
  onEmpregador: () => void;
  onFotos: () => void;
  onChat: () => void;
}) {
  const status = upperStatus(servico.status);
  const isNew = status === "SOLICITADO" || status === "PENDENTE";
  const photos = Array.isArray(servico.fotos) ? servico.fotos : [];
  const empregadorNome = servico.empregador?.nome?.trim() || "Empregador não informado";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: soft }]}>
          <AppIcon name="UserRound" size={20} color={accent} />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{empregadorNome}</Text>
          <Text style={styles.cardSub}>{labelSubcategoria(servico)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: soft, borderColor: accent }]}>
          <Text style={[styles.statusText, { color: accent }]}>{statusLabel(servico.status)}</Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <Text style={styles.infoLabel}>Data e horário</Text>
        <Text style={styles.infoValue}>{formatDateTime(servico)}</Text>
        <Text style={styles.infoLabel}>Bairro</Text>
        <Text style={styles.infoValue}>{localResumo(servico)}</Text>
        <Text style={styles.infoLabel}>Serviço</Text>
        <Text style={styles.infoValue}>{labelServico(servico)}</Text>
        <Text style={styles.infoLabel}>Valor estimado</Text>
        <Text style={styles.infoValue}>{formatMoneyFromCents(servico.valorEstimado ?? servico.precoFinal)}</Text>
      </View>

      {servico.observacoes ? (
        <View style={styles.notes}>
          <Text style={styles.notesLabel}>Observações</Text>
          <Text style={styles.notesText}>{servico.observacoes}</Text>
        </View>
      ) : null}

      {photos.length > 0 ? (
        <Pressable onPress={onFotos} style={styles.photosRow}>
          {photos.slice(0, 3).map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.photoThumb} />
          ))}
          <Text style={[styles.photosText, { color: accent }]}>{photos.length} foto(s)</Text>
        </Pressable>
      ) : null}

      <ScoreLine score={score} accent={accent} />

      <View style={styles.actions}>
        {isNew ? (
          <>
            <Pressable onPress={onAceitar} disabled={loading} style={[styles.primaryAction, { backgroundColor: accent }]}>
              <Text style={styles.primaryActionText}>{loading ? "Aceitando" : "Aceitar"}</Text>
            </Pressable>
            <Pressable onPress={onRecusar} disabled={loading} style={styles.rejectAction}>
              <Text style={styles.rejectText}>{loading ? "Recusando" : "Recusar"}</Text>
            </Pressable>
          </>
        ) : null}
        <Pressable onPress={onDetalhe} style={[styles.softAction, { backgroundColor: soft }]}>
          <Text style={[styles.softActionText, { color: accent }]}>Ver detalhes</Text>
        </Pressable>
        <Pressable onPress={onEmpregador} style={styles.ghostAction}>
          <Text style={styles.ghostActionText}>Empregador</Text>
        </Pressable>
        <Pressable onPress={onChat} style={styles.ghostAction}>
          <Text style={styles.ghostActionText}>Chat</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MontadorSolicitacoes() {
  const navigation = useNavigation<Navigation>();
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, scoreByUser, loading, refreshing, error, refetch, reload } = useMontadorServicos();
  const [tab, setTab] = useState<Tab>("novas");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const data = useMemo(() => servicos.filter((item) => inTab(item, tab)), [servicos, tab]);

  const carregarSolicitacoesMontador = reload;
  const aceitarSolicitacao = async (servicoId: string) => {
    try {
      setActionLoading(servicoId);
      await aceitarSolicitacaoMontador(servicoId);
      setTab("aceitas");
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível aceitar a solicitação.");
    } finally {
      setActionLoading(null);
    }
  };
  const recusarSolicitacao = (servicoId: string) => {
    Alert.alert("Recusar solicitação", "Confirma que deseja recusar esta solicitação?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Recusar",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(servicoId);
            await recusarSolicitacaoMontador(servicoId);
            setTab("recusadas");
            reload();
          } catch {
            Alert.alert("Erro", "Não foi possível recusar a solicitação.");
          } finally {
            setActionLoading(null);
          }
        },
      },
    ]);
  };
  const verEmpregador = (servicoId: string) => {
    const servico = servicos.find((item) => item.id === servicoId);
    Alert.alert("Empregador", servico?.empregador?.nome ?? "Dados do empregador indisponíveis.");
  };
  const verFotosDoServico = (servicoId: string) => {
    const total = servicos.find((item) => item.id === servicoId)?.fotos?.length ?? 0;
    Alert.alert("Fotos do serviço", total > 0 ? `${total} foto(s) vinculadas ao pedido.` : "Nenhuma foto vinculada.");
  };
  const abrirChatDoServico = (servico: MontadorServico) => {
    if (!canOpenChat(servico)) {
      Alert.alert("Chat bloqueado", "O chat completo libera depois que a solicitação for aceita.");
      return;
    }
    navigation.navigate("MontadorChat", { servicoId: servico.id });
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={profileTheme.background}
      refreshing={refreshing}
      refreshTintColor={profileTheme.primary}
      onRefresh={refetch}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Solicitações</Text>
        <Text style={styles.subtitle}>Pedidos recebidos para aceitar ou recusar</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <TabChip
            key={item.id}
            label={item.label}
            active={tab === item.id}
            accent={profileTheme.primary}
            soft={profileTheme.primarySoft}
            onPress={() => setTab(item.id)}
          />
        ))}
      </View>

      {loading ? (
        <DLoadingState text="Carregando solicitações" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={carregarSolicitacoesMontador} />
      ) : data.length === 0 ? (
        <DEmptyState
          icon="BriefcaseBusiness"
          title="Nenhuma solicitação nesta aba"
          subtitle="Novos pedidos aparecerão aqui quando chegarem."
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      ) : (
        <View style={styles.list}>
          {data.map((item) => (
            <SolicitacaoCard
              key={item.id}
              servico={item}
              score={item.empregador?.id ? scoreByUser[item.empregador.id] : null}
              accent={profileTheme.primary}
              soft={profileTheme.primarySoft}
              loading={actionLoading === item.id}
              onAceitar={() => aceitarSolicitacao(item.id)}
              onRecusar={() => recusarSolicitacao(item.id)}
              onDetalhe={() =>
                inTab(item, "novas")
                  ? navigation.navigate("MontadorDetalheSolicitacao", { servicoId: item.id })
                  : navigation.navigate("MontadorDetalheServico", { servicoId: item.id })
              }
              onEmpregador={() => verEmpregador(item.id)}
              onFotos={() => verFotosDoServico(item.id)}
              onChat={() => abrirChatDoServico(item)}
            />
          ))}
        </View>
      )}
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tabChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabText: {
    ...typography.caption,
    fontWeight: "700",
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  cardSub: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "700",
  },
  infoGrid: {
    gap: 4,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  infoValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "500",
    marginBottom: 4,
  },
  notes: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    padding: 10,
  },
  notesLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    marginBottom: 4,
  },
  notesText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  photosRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
  },
  photosText: {
    ...typography.caption,
    fontWeight: "700",
  },
  scoreLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  scoreText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  primaryAction: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  primaryActionText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: "700",
  },
  rejectAction: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  rejectText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: "700",
  },
  softAction: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  softActionText: {
    ...typography.caption,
    fontWeight: "700",
  },
  ghostAction: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.surfaceAlt,
  },
  ghostActionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
  },
});
