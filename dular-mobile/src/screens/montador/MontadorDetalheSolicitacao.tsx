import React, { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { AppIcon, BackCircleButton, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import {
  aceitarSolicitacaoMontador,
  proporReagendamento,
  recusarSolicitacaoMontador,
  type MontadorServico,
} from "@/api/montadorApi";
import { PropostaHorarioModal } from "@/components/PropostaHorarioModal";
import { conflitosDoPedido, type ServicoAgenda } from "@/lib/conflitoAgenda";
import { useLimiteDePlano } from "@/hooks/useLimiteDePlano";
import { MotivoModal } from "@/components/MotivoModal";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { goToTab } from "@/navigation/navHelpers";
import { colors, radius, shadows, typography } from "@/theme";
import {
  formatDateTime,
  formatValorServico,
  isSolicitacaoPendente,
  labelServico,
  labelSubcategoria,
  localResumo,
} from "./montadorUtils";

type Props = BottomTabScreenProps<MontadorTabParamList, "MontadorDetalheSolicitacao">;

function paraAgenda(s: MontadorServico): ServicoAgenda | null {
  if (!s.data) return null;
  return {
    id: s.id,
    status: String(s.status),
    data: s.data,
    hora: (s as { hora?: string | null }).hora ?? null,
    turno: s.turno ?? null,
    tipo: "MONTADOR",
    categoria: s.categoria ?? null,
  };
}

export default function MontadorDetalheSolicitacao({ route, navigation }: Props) {
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, scoreByUser, loading, error, reload } = useMontadorServicos();
  const [actionLoading, setActionLoading] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const servico = servicos.find((item) => item.id === route.params.servicoId);
  const score = servico?.empregador?.id ? scoreByUser[servico.empregador.id] : null;
  const photos = servico?.fotos ?? [];
  // Botões "Aceitar/Recusar" só fazem sentido enquanto a solicitação está pendente.
  // Sem essa checagem o botão "Aceitar" continua visível após o aceite enquanto
  // a tela ainda não navegou, permitindo um segundo clique que volta 409.
  const podeResponder = !!servico && isSolicitacaoPendente(servico);
  const [propostaOpen, setPropostaOpen] = useState(false);
  const [propostaEnviando, setPropostaEnviando] = useState(false);
  const pedido = servico ? paraAgenda(servico) : null;
  const conflitos =
    podeResponder && pedido
      ? conflitosDoPedido(pedido, servicos.map(paraAgenda).filter((x): x is ServicoAgenda => x !== null))
      : [];
  const propostaPendente = Boolean(servico?.reagendamentoData);

  const enviarProposta = async (p: { data: string; turno: "MANHA" | "TARDE"; hora: string }) => {
    if (!servico) return;
    try {
      setPropostaEnviando(true);
      await proporReagendamento(servico.id, p.data, p.turno, p.hora);
      setPropostaOpen(false);
      await reload();
      Alert.alert("Proposta enviada", "O cliente vai confirmar ou recusar o novo horário. Depois é só aceitar o pedido.");
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? "Não foi possível enviar a proposta.");
    } finally {
      setPropostaEnviando(false);
    }
  };

  const { tratar: tratarLimite } = useLimiteDePlano();

  const aceitar = async () => {
    if (!servico) return;
    try {
      setActionLoading(true);
      await aceitarSolicitacaoMontador(servico.id);
      // Aguarda o refetch para que o status reflita ACEITO antes da navegação,
      // evitando que a tela mostre o botão "Aceitar" novamente ao voltar.
      await reload();
      goToTab(navigation, "MontadorTabs", "MontadorAgenda");
    } catch (err: any) {
      if (tratarLimite(err)) return;
      // 409 = aceito por outro fluxo; sincroniza e leva para a agenda.
      if (err?.response?.status === 409) {
        await reload();
        goToTab(navigation, "MontadorTabs", "MontadorAgenda");
        return;
      }
      Alert.alert("Erro", "Não foi possível aceitar a solicitação.");
    } finally {
      setActionLoading(false);
    }
  };

  const recusar = () => {
    if (!servico) return;
    setRecusarOpen(true);
  };

  const confirmarRecusa = async (motivo: string, observacao: string) => {
    if (!servico) return;
    try {
      setActionLoading(true);
      await recusarSolicitacaoMontador(servico.id, motivo, observacao || undefined);
      setRecusarOpen(false);
      reload();
      goToTab(navigation, "MontadorTabs", "MontadorSolicitacoes");
    } catch {
      Alert.alert("Erro", "Não foi possível recusar a solicitação.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <DScreen scroll backgroundColor={profileTheme.background} contentContainerStyle={styles.scroll}>
      <View style={styles.header}>
        <BackCircleButton onPress={() => navigation.goBack()} color={profileTheme.icon} borderColor={profileTheme.border} />
        <Text style={[styles.title, { color: profileTheme.textAccent }]}>Detalhe da solicitação</Text>
        {/* Espaçador: sem ele o título centraliza no espaço que sobra
            e fica deslocado para a direita. */}
        <View style={styles.headerSlot} />
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
            <Info label="Valor estimado" value={formatValorServico(servico.valorEstimado ?? servico.precoFinal)} />
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

          {conflitos.length > 0 ? (
            <View style={styles.conflitoCard}>
              <AppIcon name="Clock" size={18} color={colors.warning} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.conflitoTitulo}>
                  {conflitos.some((c) => c.tipo === "sobreposto")
                    ? "Você já tem serviço nesse horário"
                    : "Você termina outro serviço perto desse horário"}
                </Text>
                {conflitos.map((c) => (
                  <Text key={c.id} style={styles.bodyText}>
                    Serviço das {c.inicio}
                    {c.fimEstimado ? ` até ~${c.fimEstimado} (estimado)` : ""}.
                  </Text>
                ))}
                <Text style={styles.bodyText}>Você pode aceitar assim mesmo ou sugerir outro horário ao cliente.</Text>
              </View>
            </View>
          ) : null}

          {podeResponder && propostaPendente ? (
            <View style={styles.card}>
              <Text style={styles.bodyText}>Você sugeriu outro horário. Aguardando o cliente confirmar.</Text>
            </View>
          ) : null}

          {podeResponder ? (
            <View style={styles.actions}>
              <Pressable disabled={actionLoading} onPress={aceitar} style={[styles.primaryButton, { backgroundColor: profileTheme.primary }]}>
                <Text style={styles.primaryText}>{actionLoading ? "Processando" : "Aceitar"}</Text>
              </Pressable>
              <Pressable disabled={actionLoading} onPress={recusar} style={styles.rejectButton}>
                <Text style={styles.rejectText}>Recusar</Text>
              </Pressable>
            </View>
          ) : null}

          {podeResponder && !propostaPendente ? (
            <Pressable
              disabled={actionLoading}
              onPress={() => setPropostaOpen(true)}
              style={[styles.rejectButton, { flex: 0, borderColor: profileTheme.primary }]}
            >
              <Text style={[styles.rejectText, { color: profileTheme.primary }]}>Sugerir outro horário</Text>
            </Pressable>
          ) : null}
        </>
      )}
      <PropostaHorarioModal
        visible={propostaOpen}
        titulo="Sugerir outro horário"
        subtitulo="O cliente confirma ou recusa. Se recusar, o pedido continua aberto no horário original."
        accent={profileTheme.primary}
        border={profileTheme.border}
        enviando={propostaEnviando}
        onClose={() => setPropostaOpen(false)}
        onConfirm={(p) => { void enviarProposta(p); }}
      />
      <MotivoModal
        visible={recusarOpen}
        title="Recusar serviço"
        confirmLabel="Recusar"
        onClose={() => setRecusarOpen(false)}
        onConfirm={confirmarRecusa}
      />
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
  conflitoCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  conflitoTitulo: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  scroll: {
    gap: 14,
    paddingBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  /** Mesma largura do BackCircleButton, para centrar o título. */
  headerSlot: { width: 42, height: 42 },
  title: {
    // Título de tela secundária: h2 e cor de destaque do perfil. Antes cada
    // uma escolhia entre h2, h3, 24, 22, bodyMedium ou `title`, com texto
    // preto — seis tratamentos para a mesma função.
    ...typography.h2,
    flex: 1,
    fontWeight: "700",
    textAlign: "center",
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
  sectionTitle: {
    ...typography.bodySmMedium,
    color: colors.textPrimary,
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "700",
  },
});
