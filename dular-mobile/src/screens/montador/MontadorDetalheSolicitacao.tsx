import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import { aceitarSolicitacaoMontador, recusarSolicitacaoMontador } from "@/api/montadorApi";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  formatDateTime,
  formatMoneyFromCents,
  labelServico,
  labelSubcategoria,
  localResumo,
} from "./montadorUtils";

type Props = BottomTabScreenProps<MontadorTabParamList, "MontadorDetalheSolicitacao">;

export default function MontadorDetalheSolicitacao({ route, navigation }: Props) {
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, scoreByUser, loading, error, reload } = useMontadorServicos();
  const [actionLoading, setActionLoading] = useState(false);
  const servico = servicos.find((item) => item.id === route.params.servicoId);
  const score = servico?.empregador?.id ? scoreByUser[servico.empregador.id] : null;
  const photos = servico?.fotos ?? [];

  const aceitar = async () => {
    if (!servico) return;
    try {
      setActionLoading(true);
      await aceitarSolicitacaoMontador(servico.id);
      reload();
      navigation.navigate("MontadorAgenda");
    } catch {
      Alert.alert("Erro", "Não foi possível aceitar a solicitação.");
    } finally {
      setActionLoading(false);
    }
  };

  const recusar = () => {
    if (!servico) return;
    Alert.alert("Recusar solicitação", "Confirma que deseja recusar este pedido?", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Recusar",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await recusarSolicitacaoMontador(servico.id);
            reload();
            navigation.navigate("MontadorSolicitacoes");
          } catch {
            Alert.alert("Erro", "Não foi possível recusar a solicitação.");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <DScreen scroll backgroundColor={profileTheme.background} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={20} color={profileTheme.primary} />
        </Pressable>
        <Text style={styles.title}>Detalhe da solicitação</Text>
      </View>

      {loading ? (
        <DLoadingState text="Carregando solicitação" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={reload} />
      ) : !servico ? (
        <DEmptyState
          icon="BriefcaseBusiness"
          title="Solicitação não encontrada"
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      ) : (
        <>
          <View style={[styles.hero, { borderColor: profileTheme.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: profileTheme.primarySoft }]}>
              <AppIcon name="Wrench" size={24} color={profileTheme.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.serviceTitle}>{labelServico(servico)}</Text>
              <Text style={styles.serviceSub}>{labelSubcategoria(servico)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Info label="Data e horário" value={formatDateTime(servico)} />
            <Info label="Bairro/endereço" value={localResumo(servico)} />
            <Info label="Empregador" value={servico.empregador?.nome ?? "Não informado"} />
            <Info label="Valor estimado" value={formatMoneyFromCents(servico.valorEstimado ?? servico.precoFinal)} />
            <Info label="SafeScore" value={score?.faixa ?? "Não disponível"} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.bodyText}>{servico.observacoes || "Sem observações adicionais."}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Fotos</Text>
            {photos.length > 0 ? (
              <View style={styles.photos}>
                {photos.map((uri) => <Image key={uri} source={{ uri }} style={styles.photo} />)}
              </View>
            ) : (
              <Text style={styles.bodyText}>Nenhuma foto enviada pelo empregador.</Text>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable disabled={actionLoading} onPress={aceitar} style={[styles.primaryButton, { backgroundColor: profileTheme.primary }]}>
              <Text style={styles.primaryText}>{actionLoading ? "Processando" : "Aceitar"}</Text>
            </Pressable>
            <Pressable disabled={actionLoading} onPress={recusar} style={styles.rejectButton}>
              <Text style={styles.rejectText}>Recusar</Text>
            </Pressable>
          </View>
        </>
      )}
    </DScreen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 14,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    flex: 1,
    ...typography.title,
    color: colors.textPrimary,
    fontWeight: "800",
  },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    padding: 14,
    ...shadows.card,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    flex: 1,
  },
  serviceTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "900",
  },
  serviceSub: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  infoBlock: {
    gap: 3,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  sectionTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "900",
  },
  bodyText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  photos: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    paddingVertical: 13,
  },
  primaryText: {
    color: colors.white,
    fontWeight: "900",
  },
  rejectButton: {
    flex: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  rejectText: {
    color: colors.danger,
    fontWeight: "900",
  },
});
