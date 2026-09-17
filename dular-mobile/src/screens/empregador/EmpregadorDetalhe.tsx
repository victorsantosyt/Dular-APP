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

import { fetchServicosMinhas } from "@/api/sharedFetcher";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import {
  aprovarServicoConcluido,
  cancelarServicoEmpregador,
  confirmarFinalizacaoEmpregador,
  decidirReagendamento,
} from "@/api/empregadorApi";
import { DButton } from "@/components/DButton";
import { MotivoModal } from "@/components/MotivoModal";
import { AvaliacaoModal, BackCircleButton } from "@/components/ui";
import { pedirAvaliacaoDaLoja } from "@/lib/avaliacaoDaLoja";
import { formatHorario } from "@/utils/formatters";
import { isStatusEncerrado } from "@/utils/servicoStatus";
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import {
  BotaoCompartilharComprovante,
  ComprovanteServico,
  useComprovante,
} from "@/components/comprovante/ComprovanteServico";

// Data do serviço é meia-noite UTC — normaliza p/ não deslizar o dia (fuso).
const statusUp = (s: any) => String(s ?? "").toUpperCase();

function fmtReagendamento(svc: Servico) {
  const d = svc.reagendamentoData ? new Date(svc.reagendamentoData) : null;
  const dataLabel =
    d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  const horario = formatHorario(svc.reagendamentoHora, svc.reagendamentoTurno);
  return `${dataLabel}${horario && horario !== "--" ? " · " + horario : ""}`;
}
const FINAL = ["CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "PAGO", "AVALIADO"];
const POLL_MS = 5000;

// ── Rótulos do comprovante ────────────────────────────────────────────────────
/** O que foi contratado além do tipo — é o que justifica o valor. */
// Linha rótulo → valor do comprovante.
export default function EmpregadorDetalhe({ route, navigation }: any) {
  // Cor do voltar seguindo o perfil, como nas demais telas.
  const theme = useGenderTheme();
  const params = route.params as any;
  const servicoId: string = params.servicoId ?? params.servico?.id ?? "";

  const [svc, setSvc] = useState<Servico | null>(params.servico ?? null);
  const comprovante = useComprovante(svc as never, "contratante", (t) => setToast(t));
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

  // Protocolo que o usuário vê e copia. O rodapé mostrava o id cru do banco
  // (cuid) logo abaixo deste — dois "protocolos" diferentes para o mesmo
  // serviço, e o suporte recebia ora um, ora outro.

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

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Voltar — stack real (PR #103); goBack() volta à origem exata. */}
      <View style={s.topBar}>
        <BackCircleButton onPress={() => navigation.goBack()} color={theme.icon} borderColor={theme.border} />
        <Text style={[s.topBarTitle, { color: theme.textAccent }]}>Comprovante</Text>
        {/* Compartilhar na linha do voltar e do título, como nas demais telas
            do app. Ocupa o lugar do espaçador, então o título segue centrado. */}
        <BotaoCompartilharComprovante comprovante={comprovante} theme={theme} />
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

        {/* O comprovante é o MESMO componente dos três perfis. Estava
            escrito aqui dentro e só existia neste; a diarista e o montador
            ficaram sem nenhum até agora. As barras de status e as ações
            abaixo continuam próprias desta tela. */}
        <ComprovanteServico
          comprovante={comprovante}
          servico={svc as never}
          theme={theme}
          avatarUrl={prof?.avatarUrl}
          onAviso={setToast}
        />

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
        onSucesso={(nota) => {
          setAvaliacaoVisible(false);
          setSvc((cur) => cur ? { ...cur, __ratedByClient: true } as any : cur);
          setToast("Avaliação enviada. Obrigado!");
          // Momento de sucesso comprovado: serviço concluído, confirmado e bem
          // avaliado. É daqui que o pedido de nota na loja pode partir — e só
          // daqui, porque ele nunca pode ser um botão. A função decide sozinha
          // se é hora; com nota baixa ela nem chega a consultar a loja.
          void pedirAvaliacaoDaLoja(nota);
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
  topBarSpacer: { width: 42, height: 42 },
  /** Mesma largura do BackCircleButton, para centrar o título. */
  headerSlot: { width: 42, height: 42 },
  topBarTitle: {
    // Era `fontSize: 15` — do tamanho de um rótulo, não de um título de
    // tela. Passa ao mesmo h2 dos outros cabeçalhos do app.
    ...typography.h2,
    color: colors.ink,
    flex: 1,
    textAlign: "center",
  },
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
  // Cor entra pelo tema no componente.
  valor: { fontSize: 20, fontWeight: "800" },
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
  /** Segunda linha do endereço: presente só quando há o endereço completo. */
  infoTextSub: { fontSize: 12, fontWeight: "500", color: colors.sub },
  /** Rótulo do papel da parte ("Profissional", "Contratante"). */
  compartilharBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  parteFuncao: { fontSize: 11, fontWeight: "700", color: colors.sub, textTransform: "uppercase", letterSpacing: 0.4 },
  obsLabel: { fontSize: 12, fontWeight: "700", color: colors.sub },
  obsTexto: { fontSize: 13, fontWeight: "500", color: colors.ink, lineHeight: 19 },
  /** Valor + linha do tempo do pagamento. */
  pagamentoTopo: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  pagamentoForma: { fontSize: 12, fontWeight: "700", color: colors.sub },
  emissao: { fontSize: 11, fontWeight: "500", color: colors.sub, textAlign: "center", marginTop: 2 },
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
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  doneText: { fontSize: 12, fontWeight: "700", color: colors.success },

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
