import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { api } from "@/lib/api";
import { fetchServicosMinhas } from "@/api/sharedFetcher";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import {
  aprovarServicoConcluido,
  cancelarServicoEmpregador,
  confirmarFinalizacaoEmpregador,
  decidirReagendamento,
} from "@/api/empregadorApi";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { MotivoModal } from "@/components/MotivoModal";
import { AvaliacaoModal, DAvatar } from "@/components/ui";
import { formatPrice } from "@/utils/formatPrice";
import { parseDataServico } from "@/utils/formatters";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// Data do serviço é meia-noite UTC — normaliza p/ não deslizar o dia (fuso).
const formatDate = (v: string | number | Date) =>
  parseDataServico(v)?.toLocaleDateString("pt-BR") ?? "--";
const statusUp = (s: any) => String(s ?? "").toUpperCase();

function fmtReagendamento(svc: Servico) {
  const d = svc.reagendamentoData ? new Date(svc.reagendamentoData) : null;
  const dataLabel =
    d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const t = statusUp(svc.reagendamentoTurno);
  const turnoLabel = t === "MANHA" ? "Manhã" : t === "TARDE" ? "Tarde" : "";
  return `${dataLabel}${turnoLabel ? " · " + turnoLabel : ""}`;
}
const FINAL = ["CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "PAGO", "AVALIADO"];
const POLL_MS = 5000;

function statusLabel(st: string) {
  const s = statusUp(st);
  if (s === "PENDENTE" || s === "SOLICITADO") return "Aguardando aceite";
  if (s === "ACEITO")       return "Aceito";
  if (s === "INICIADO" || s === "EM_ANDAMENTO") return "Em andamento";
  if (s === "AGUARDANDO_FINALIZACAO") return "Aguardando confirmação";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s)) return "Concluído";
  if (s === "CONFIRMADO")   return "Confirmado";
  if (s === "FINALIZADO")   return "Finalizado";
  if (s === "CANCELADO")    return "Cancelado";
  if (s === "RECUSADO")     return "Recusado";
  return st || "Status";
}

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = statusUp(st);
  if (["CONFIRMADO", "FINALIZADO"].includes(s))              return "success";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s))                return "warning";
  if (["ACEITO", "INICIADO", "EM_ANDAMENTO"].includes(s))    return "warning";
  if (["CANCELADO", "RECUSADO"].includes(s))                 return "danger";
  return "neutral";
}

