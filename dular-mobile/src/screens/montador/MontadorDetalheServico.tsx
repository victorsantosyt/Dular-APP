import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  acionarSosMontador,
  finalizarServicoMontador,
  iniciarServicoMontador,
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
  localResumo,
  statusLabel,
  upperStatus,
} from "./montadorUtils";

type Props = BottomTabScreenProps<MontadorTabParamList, "MontadorDetalheServico">;

export default function MontadorDetalheServico({ route, navigation }: Props) {
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, loading, error, reload } = useMontadorServicos();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const servico = servicos.find((item) => item.id === route.params.servicoId);
  const status = upperStatus(servico?.status);

  const fazerCheckIn = () => {
    Alert.alert("Check-in", "Check-in será conectado ao endpoint de segurança do serviço.");
  };
  const iniciarServico = async () => {
    if (!servico) return;
    try {
      setActionLoading("iniciar");
      await iniciarServicoMontador(servico.id);
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const finalizarServico = async () => {
    if (!servico) return;
    try {
      setActionLoading("finalizar");
      await finalizarServicoMontador(servico.id);
      reload();
    } catch {
      Alert.alert("Erro", "Não foi possível finalizar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const reportarProblema = () => {
    Alert.alert("Reportar problema", "Reporte de problema será conectado ao fluxo de suporte e segurança.");
  };
  const acionarSOS = async () => {
    if (!servico) return;
    try {
      setActionLoading("sos");
      await acionarSosMontador(servico.id);
      Alert.alert("SOS acionado", "A equipe de segurança foi notificada.");
    } catch {
      Alert.alert("Erro", "Não foi possível acionar SOS.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DScreen scroll withBottomPadding backgroundColor={profileTheme.background} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <AppIcon name="ArrowLeft" size={20} color={profileTheme.primary} />
        </Pressable>
        <Text style={styles.title}>Detalhe do serviço</Text>
      </View>

      {loading ? (
        <DLoadingState text="Carregando serviço" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={reload} />
      ) : !servico ? (
        <DEmptyState
          icon="Calendar"
          title="Serviço não encontrado"
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      ) : (
        <>
          <View style={[styles.hero, { borderColor: profileTheme.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: profileTheme.primarySoft }]}>
              <AppIcon name="CalendarCheck" size={24} color={profileTheme.primary} />
            </View>
            <View style={styles.heroText}>
              <Text style={styles.serviceTitle}>{labelServico(servico)}</Text>
              <Text style={styles.serviceSub}>{statusLabel(servico.status)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Info label="Data e horário" value={formatDateTime(servico)} />
            <Info label="Endereço" value={localResumo(servico, true)} />
            <Info label="Empregador" value={servico.empregador?.nome ?? "Não informado"} />
            <Info label="Valor" value={formatMoneyFromCents(servico.precoFinal ?? servico.valorEstimado)} />
            <Info label="Observações" value={servico.observacoes || "Sem observações adicionais."} />
          </View>

          <View style={styles.actions}>
            {canOpenChat(servico) ? (
              <ActionButton
                label="Abrir chat"
                icon="MessageCircle"
                accent={profileTheme.primary}
                soft={profileTheme.primarySoft}
                onPress={() => navigation.navigate("MontadorChat", { servicoId: servico.id })}
              />
            ) : null}
            <ActionButton
              label="Fazer check-in"
              icon="MapPin"
              accent={profileTheme.primary}
              soft={profileTheme.primarySoft}
              onPress={fazerCheckIn}
            />
            {status === "ACEITO" || status === "CONFIRMADO" ? (
              <ActionButton
                label={actionLoading === "iniciar" ? "Iniciando" : "Iniciar serviço"}
                icon="Clock"
                accent={profileTheme.primary}
                soft={profileTheme.primarySoft}
                onPress={iniciarServico}
              />
            ) : null}
            {status === "EM_ANDAMENTO" ? (
              <ActionButton
                label={actionLoading === "finalizar" ? "Finalizando" : "Finalizar serviço"}
                icon="CheckCircle"
                accent={profileTheme.primary}
                soft={profileTheme.primarySoft}
                onPress={finalizarServico}
              />
            ) : null}
            <ActionButton
              label="Reportar problema"
              icon="AlertTriangle"
              accent={colors.danger}
              soft={colors.dangerSoft}
              onPress={reportarProblema}
            />
            <Pressable onPress={acionarSOS} disabled={actionLoading === "sos"} style={styles.sosButton}>
              <Text style={styles.sosText}>{actionLoading === "sos" ? "Enviando SOS" : "Acionar SOS"}</Text>
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

function ActionButton({
  label,
  icon,
  accent,
  soft,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  accent: string;
  soft: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: soft }, pressed && styles.pressed]}>
      <AppIcon name={icon} size={18} color={accent} />
      <Text style={[styles.actionText, { color: accent }]}>{label}</Text>
    </Pressable>
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
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "700",
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
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
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
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  infoValue: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
  },
  actionText: {
    ...typography.bodySm,
    fontWeight: "700",
  },
  sosButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
  },
  sosText: {
    color: colors.white,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
