/**
 * DiaristaDetalhe — Detalhe de serviço para a diarista
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Lógica de ações (aceitar/iniciar/concluir) preservada.
 */

import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { api } from "@/lib/api";
import { fetchServicosMinhas, fetchUserScore } from "@/api/sharedFetcher";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import {
  cancelarServicoDiarista,
  confirmarFinalizacaoDiarista,
  recusarServicoDiarista,
} from "@/api/diaristaApi";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { MotivoModal } from "@/components/MotivoModal";
import { SafeScoreBadge } from "@/components/SafeScoreBadge";
import { AvaliacaoModal } from "@/components/ui";
import { useSeguranca } from "@/hooks/useSeguranca";
import { formatPrice } from "@/utils/formatPrice";
import { isStatusEncerrado } from "@/utils/servicoStatus";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = (st || "").toUpperCase();
  if (["FINALIZADO", "CONCLUIDO", "CONCLUÍDO", "CONFIRMADO"].includes(s)) return "success";
  if (["ACEITO", "EM_ANDAMENTO"].includes(s)) return "warning";
  if (["CANCELADO", "CANCELADA", "RECUSADO"].includes(s)) return "danger";
  return "neutral";
}

function statusLabel(st: string) {
  const s = (st || "").toUpperCase();
  if (s === "SOLICITADO")   return "Aguardando aceite";
  if (s === "ACEITO")       return "Aceito";
  if (s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "AGUARDANDO_FINALIZACAO") return "Aguardando confirmação";
  if (s === "CONCLUIDO" || s === "CONCLUÍDO") return "Concluído";
  if (s === "CONFIRMADO")   return "Confirmado";
  if (s === "FINALIZADO")   return "Finalizado";
  if (s === "CANCELADO")    return "Cancelado";
  if (s === "RECUSADO")     return "Recusado";
  return st || "Status";
}

function getServicoEndereco(servico: Servico | null | undefined) {
  const endereco = servico?.enderecoCompleto ?? null;
  return typeof endereco === "string" && endereco.trim() ? endereco.trim() : null;
}