// ── Rótulos do comprovante ────────────────────────────────────────────────────
const TIPO_LABEL: Record<string, string> = {
  FAXINA: "Diarista",
  BABA: "Babá",
  CUIDADORA: "Cuidadora",
  COZINHEIRA: "Cozinheira",
  PASSA_ROUPA: "Passadeira",
  LAVADEIRA: "Lavadeira",
  MONTADOR: "Montador",
};
function tipoLabel(t?: string | null) {
  return TIPO_LABEL[statusUp(t)] ?? "Serviço";
}
function categoriaLabelFmt(c?: string | null) {
  if (!c) return null;
  return String(c)
    .replace(/^MONTADOR_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (m) => m.toUpperCase());
}
function turnoLabel(t?: string | null) {
  const v = statusUp(t);
  return v === "MANHA" ? "Manhã" : v === "TARDE" ? "Tarde" : "A combinar";
}
function formatDateTime(v?: string | number | Date | null) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Linha rótulo → valor do comprovante.
function RowKV({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kvRow}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={s.kvValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function EmpregadorDetalhe({ route, navigation }: any) {
  const params = route.params as any;
  const servicoId: string = params.servicoId ?? params.servico?.id ?? "";

  const [svc, setSvc] = useState<Servico | null>(params.servico ?? null);
  const [loadingInit, setLoadingInit] = useState(!params.servico);
  const [confirming, setConfirming] = useState(false);
  // Persistido em state separado do `svc` para sobreviver ao refetch periódico
  // do /api/servicos/minhas — sem isso, o flag em `svc.__confirmedByClient`
  // é perdido quando o backend reenvia o objeto.
  const [confirmedByClient, setConfirmedByClient] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avaliacaoVisible, setAvaliacaoVisible] = useState(false);
  const [motivoVisible, setMotivoVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [decidindoReag, setDecidindoReag] = useState(false);
  const [finalizadoEm, setFinalizadoEm] = useState<string | null>(null);
  const busyRef = useRef(false);

  const fetchAtual = useCallback(async (silent = true) => {
    try {
      if (!silent) setRefreshing(true);
      const data = await fetchServicosMinhas();
      const found = Array.isArray(data?.servicos)
        ? data.servicos.find((s: Servico) => s.id === servicoId)
        : null;
      if (found) setSvc(found);
    } catch { /* silencioso */ } finally {
      if (!silent) setRefreshing(false);
    }
  }, [servicoId]);

  useEffect(() => {
    if (!params.servico && servicoId) {
      setLoadingInit(true);
      fetchAtual(true).finally(() => setLoadingInit(false));
    }
  }, [params.servico, servicoId, fetchAtual]);

  useEffect(() => { fetchAtual(); }, [fetchAtual]);

  // Data de finalização: vem do endpoint de detalhe ([id]) via último
  // ServicoEvento de finalização (sem migration). Apenas leitura para o comprovante.
  useEffect(() => {
    if (!servicoId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/servicos/${servicoId}`);
        const ev = (res.data?.servico?.eventos ?? [])[0];
        if (!cancelled && ev?.createdAt) setFinalizadoEm(ev.createdAt);
      } catch { /* silencioso — finalizadoEm fica null ("Não finalizado") */ }
    })();
    return () => { cancelled = true; };
  }, [servicoId]);

  useFocusEffect(useCallback(() => {
    fetchAtual();
    const t = setInterval(() => fetchAtual(), POLL_MS);
    return () => clearInterval(t);
  }, [fetchAtual]));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const statusRaw = useMemo(() => statusUp(svc?.status), [svc?.status]);
  const isFinal = useMemo(() => FINAL.includes(statusRaw), [statusRaw]);
  const alreadyConfirmed = useMemo(
    () => Boolean(confirmedByClient || (svc as any)?.__confirmedByClient || isFinal),
    [confirmedByClient, svc, isFinal]
  );
  const alreadyRated = useMemo(
    () => Boolean(
      (svc as any)?.__ratedByClient || (svc as any)?.avaliacaoCliente ||
      (svc as any)?.notaCliente || (svc as any)?.avaliacao ||
      statusRaw === "AVALIADO" || statusRaw === "FINALIZADO"
    ),
    [svc, statusRaw]
  );
  const podeConfirmar = useMemo(
    () => !alreadyConfirmed && ["CONCLUIDO", "CONCLUÍDO", "AGUARDANDO_FINALIZACAO"].includes(statusRaw),
    [alreadyConfirmed, statusRaw]
  );
  const aguardandoOutraParte = useMemo(
    () => statusRaw === "AGUARDANDO_FINALIZACAO",
    [statusRaw]
  );
  // CONCLUIDO = ambas as partes finalizaram; falta o empregador "confirmar
  // recebimento" (→ CONFIRMADO, libera avaliação). Muda o rótulo do botão.
  const confirmarRecebimento = useMemo(
    () => ["CONCLUIDO", "CONCLUÍDO"].includes(statusRaw),
    [statusRaw]
  );
  const podeCancelar = useMemo(
    () =>
      !isStatusEncerrado(statusRaw) &&
      ["PENDENTE", "SOLICITADO", "ACEITO"].includes(statusRaw),
    [statusRaw]
  );
  // Backend exige status CONFIRMADO para avaliar (CONCLUIDO precisa antes ser
  // aprovado via "Confirmar finalização" → CONFIRMADO). Não incluir CONCLUIDO
  // aqui evita oferecer "Avaliar" num estado que o backend rejeita (409).
  const podeAvaliar = useMemo(
    () => !alreadyRated && statusRaw === "CONFIRMADO",
    [alreadyRated, statusRaw]
  );

  // Auto-trigger do modal de avaliação ao detectar finalização confirmada pelos
  // dois lados. Só dispara uma vez por sessão (ref) — se o usuário fechar sem
  // avaliar, ele pode reabrir pelo botão "Avaliar".
  const avaliacaoAutoTriggeredRef = useRef(false);
  useEffect(() => {
    if (podeAvaliar && !avaliacaoAutoTriggeredRef.current) {
      avaliacaoAutoTriggeredRef.current = true;
      setAvaliacaoVisible(true);
    }
  }, [podeAvaliar]);
  // Chat disponível desde o aceite até a finalização (AGUARDANDO_FINALIZACAO).
  // A partir de CONCLUIDO o serviço encerra e o chat some (também em
  // CONFIRMADO/FINALIZADO/CANCELADO).
  const chatLiberado = useMemo(
    () => ["ACEITO", "INICIADO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"].includes(statusRaw),
    [statusRaw]
  );

  const onDecidirReagendamento = useCallback(
    async (aceitar: boolean) => {
      if (decidindoReag || !svc) return;
      setDecidindoReag(true);
      try {
        await decidirReagendamento(svc.id, aceitar);
        setSvc((cur) => {
          if (!cur) return cur;
          const limpo = {
            reagendamentoData: null,
            reagendamentoTurno: null,
            reagendamentoPor: null,
            reagendamentoEm: null,
          };
          return aceitar
            ? { ...cur, data: cur.reagendamentoData ?? cur.data, turno: (cur.reagendamentoTurno ?? cur.turno) as any, ...limpo }
            : { ...cur, ...limpo };
        });
        setToast(aceitar ? "Reagendamento confirmado." : "Reagendamento recusado.");
        void fetchAtual(true);
      } catch (e: any) {
        setToast(e?.response?.data?.error ?? "Falha ao responder o reagendamento.");
      } finally {
        setDecidindoReag(false);
      }
    },
    [decidindoReag, svc, fetchAtual],
  );

  const onConfirmar = useCallback(async () => {
    if (confirming || busyRef.current || !svc) return;
    busyRef.current = true;
    setConfirming(true);
    try {
      // Ciclo de finalização:
      //   EM_ANDAMENTO          →(confirmar-finalizacao)→ AGUARDANDO_FINALIZACAO
      //   AGUARDANDO_FINALIZACAO →(confirmar-finalizacao)→ CONCLUIDO
      //   CONCLUIDO             →(confirmar legado)→ CONFIRMADO (libera avaliação)
      // CONCLUIDO usa o endpoint /confirmar; os demais usam /confirmar-finalizacao.
      const isAprovacaoFinal = ["CONCLUIDO", "CONCLUÍDO"].includes(statusRaw);
      if (isAprovacaoFinal) {
        await aprovarServicoConcluido(svc.id);
      } else {
        await confirmarFinalizacaoEmpregador(svc.id);
      }
      const nextStatus = isAprovacaoFinal
        ? "CONFIRMADO"
        : statusRaw === "AGUARDANDO_FINALIZACAO"
          ? "CONCLUIDO"
          : "AGUARDANDO_FINALIZACAO";
      setSvc((cur) =>
        cur ? { ...cur, status: nextStatus as any, __confirmedByClient: true } : cur,
      );
      // Flag fora do svc — sobrevive ao refetch periódico (POLL_MS) que reescreve `svc`.
      setConfirmedByClient(true);
      setToast(
        nextStatus === "CONFIRMADO"
          ? "Serviço aprovado. Você já pode avaliar."
          : nextStatus === "CONCLUIDO"
            ? "Serviço finalizado."
            : "Confirmação enviada. Aguardando a outra parte.",
      );
    } catch (e: any) {
      // 409 = a outra parte já confirmou nesse meio tempo; sincroniza UI e segue.
      if (e?.response?.status === 409) {
        setConfirmedByClient(true);
        void fetchAtual(true);
      } else {
        setToast(e?.response?.data?.error ?? "Falha ao confirmar serviço.");
      }
    } finally {
      setConfirming(false);
      busyRef.current = false;
    }
  }, [confirming, svc, statusRaw, fetchAtual]);

  // No passo de liberação (CONCLUIDO → CONFIRMADO), pergunta sobre o PAGAMENTO
  // pela ótica do empregador (quem paga). O passo anterior (AGUARDANDO →
  // CONCLUIDO) apenas confirma que o profissional terminou, sem essa pergunta.
  const onConfirmarPressed = useCallback(() => {
    if (confirmarRecebimento) {
      Alert.alert("Pagamento", "Você já realizou o pagamento ao profissional?", [
        { text: "Ainda não", style: "cancel" },
        { text: "Sim, já paguei", onPress: () => { void onConfirmar(); } },
      ]);
      return;
    }
    void onConfirmar();
  }, [confirmarRecebimento, onConfirmar]);

  const onCancelarComMotivo = useCallback(
    async (motivo: string, observacao: string) => {
      if (!svc || busyRef.current) return;
      busyRef.current = true;
      setCancelling(true);
      try {
        await cancelarServicoEmpregador(svc.id, motivo, observacao || undefined);
        setSvc((cur) => (cur ? { ...cur, status: "CANCELADO" as any } : cur));
        setMotivoVisible(false);
        setToast("Serviço cancelado.");
      } catch (e: any) {
        setToast(e?.response?.data?.error ?? "Falha ao cancelar.");
      } finally {
        setCancelling(false);
        busyRef.current = false;
      }
    },
    [svc]
  );

  if (loadingInit || !svc) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <Text style={s.loading}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  const prof = svc.montador ?? svc.diarista ?? null;
  const avaliacao = (svc as {
    avaliacao?: {
      notaGeral: number;
      pontualidade: number;
      qualidade: number;
      comunicacao: number;
      comentario?: string | null;
    } | null;
  }).avaliacao ?? null;
  const profIniciais = (prof?.nome ?? "?").slice(0, 2).toUpperCase();
  const valorLabel = svc.precoFinal > 0 ? formatPrice(svc.precoFinal) : "A combinar";
  const finalizadoLabel = formatDateTime(finalizadoEm) ?? "Não finalizado";
  const categoria = categoriaLabelFmt(svc.categoria);

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Voltar — stack real (PR #103); goBack() volta à origem exata. */}
      <View style={s.topBar}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.primary} />
        </Pressable>
        <Text style={s.topBarTitle}>Comprovante</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAtual(false)} />}
        showsVerticalScrollIndicator={false}
      >
        {toast ? (
          <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
        ) : null}

        {/* CABEÇALHO — protocolo + status */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Protocolo</Text>
          <View style={s.protocoloRow}>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(svc.id);
                setToast("Protocolo copiado.");
              }}
              hitSlop={8}
              style={s.protocoloPress}
            >
              <Text style={s.protocolo}>#{svc.id.slice(0, 8).toUpperCase()}</Text>
              <Ionicons name="copy-outline" size={15} color={colors.sub} />
            </Pressable>
            <DularBadge text={statusLabel(svc.status)} variant={statusVariant(svc.status)} />
          </View>
        </View>

        {/* SERVIÇO */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Serviço</Text>
          <RowKV label="Tipo" value={tipoLabel(svc.tipo)} />
          {categoria ? (
            <>
              <View style={s.divider} />
              <RowKV label="Categoria" value={categoria} />
            </>
          ) : null}
          <View style={s.divider} />
          <RowKV label="Turno" value={turnoLabel(svc.turno)} />
        </View>

        {/* PROFISSIONAL */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Profissional</Text>
          <View style={s.profRow}>
            <DAvatar size="md" uri={prof?.avatarUrl ?? undefined} initials={profIniciais} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.profNome}>{prof?.nome ?? "Aguardando profissional"}</Text>
              {prof?.telefone ? <Text style={s.profTel}>{prof.telefone}</Text> : null}
            </View>
          </View>
        </View>

        {/* LOCAL */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Local</Text>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>{svc.bairro}, {svc.cidade} - {svc.uf}</Text>
          </View>
        </View>

        {/* DATAS */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Datas</Text>
          <RowKV label="Agendada" value={formatDate(svc.data)} />
          <View style={s.divider} />
          <RowKV label="Finalização" value={finalizadoLabel} />
        </View>

        {/* VALOR */}
        <View style={s.card}>
          <Text style={s.sectionLabel}>Valor</Text>
          <Text style={s.valor}>{valorLabel}</Text>
        </View>

        {/* AVALIAÇÃO (só se houver) */}
        {avaliacao ? (
          <View style={s.card}>
            <Text style={s.sectionLabel}>Avaliação</Text>
            <View style={s.infoRow}>
              <Ionicons name="star" size={16} color={colors.star} />
              <Text style={[s.infoText, { fontWeight: "700" }]}>{avaliacao.notaGeral}/5</Text>
            </View>
            {avaliacao.comentario ? <Text style={s.comentario}>“{avaliacao.comentario}”</Text> : null}
            <View style={s.divider} />
            <RowKV label="Pontualidade" value={`${avaliacao.pontualidade}/5`} />
            <RowKV label="Qualidade" value={`${avaliacao.qualidade}/5`} />
            <RowKV label="Comunicação" value={`${avaliacao.comunicacao}/5`} />
          </View>
        ) : null}

        {/* Status CTA cards */}
        {["PENDENTE", "SOLICITADO"].includes(statusRaw) ? (
          <View style={s.infoBar}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={s.infoBarText}>Aguardando a diarista aceitar sua solicitação.</Text>
          </View>
        ) : null}

        {statusRaw === "ACEITO" ? (
          <View style={s.infoBar}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            <Text style={s.infoBarText}>Sua solicitação foi aceita. A diarista está a caminho.</Text>
          </View>
        ) : null}

        {["INICIADO", "EM_ANDAMENTO"].includes(statusRaw) ? (
          <View style={[s.infoBar, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="time" size={16} color={colors.warning} />
            <Text style={[s.infoBarText, { color: colors.ink }]}>
              Serviço em andamento. Aguarde a conclusão para confirmar.
            </Text>
          </View>
        ) : null}

        {aguardandoOutraParte ? (
          <View style={[s.infoBar, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
            <Text style={[s.infoBarText, { color: colors.ink }]}>
              Aguardando confirmação da outra parte.
            </Text>
          </View>
        ) : null}

        {statusRaw === "CONFIRMADO" ? (
          <View style={s.successBar}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={s.successBarText}>Pagamento liberado ✓</Text>
          </View>
        ) : null}

        {["CANCELADO", "RECUSADO"].includes(statusRaw) ? (
          <View style={[s.infoBar, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={[s.infoBarText, { color: colors.danger }]}>
              {statusRaw === "CANCELADO" ? "Serviço cancelado." : "Serviço recusado."}
            </Text>
          </View>
        ) : null}

        {/* Proposta de reagendamento (pendente) */}
        {svc.reagendamentoData && !isStatusEncerrado(statusRaw) ? (
          <View style={s.card}>
            <View style={s.infoRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.warning} />
              <Text style={[s.infoText, { fontWeight: "700", color: colors.ink }]}>Proposta de reagendamento</Text>
            </View>
            <Text style={[s.infoText, { marginTop: 4 }]}>
              O profissional propôs uma nova data: {fmtReagendamento(svc)}
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <DButton
                  title={decidindoReag ? "..." : "Recusar"}
                  variant="outline"
                  onPress={() => onDecidirReagendamento(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <DButton
                  title={decidindoReag ? "..." : "Confirmar"}
                  onPress={() => onDecidirReagendamento(true)}
                />
              </View>
            </View>
          </View>
        ) : null}

        {/* Chat */}
        {chatLiberado ? (
          <DButton
            title="Abrir chat"
            variant="outline"
            onPress={() =>
              navigation.navigate("ChatAberto", {
                roomId: svc.id,
                servicoId: svc.id,
                nomeUsuario: svc.diarista?.nome ?? svc.montador?.nome ?? "Conversa",
              })
            }
          />
        ) : null}

        {/* Confirmação do empregador. Em AGUARDANDO_FINALIZACAO o profissional
            já finalizou → "Confirmar finalização" (→ CONCLUIDO). Em CONCLUIDO
            falta liberar a avaliação → "Confirmar recebimento" (→ CONFIRMADO).
            Em EM_ANDAMENTO o empregador só acompanha (sem botão). */}
        {podeConfirmar ? (
          <DButton
            title={
              confirming
                ? "Confirmando..."
                : confirmarRecebimento
                  ? "Confirmar pagamento"
                  : "Confirmar finalização"
            }
            onPress={onConfirmarPressed}
            loading={confirming}
            disabled={confirming}
          />
        ) : null}

        {/* Avaliar */}
        {podeAvaliar ? (
          <DButton
            title="Avaliar serviço"
            onPress={() => setAvaliacaoVisible(true)}
          />
        ) : null}

        {/* Já avaliado */}
        {!podeAvaliar && alreadyRated ? (
          <View style={s.doneCard}>
            <Ionicons name="star" size={18} color={colors.star} />
            <Text style={s.doneText}>Você já avaliou este serviço. Obrigado!</Text>
          </View>
        ) : null}

        {/* Cancelar */}
        {podeCancelar ? (
          <Pressable
            onPress={() => setMotivoVisible(true)}
            disabled={cancelling}
            style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.cancelText}>{cancelling ? "Cancelando..." : "Cancelar serviço"}</Text>
          </Pressable>
        ) : null}

        {/* RODAPÉ */}
        <Text style={s.rodape}>Guarde este protocolo para suporte: {svc.id}</Text>
      </ScrollView>

      <MotivoModal
        visible={motivoVisible}
        title="Cancelar serviço"
        confirmLabel="Cancelar serviço"
        onClose={() => setMotivoVisible(false)}
        onConfirm={onCancelarComMotivo}
      />

      <AvaliacaoModal
        visible={avaliacaoVisible}
        servicoId={svc.id}
        nomeAvaliado={svc.diarista?.nome ?? "Diarista"}
        onClose={() => setAvaliacaoVisible(false)}
        onSucesso={() => {
          setAvaliacaoVisible(false);
          setSvc((cur) => cur ? { ...cur, __ratedByClient: true } as any : cur);
          setToast("Avaliação enviada. Obrigado!");
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { padding: spacing.screenPadding, gap: 12, paddingBottom: 48 },
  loading: { ...typography.sub, textAlign: "center", marginTop: 48 },

  // ── Comprovante
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
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
  topBarTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  section: { gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.sub,
  },
  protocoloRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  protocoloPress: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  protocolo: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    color: colors.ink,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  kvLabel: { fontSize: 12, fontWeight: "600", color: colors.sub },
  kvValue: { fontSize: 14, fontWeight: "700", color: colors.ink, flexShrink: 1, textAlign: "right" },
  profRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  profNome: { fontSize: 15, fontWeight: "700", color: colors.ink },
  profTel: { fontSize: 13, fontWeight: "500", color: colors.sub },
  valor: { fontSize: 20, fontWeight: "800", color: colors.greenDark },
  comentario: { fontSize: 13, fontWeight: "500", color: colors.ink, fontStyle: "italic" },
  rodape: { fontSize: 11, fontWeight: "500", color: colors.sub, textAlign: "center", marginTop: 6 },

  toast: {
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  toastText: { color: colors.white, fontWeight: "700", fontSize: 13 },

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
    gap: 9,
    ...shadow.card,
  },
  infoRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 13, fontWeight: "500", color: colors.ink, flex: 1 },
  divider:  { height: 1, backgroundColor: colors.stroke },

  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderSoft,
  },
  infoBarText: { fontSize: 12, fontWeight: "500", color: colors.ink, flex: 1 },

  successBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  successBarText: { fontSize: 12, fontWeight: "700", color: colors.success, flex: 1 },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  doneText: { fontSize: 12, fontWeight: "700", color: colors.greenDark },

  cancelBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.btn,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
  },
});
