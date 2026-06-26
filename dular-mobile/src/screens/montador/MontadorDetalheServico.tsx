import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { AppIcon, AvaliacaoModal, DAvatar, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  acionarSosMontador,
  cancelarServicoMontador,
  confirmarFinalizacaoMontador,
  finalizarServicoMontador,
  iniciarServicoMontador,
} from "@/api/montadorApi";
import { MotivoModal } from "@/components/MotivoModal";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useSeguranca } from "@/hooks/useSeguranca";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import {
  canOpenChat,
  formatDateTime,
  formatValorServico,
  labelServico,
  labelSubcategoria,
  localResumo,
  statusLabel,
  upperStatus,
} from "./montadorUtils";

type Props = BottomTabScreenProps<MontadorTabParamList, "MontadorDetalheServico">;

export default function MontadorDetalheServico({ route, navigation }: Props) {
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, loading, error, reload, refetch } = useMontadorServicos();
  // Check-in real (mesmo hook do diarista): POST /api/seguranca/checkin com
  // localização best-effort. Estado conduz o rótulo do botão.
  const { checkInRealizado, checkInLoading, fazerCheckIn: registrarCheckIn } = useSeguranca();
  const checkinAlertRef = useRef(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [avaliarOpen, setAvaliarOpen] = useState(false);
  // Flag local otimista até o refetch da lista trazer `avaliacaoEmpregador`.
  const [avaliouLocal, setAvaliouLocal] = useState(false);
  const servico = servicos.find((item) => item.id === route.params.servicoId);
  const empregadorNome = servico?.empregador?.nome?.trim() || "Empregador";
  const empregadorIniciais = empregadorNome.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const status = upperStatus(servico?.status);
  const encerrado = isStatusEncerrado(status);
  // CONFIRMADO/FINALIZADO liberam a avaliação do montador → empregador.
  const jaAvaliouEmpregador = avaliouLocal || Boolean(servico?.avaliacaoEmpregador);
  const podeAvaliarEmpregador =
    ["CONFIRMADO", "FINALIZADO"].includes(status) && !jaAvaliouEmpregador;

  // Polling on focus para capturar a confirmação da outra parte. Usa refetch
  // (refresh silencioso) — NÃO reload — para não acionar o DLoadingState e piscar
  // a tela em branco a cada ciclo. A primeira carga (com spinner) vem do mount
  // do hook; aqui só atualizamos os dados em segundo plano.
  useFocusEffect(
    useCallback(() => {
      refetch();
      const timer = setInterval(() => refetch(), 12000);
      return () => clearInterval(timer);
    }, [refetch]),
  );
  const isCanceladoOuRecusado = status === "CANCELADO" || status === "RECUSADO";

  // Feedback de sucesso (uma vez) quando o check-in é registrado no backend.
  useEffect(() => {
    if (checkInRealizado && !checkinAlertRef.current) {
      checkinAlertRef.current = true;
      Alert.alert("Check-in realizado", "Seu check-in de segurança foi registrado.");
    }
  }, [checkInRealizado]);

  const fazerCheckIn = async () => {
    if (!servico || checkInLoading || checkInRealizado) return;
    await registrarCheckIn(servico.id);
  };
  const copiarNumeroServico = async () => {
    if (!servico) return;
    await Clipboard.setStringAsync(`#${servico.id.slice(0, 6).toUpperCase()}`);
    Alert.alert("Copiado", "Número do serviço copiado.");
  };
  const iniciarServico = async () => {
    if (!servico) return;
    try {
      setActionLoading("iniciar");
      await iniciarServicoMontador(servico.id);
      refetch();
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
      try {
        await confirmarFinalizacaoMontador(servico.id);
      } catch {
        await finalizarServicoMontador(servico.id);
      }
      refetch();
    } catch {
      Alert.alert("Erro", "Não foi possível finalizar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  // Pergunta sobre o pagamento (ótica do profissional, quem recebe) antes de finalizar.
  const perguntarPagamentoEFinalizar = () => {
    Alert.alert("Pagamento", "Você já recebeu o pagamento?", [
      { text: "Ainda não", style: "cancel" },
      { text: "Sim, já recebi", onPress: () => { void finalizarServico(); } },
    ]);
  };
  const confirmarCancelamento = async (motivo: string, observacao: string) => {
    if (!servico) return;
    try {
      setActionLoading("cancelar");
      await cancelarServicoMontador(servico.id, motivo, observacao || undefined);
      setCancelOpen(false);
      refetch();
    } catch {
      Alert.alert("Erro", "Não foi possível cancelar o serviço.");
    } finally {
      setActionLoading(null);
    }
  };
  const reportarProblema = () => {
    if (!servico) return;
    navigation.navigate("ReportIncident", { servicoId: servico.id });
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
            <View style={styles.heroText}>
              <Text style={styles.serviceTitle} numberOfLines={1}>{empregadorNome}</Text>
              <View style={styles.subRow}>
                <AppIcon name="UserRound" size={13} color={colors.textMuted} strokeWidth={2.3} />
                <Text style={styles.serviceSub}>Empregador</Text>
              </View>
              <View style={styles.numeroLine}>
                <Pressable onPress={copiarNumeroServico} hitSlop={8} style={styles.numeroRow}>
                  <Text style={styles.numeroText}>Serviço #{servico.id.slice(0, 6).toUpperCase()}</Text>
                  <AppIcon name="Copy" size={13} color={colors.textMuted} />
                </Pressable>
                <View style={[styles.statusPill, { backgroundColor: profileTheme.primarySoft }]}>
                  <Text style={[styles.statusPillText, { color: profileTheme.primary }]} numberOfLines={1}>
                    {statusLabel(servico.status)}
                  </Text>
                </View>
              </View>
            </View>
            <DAvatar size="md" uri={servico.empregador?.avatarUrl ?? undefined} initials={empregadorIniciais} />
          </View>

          <View style={styles.card}>
            <Info label="Serviço" value={labelServico(servico)} />
            <Info label="Categoria" value={labelSubcategoria(servico)} />
            <Info label="Data e horário" value={formatDateTime(servico)} />
            <Info label="Endereço" value={localResumo(servico, true)} />
            <Info label="Valor" value={formatValorServico(servico.precoFinal ?? servico.valorEstimado)} />
            <Info label="Observações" value={servico.observacoes || "Sem observações adicionais."} />
          </View>

          <View style={styles.actions}>
            {/* Ações em cards de 2 colunas, alinhados. */}
            <View style={styles.actionGrid}>
              {/* CTA principal: mesmo card do grid, mas preenchido (cor cheia)
                  para se destacar quando o serviço pode ser finalizado. */}
              {!encerrado && status === "EM_ANDAMENTO" ? (
                <ActionButton
                  label={actionLoading === "finalizar" ? "Finalizando…" : "Finalizar serviço"}
                  icon="CheckCircle"
                  accent={profileTheme.primary}
                  soft={profileTheme.primarySoft}
                  filled
                  onPress={perguntarPagamentoEFinalizar}
                />
              ) : null}
              {canOpenChat(servico) ? (
                <ActionButton
                  label="Abrir chat"
                  icon="MessageCircle"
                  accent={profileTheme.primary}
                  soft={profileTheme.primarySoft}
                  onPress={() =>
                    navigation.navigate("MontadorChat", {
                      roomId: servico.id,
                      servicoId: servico.id,
                      nomeUsuario: servico.empregador?.nome ?? "Empregador",
                    })
                  }
                />
              ) : null}
              {!encerrado ? (
                <ActionButton
                  label={checkInLoading ? "Registrando…" : checkInRealizado ? "Check-in feito" : "Fazer check-in"}
                  icon={checkInRealizado ? "CheckCircle" : "MapPin"}
                  accent={profileTheme.primary}
                  soft={profileTheme.primarySoft}
                  onPress={fazerCheckIn}
                />
              ) : null}
              {!encerrado && status === "ACEITO" ? (
                <ActionButton
                  label={actionLoading === "iniciar" ? "Iniciando…" : "Iniciar serviço"}
                  icon="Clock"
                  accent={profileTheme.primary}
                  soft={profileTheme.primarySoft}
                  onPress={iniciarServico}
                />
              ) : null}
              {!encerrado && ["ACEITO", "EM_ANDAMENTO"].includes(status) ? (
                <ActionButton
                  label={actionLoading === "cancelar" ? "Cancelando…" : "Cancelar serviço"}
                  icon="XCircle"
                  accent={colors.danger}
                  soft={colors.dangerSoft}
                  onPress={() => setCancelOpen(true)}
                />
              ) : null}
              <ActionButton
                label="Reportar problema"
                icon="AlertTriangle"
                accent={colors.danger}
                soft={colors.dangerSoft}
                onPress={reportarProblema}
              />
            </View>

            {status === "AGUARDANDO_FINALIZACAO" ? (
              <View style={[styles.statusInfo, { backgroundColor: colors.warningSoft }]}>
                <AppIcon name="Hourglass" size={16} color={colors.warning} />
                <Text style={[styles.statusInfoText, { color: colors.warning }]}>
                  Você finalizou o serviço. Aguardando o empregador confirmar para concluir.
                </Text>
              </View>
            ) : null}
            {isCanceladoOuRecusado ? (
              <View style={[styles.statusInfo, { backgroundColor: colors.dangerSoft }]}>
                <AppIcon name="XCircle" size={16} color={colors.danger} />
                <Text style={[styles.statusInfoText, { color: colors.danger }]}>
                  {status === "CANCELADO" ? "Serviço cancelado." : "Serviço recusado."}
                </Text>
              </View>
            ) : null}
            {encerrado && !isCanceladoOuRecusado ? (
              <>
                <View style={[styles.statusInfo, { backgroundColor: colors.successSoft }]}>
                  <AppIcon name="CheckCircle" size={16} color={colors.success} />
                  <Text style={[styles.statusInfoText, { color: colors.success }]}>
                    {jaAvaliouEmpregador ? "Avaliação enviada. Obrigado!" : "Serviço finalizado."}
                  </Text>
                </View>
                {podeAvaliarEmpregador ? (
                  <Pressable
                    onPress={() => setAvaliarOpen(true)}
                    style={[styles.sosButton, { backgroundColor: profileTheme.primary }]}
                  >
                    <Text style={styles.sosText}>Avaliar empregador</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {!encerrado ? (
              <Pressable onPress={acionarSOS} disabled={actionLoading === "sos"} style={styles.sosButton}>
                <Text style={styles.sosText}>{actionLoading === "sos" ? "Enviando SOS" : "Acionar SOS"}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}

      <MotivoModal
        visible={cancelOpen}
        title="Cancelar serviço"
        confirmLabel="Cancelar serviço"
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmarCancelamento}
      />

      {servico ? (
        <AvaliacaoModal
          visible={avaliarOpen}
          servicoId={servico.id}
          nomeAvaliado={servico.empregador?.nome ?? "Empregador"}
          endpoint={`/api/servicos/${servico.id}/avaliar-empregador`}
          accent={profileTheme.primary}
          onClose={() => setAvaliarOpen(false)}
          onSucesso={() => {
            setAvaliarOpen(false);
            setAvaliouLocal(true);
            refetch();
            Alert.alert("Avaliação enviada", "Obrigado por avaliar o empregador.");
          }}
        />
      ) : null}
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
  filled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof AppIcon>["name"];
  accent: string;
  soft: string;
  onPress: () => void;
  /** Card preenchido (cor cheia, conteúdo branco) para destacar o CTA principal. */
  filled?: boolean;
}) {
  const contentColor = filled ? colors.white : accent;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        filled
          ? { backgroundColor: accent, borderColor: accent }
          : { backgroundColor: soft, borderColor: accent + "22" },
        pressed && styles.pressed,
      ]}
    >
      <AppIcon name={icon} size={22} color={contentColor} />
      <Text numberOfLines={2} style={[styles.actionCardText, { color: contentColor }]}>{label}</Text>
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
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  numeroLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
  },
  numeroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  numeroText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: "700",
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
    gap: 12,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  actionCard: {
    width: "48%",
    minHeight: 92,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  actionCardText: {
    ...typography.caption,
    fontWeight: "700",
    textAlign: "center",
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
  statusInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
  },
  statusInfoText: {
    ...typography.bodySm,
    fontWeight: "700",
    flex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
});