// Rótulos do tipo/categoria do serviço — para a profissional saber o que foi
// contratado (ex.: "Limpeza pesada"). Prioriza a categoria/intensidade.
const TIPO_LABEL_DET: Record<string, string> = {
  FAXINA: "Limpeza",
  BABA: "Babá",
  COZINHEIRA: "Cozinheira",
  PASSA_ROUPA: "Passar roupa",
  CUIDADORA: "Cuidadora",
  LAVADEIRA: "Lavadeira",
  MONTADOR: "Montador",
};
const CATEGORIA_LABEL_DET: Record<string, string> = {
  FAXINA_LEVE: "Limpeza leve",
  FAXINA_COMPLETA: "Limpeza completa",
  FAXINA_PESADA: "Limpeza pesada",
  BABA_DIURNA: "Babá diurna",
  BABA_NOTURNA: "Babá noturna",
  BABA_INTEGRAL: "Babá integral",
  COZINHEIRA_DIARIA: "Cozinha diária",
  COZINHEIRA_EVENTO: "Cozinha para evento",
  PASSA_ROUPA_BASICO: "Passar roupa — básico",
  PASSA_ROUPA_COMPLETO: "Passar roupa — completo",
};
function servicoLabelDetalhe(s: Servico): string {
  if (s.categoria && CATEGORIA_LABEL_DET[s.categoria]) return CATEGORIA_LABEL_DET[s.categoria];
  return TIPO_LABEL_DET[s.tipo] ?? s.tipo;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function DiaristaDetalhe({ route, navigation }: any) {
  const theme = useGenderTheme("DIARISTA");
  const params = route.params as any;
  const [svc, setSvc] = useState<Servico | null>(params.servico ?? null);
  const [loadingInit, setLoadingInit] = useState(!params.servico);
  // Aceita tanto { servicoId } quanto { id } (o card da Agenda navega com `id`).
  const servicoId: string = params.servicoId ?? params.id ?? params.servico?.id ?? "";
  const [loading, setLoading] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [avaliarOpen, setAvaliarOpen] = useState(false);
  // Flag local otimista: cobre a janela entre enviar a avaliação e o refetch
  // da lista trazer `avaliacaoEmpregador`.
  const [avaliouLocal, setAvaliouLocal] = useState(false);
  const [clienteScore, setClienteScore] = useState<{
    faixa: string;
    cor: string;
    bloqueado: boolean;
    totalServicos: number;
    verificado: boolean;
  } | null>(null);

  // Check-in real de segurança (mesmo hook do montador): POST /api/seguranca/checkin.
  const { checkInRealizado, checkInLoading, fazerCheckIn } = useSeguranca();
  const checkinAlertRef = useRef(false);
  useEffect(() => {
    if (checkInRealizado && !checkinAlertRef.current) {
      checkinAlertRef.current = true;
      Alert.alert("Check-in realizado", "Seu check-in de segurança foi registrado.");
    }
  }, [checkInRealizado]);

  async function reloadFromList() {
    try {
      const data = await fetchServicosMinhas();
      const found = data?.servicos?.find((s: Servico) => s.id === servicoId);
      if (found) setSvc(found);
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (!params.servico && servicoId) {
      setLoadingInit(true);
      reloadFromList().finally(() => setLoadingInit(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(name: string, body?: unknown) {
    if (!svc) return;
    try {
      setLoading(true);
      const res     = await api.post(`/api/servicos/${svc.id}/${name}`, body ?? {});
      const updated = res.data?.servico ?? res.data;
      if (updated?.id) setSvc(updated);
      else await reloadFromList();
      Alert.alert("Sucesso", `Ação "${name}" executada com sucesso.`);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message);
    } finally {
      setLoading(false);
    }
  }

  function recusarServico() {
    if (!svc) return;
    setRecusarOpen(true);
  }

  async function confirmarRecusa(motivo: string, observacao: string) {
    if (!svc) return;
    try {
      setLoading(true);
      await recusarServicoDiarista(svc.id, motivo, observacao || undefined);
      setRecusarOpen(false);
      await reloadFromList();
      Alert.alert("Sucesso", "Serviço recusado.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao recusar.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCancelamento(motivo: string, observacao: string) {
    if (!svc) return;
    try {
      setLoading(true);
      await cancelarServicoDiarista(svc.id, motivo, observacao || undefined);
      setCancelOpen(false);
      await reloadFromList();
      Alert.alert("Sucesso", "Serviço cancelado.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao cancelar.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarFinalizacao() {
    if (!svc) return;
    try {
      setLoading(true);
      await confirmarFinalizacaoDiarista(svc.id);
      await reloadFromList();
      Alert.alert("Sucesso", "Finalização confirmada.");
    } catch (e: any) {
      // Fallback: backend pode aceitar apenas "concluir"
      try {
        await action("concluir");
      } catch {
        Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao confirmar.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!svc?.cliente?.id) return;
    let alive = true;
    fetchUserScore(svc.cliente.id)
      .then((data) => {
        if (alive) setClienteScore(data);
      })
      .catch(() => {
        if (alive) setClienteScore(null);
      });
    return () => {
      alive = false;
    };
  }, [svc?.cliente?.id]);

  function confirmarAceite() {
    const endereco = getServicoEndereco(svc);
    const body = endereco ? { enderecoCompleto: endereco } : {};

    if (!endereco) {
      Alert.alert(
        "Endereço não informado",
        "Endereço não informado pelo cliente. Confirma mesmo assim?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar", onPress: () => { void action("aceitar", body); } },
        ]
      );
      return;
    }

    void action("aceitar", body);
  }

  function aceitarServico() {
    if (clienteScore?.bloqueado) {
      Alert.alert(
        "Atenção",
        "Atenção: este cliente está com restrições ativas. Deseja continuar?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar", onPress: confirmarAceite },
        ]
      );
      return;
    }

    confirmarAceite();
  }

  if (loadingInit) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Text style={{ ...typography.sub, textAlign: "center", marginTop: 48 }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  // Carregou mas não achou o serviço → estado claro (não fica "Carregando…" eterno).
  if (!svc) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
          <Text style={{ ...typography.sub, textAlign: "center" }}>
            Não foi possível carregar este serviço. Volte e tente novamente.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1.4,
              borderColor: theme.primary,
            }}
          >
            <Text style={{ ...typography.bodySmMedium, color: theme.primary, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Após o serviço liberar (CONFIRMADO) ou finalizar (FINALIZADO), a diarista
  // avalia o empregador. `avaliacaoEmpregador` vem de /api/servicos/minhas.
  const jaAvaliouEmpregador = avaliouLocal || Boolean((svc as any)?.avaliacaoEmpregador);

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Voltar ── */}
        <View style={s.navRow}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.ink} />
          </Pressable>
        </View>

        {/* ── Título + status ── */}
        <View style={s.titleRow}>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(`#${svc.id.slice(0, 6).toUpperCase()}`);
              Alert.alert("Copiado", "Número do serviço copiado.");
            }}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
          >
            <Text style={s.title}>Serviço #{svc.id.slice(0, 6).toUpperCase()}</Text>
            <Ionicons name="copy-outline" size={16} color={colors.sub} />
          </Pressable>
          <DularBadge text={statusLabel(svc.status)} variant={statusVariant(svc.status)} />
        </View>

        {/* ── Info card ── */}
        <View style={s.card}>
          <InfoRow icon="briefcase-outline" label="Serviço">
            <Text style={s.infoValue}>{servicoLabelDetalhe(svc)}</Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="location-outline" label="Local">
            <Text style={s.infoValue}>{svc.bairro} — {svc.cidade}/{svc.uf}</Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="cash-outline" label="Valor">
            <Text style={[s.infoValue, { color: colors.greenDark, fontWeight: "700" }]}>
              {formatPrice(svc.precoFinal)}
            </Text>
          </InfoRow>

          <View style={s.divider} />

          <InfoRow icon="person-outline" label="Cliente">
            <Text style={s.infoValue}>{svc.cliente?.nome ?? "—"}</Text>
          </InfoRow>

          {clienteScore ? (
            <>
              <View style={s.divider} />
              <SafeScoreBadge {...clienteScore} />
              {clienteScore.bloqueado ? (
                <View style={s.restrictedBox}>
                  <Text style={s.restrictedText}>
                    Este usuário está com acesso restrito na plataforma
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {getServicoEndereco(svc) ? (
            <>
              <View style={s.divider} />
              <InfoRow icon="home-outline" label="Endereço">
                <Text style={s.infoValue}>{getServicoEndereco(svc)}</Text>
              </InfoRow>
            </>
          ) : svc.status === "SOLICITADO" ? (
            <>
              <View style={s.divider} />
              <View style={s.addressHint}>
                <Ionicons name="lock-closed" size={14} color={colors.sub} />
                <Text style={s.addressHintText}>
                  Endereço não informado pelo cliente.
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* ── CTAs ── */}
        <View style={s.ctaBlock}>
          {svc.status === "SOLICITADO" && (
            <>
              <DButton tint={theme.primary}
                title="Aceitar serviço"
                loading={loading}
                onPress={aceitarServico}
              />
              <DButton tint={theme.primary}
                title="Recusar serviço"
                variant="outline"
                onPress={recusarServico}
              />
            </>
          )}
          {/* Chat disponível do aceite até a finalização (AGUARDANDO_FINALIZACAO).
               A partir de CONCLUIDO/CONFIRMADO/FINALIZADO o serviço encerra e o
               chat some (alinhado ao comprovante do empregador). */}
          {["ACEITO", "INICIADO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"].includes(svc.status.toUpperCase()) && (
            <DButton tint={theme.primary}
              title="Abrir chat"
              variant="outline"
              onPress={() => navigation.navigate("ChatAberto", {
                roomId: svc.id,
                servicoId: svc.id,
                nomeUsuario: svc.cliente?.nome ?? "Conversa",
              })}
            />
          )}
          {["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(svc.status.toUpperCase()) &&
            !isStatusEncerrado(svc.status) && (
            <>
              <DButton tint={theme.primary}
                title={
                  checkInLoading
                    ? "Registrando check-in…"
                    : checkInRealizado
                      ? "Check-in realizado"
                      : "Fazer check-in"
                }
                variant="outline"
                loading={checkInLoading}
                disabled={checkInRealizado}
                onPress={() => { void fazerCheckIn(svc.id); }}
              />
              <DButton tint={colors.warning}
                title="Reportar problema"
                variant="outline"
                onPress={() => navigation.navigate("ReportIncident", { servicoId: svc.id })}
              />
            </>
          )}
          {svc.status === "ACEITO" && !isStatusEncerrado(svc.status) && (
            <>
              <DButton tint={theme.primary}
                title="Iniciar serviço"
                loading={loading}
                onPress={() => { void action("iniciar"); }}
              />
              <DButton tint={colors.danger}
                title="Cancelar serviço"
                variant="outline"
                onPress={() => setCancelOpen(true)}
              />
            </>
          )}
          {/* Modelo profissional-finaliza-primeiro: a diarista finaliza em
              EM_ANDAMENTO (→ AGUARDANDO_FINALIZACAO) e o empregador confirma
              depois. Em AGUARDANDO ela apenas espera (botão desabilitado). */}
          {["INICIADO", "EM_ANDAMENTO"].includes(svc.status.toUpperCase()) && !isStatusEncerrado(svc.status) && (
            <DButton tint={theme.primary}
              title="Finalizar serviço"
              loading={loading}
              onPress={() =>
                Alert.alert("Pagamento", "Você já recebeu o pagamento?", [
                  { text: "Ainda não", style: "cancel" },
                  { text: "Sim, já recebi", onPress: () => { void confirmarFinalizacao(); } },
                ])
              }
            />
          )}
          {svc.status.toUpperCase() === "AGUARDANDO_FINALIZACAO" && (
            <>
              <DButton tint={theme.primary}
                title="Aguardando confirmação"
                disabled
                onPress={() => {}}
              />
              <View style={s.waitingCard}>
                <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
                <Text style={s.waitingText}>
                  Você finalizou o serviço. Aguardando o cliente confirmar para concluir.
                </Text>
              </View>
            </>
          )}
          {/* CONFIRMADO (pagamento liberado) e FINALIZADO (empregador já
              avaliou) liberam a avaliação da diarista → empregador. */}
          {["CONFIRMADO", "FINALIZADO"].includes(svc.status.toUpperCase()) &&
            (jaAvaliouEmpregador ? (
              <View style={s.doneCard}>
                <Ionicons name="checkmark-circle" size={24} color={colors.green} />
                <Text style={s.doneText}>Avaliação enviada. Obrigada!</Text>
              </View>
            ) : (
              <>
                <View style={s.paidCard}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={s.paidText}>Pagamento liberado ✓</Text>
                </View>
                <DButton tint={theme.primary}
                  title="Avaliar empregador"
                  onPress={() => setAvaliarOpen(true)}
                />
              </>
            ))}
          {["CONCLUIDO","CONCLUÍDO"].includes(svc.status.toUpperCase()) && (
            <View style={s.doneCard}>
              <Ionicons name="checkmark-circle" size={24} color={colors.green} />
              <Text style={s.doneText}>Serviço finalizado. Obrigada!</Text>
            </View>
          )}
          {["CANCELADO", "RECUSADO"].includes(svc.status.toUpperCase()) && (
            <View style={s.cancelledCard}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
              <Text style={s.cancelledText}>
                {svc.status.toUpperCase() === "CANCELADO" ? "Serviço cancelado." : "Serviço recusado."}
              </Text>
            </View>
          )}
        </View>

      </ScrollView>

      <MotivoModal
        visible={recusarOpen}
        title="Recusar serviço"
        confirmLabel="Recusar"
        onClose={() => setRecusarOpen(false)}
        onConfirm={confirmarRecusa}
      />

      <MotivoModal
        visible={cancelOpen}
        title="Cancelar serviço"
        confirmLabel="Cancelar serviço"
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmarCancelamento}
      />

      <AvaliacaoModal
        visible={avaliarOpen}
        servicoId={svc.id}
        nomeAvaliado={svc.cliente?.nome ?? "Empregador"}
        endpoint={`/api/servicos/${svc.id}/avaliar-empregador`}
        accent={theme.primary}
        onClose={() => setAvaliarOpen(false)}
        onSucesso={() => {
          setAvaliarOpen(false);
          setAvaliouLocal(true);
          void reloadFromList();
          Alert.alert("Avaliação enviada", "Obrigada por avaliar o empregador.");
        }}
      />
    </SafeAreaView>
  );
}

// ── InfoRow helper ─────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  children: React.ReactNode;
}) {
  // Acento decorativo segue o gênero do usuário (rosa/verde teal), não verde fixo.
  const theme = useGenderTheme("DIARISTA");
  return (
    <View style={ir.row}>
      <View style={[ir.iconWrap, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name={icon} size={16} color={theme.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ir.label}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const ir = StyleSheet.create({
  row:     { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  iconWrap:{
    width: 32, height: 32, borderRadius: radius.sm,
    backgroundColor: colors.greenLight,
    alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  label: { ...typography.sub, marginBottom: 2 },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
    gap: 16,
  },

  navRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "700",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 12,
    gap: 10,
    ...shadow.card,
  },
  infoValue: { fontSize: 13, fontWeight: "500", color: colors.ink },
  divider:   { height: 1, backgroundColor: colors.stroke },

  addressHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.cardStrong,
  },
  addressHintText: { ...typography.sub, flex: 1 },
  restrictedBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
    padding: 10,
  },
  restrictedText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  ctaBlock: { gap: 10 },

  paidCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  paidText: { fontSize: 12, fontWeight: "700", color: colors.success },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
  },
  doneText: { fontSize: 12, fontWeight: "700", color: colors.greenDark },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  waitingText: { fontSize: 12, fontWeight: "700", color: colors.warning, flex: 1 },
  cancelledCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  cancelledText: { fontSize: 12, fontWeight: "700", color: colors.danger, flex: 1 },
});
