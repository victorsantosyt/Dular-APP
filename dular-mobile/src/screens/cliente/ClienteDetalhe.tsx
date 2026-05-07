/**
 * ClienteDetalhe — Detalhe de serviço para o cliente
 *
 * Identidade visual 100% aplicada com tokens Dular validados.
 * Lógica de polling, confirmação, avaliação e contato preservada.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/lib/api";
import type { ServicoListItem as Servico } from "../../../../shared/types/servico";
import { DInput } from "@/components/DInput";
import { DButton } from "@/components/DButton";
import { DularBadge } from "@/components/DularBadge";
import { formatPrice } from "@/utils/formatPrice";
import { CLIENTE_STACK_ROUTES } from "@/navigation/routes";

// ── Tokens ──────────────────────────────────────────────────────────────────
import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (v: string | number | Date) => new Date(v).toLocaleDateString("pt-BR");
const statusUp   = (s: any) => String(s ?? "").toUpperCase();
const FINAL      = ["CONFIRMADO","FINALIZADO","FINALIZADO_CLIENTE","PAGO","AVALIADO"];
const POLL_MS    = 5000;

function statusLabel(st: string) {
  const s = statusUp(st);
  if (s === "ACEITO")        return "Aceito";
  if (s === "EM_ANDAMENTO")  return "Em andamento";
  if (["CONCLUIDO","CONCLUÍDO"].includes(s)) return "Concluído — aguardando confirmação";
  if (s === "CONFIRMADO")    return "Confirmado";
  if (s === "FINALIZADO")    return "Finalizado";
  return st || "Status";
}

function statusVariant(st: string): "success" | "warning" | "neutral" | "danger" {
  const s = statusUp(st);
  if (["CONCLUIDO","CONCLUÍDO","CONFIRMADO","FINALIZADO"].includes(s)) return "success";
  if (["ACEITO","EM_ANDAMENTO"].includes(s)) return "warning";
  return "neutral";
}

// ── RatingRow ─────────────────────────────────────────────────────────────────

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={r.wrap}>
      <Text style={r.label}>{label}</Text>
      <View style={r.stars}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (value ?? 0) >= n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => onChange(n)}
              style={[r.star, active && r.starOn]}
            >
              <Ionicons
                name={active ? "star" : "star-outline"}
                size={20}
                color={active ? colors.star : colors.sub}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const r = StyleSheet.create({
  wrap:  { gap: 4 },
  label: { ...typography.sub },
  stars: { flexDirection: "row", gap: 6 },
  star:  { padding: 4 },
  starOn:{},
});

// ── Componente ────────────────────────────────────────────────────────────────

export default function ClienteDetalhe({ route, navigation }: any) {
  const { servico }   = route.params as { servico: Servico };
  const [svc, setSvc] = useState<Servico>(servico);
  const insets        = useSafeAreaInsets();
  const busyRef       = useRef(false);

  const [notaGeral,    setNotaGeral]    = useState(5);
  const [pontualidade, setPontualidade] = useState<number | null>(null);
  const [qualidade,    setQualidade]    = useState<number | null>(null);
  const [comunicacao,  setComunicacao]  = useState<number | null>(null);
  const [comentario,   setComentario]   = useState("Serviço ok.");
  const [loading,      setLoading]      = useState(false);
  const [confirming,   setConfirming]   = useState(false);
  const [rating,       setRating]       = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [toast,        setToast]        = useState<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const statusRaw = useMemo(() => statusUp(svc?.status), [svc?.status]);
  const isFinal   = useMemo(() => FINAL.includes(statusRaw), [statusRaw]);

  const alreadyConfirmed = useMemo(
    () => Boolean((svc as any)?.__confirmedByClient || (svc as any)?.finishedAt || (svc as any)?.finalizadoEm || isFinal),
    [svc, isFinal]
  );
  const alreadyRated = useMemo(
    () => Boolean(
      (svc as any)?.__ratedByClient || (svc as any)?.avaliacaoCliente ||
      (svc as any)?.notaCliente     || (svc as any)?.avaliadoEm ||
      (svc as any)?.ratingCliente   || (svc as any)?.reviewCliente ||
      statusRaw === "AVALIADO"
    ),
    [svc, statusRaw]
  );
  const podeConfirmar = useMemo(
    () => !alreadyConfirmed && ["ACEITO","EM_ANDAMENTO","ANDAMENTO","AGUARDANDO_CONFIRMACAO","AGUARDANDO_CONFIRMAÇÃO","CONCLUIDO","CONCLUÍDO"].includes(statusRaw),
    [alreadyConfirmed, statusRaw]
  );
  const podeAvaliar = useMemo(() => !alreadyRated && statusRaw === "CONFIRMADO", [alreadyRated, statusRaw]);
  const contatoLiberado = useMemo(() => svc.status !== "SOLICITADO" && svc.diarista?.telefone, [svc]);
  const chatLiberado = useMemo(() => ["ACEITO", "EM_ANDAMENTO"].includes(statusRaw), [statusRaw]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Polling ───────────────────────────────────────────────────────────────
  const fetchAtual = useCallback(async () => {
    try {
      const res   = await api.get("/api/servicos/minhas");
      const found = Array.isArray(res.data?.servicos)
        ? res.data.servicos.find((s: Servico) => s.id === svc.id)
        : null;
      if (found) setSvc(found);
    } catch { /* silencioso */ }
  }, [svc.id]);

  useEffect(() => { fetchAtual(); }, [fetchAtual]);

  useFocusEffect(useCallback(() => {
    fetchAtual();
    const t = setInterval(fetchAtual, POLL_MS);
    return () => clearInterval(t);
  }, [fetchAtual]));

  // ── Actions ───────────────────────────────────────────────────────────────
  const onConfirmar = useCallback(async () => {
    if (confirming || rating || busyRef.current) return;
    busyRef.current = true;
    try {
      setConfirming(true);
      await api.post(`/api/servicos/${svc.id}/confirmar`);
      setSvc((cur) => ({ ...cur, status: "CONFIRMADO", __confirmedByClient: true }));
      setToast("Serviço confirmado com sucesso.");
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? e?.message ?? "Falha ao confirmar serviço.");
    } finally {
      setConfirming(false);
      busyRef.current = false;
    }
  }, [confirming, rating, svc.id]);

  const onAvaliar = useCallback(async () => {
    if (rating || confirming || busyRef.current) return;
    const nota = Math.max(1, Math.min(5, Number(notaGeral) || 5));
    const payload = {
      notaGeral: nota,
      pontualidade: pontualidade ?? nota,
      qualidade:    qualidade    ?? nota,
      comunicacao:  comunicacao  ?? nota,
      ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
    };
    busyRef.current = true;
    try {
      setRating(true);
      await api.post(`/api/servicos/${svc.id}/avaliar`, payload);
      setSvc((cur) => ({ ...cur, avaliacaoCliente: { ...payload, createdAt: new Date().toISOString() } as any, __ratedByClient: true }));
      setToast("Avaliação enviada. Obrigado!");
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? e?.message ?? "Falha ao enviar avaliação.");
    } finally {
      setRating(false);
      busyRef.current = false;
    }
  }, [rating, confirming, notaGeral, pontualidade, qualidade, comunicacao, comentario, svc.id]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={["top","left","right","bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAtual} />}
      >

        {/* Toast */}
        {toast ? (
          <View style={s.toast}><Text style={s.toastText}>{toast}</Text></View>
        ) : null}

        {/* Título + status */}
        <View style={s.titleRow}>
          <Text style={s.title}>Serviço #{svc.id.slice(0, 6).toUpperCase()}</Text>
          <DularBadge text={statusLabel(svc.status)} variant={statusVariant(svc.status)} />
        </View>

        {/* Info card */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>{svc.bairro} — {svc.cidade}/{svc.uf}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="cash-outline" size={15} color={colors.green} />
            <Text style={[s.infoText, { fontWeight: "800", color: colors.greenDark }]}>
              {formatPrice(svc.precoFinal)}
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>Diarista: {svc.diarista?.nome ?? "Pendente"}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.infoRow}>
            <Ionicons name="calendar-outline" size={15} color={colors.green} />
            <Text style={s.infoText}>Criado em {formatDate(svc.createdAt)}</Text>
          </View>
        </View>

        {/* Contato liberado */}
        {contatoLiberado && (
          <View style={s.contactCard}>
            <Ionicons name="call" size={16} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <Text style={s.contactTitle}>Contato liberado</Text>
              <Text style={s.contactPhone}>{svc.diarista?.telefone}</Text>
              <Text style={s.contactSub}>Combine detalhes e pagamento diretamente.</Text>
            </View>
          </View>
        )}

        {/* Avisos de status */}
        {svc.status === "ACEITO" && (
          <View style={s.infoBar}>
            <Ionicons name="information-circle" size={16} color="#0369A1" />
            <Text style={s.infoBarText}>Sua solicitação foi aceita. A diarista está a caminho.</Text>
          </View>
        )}
        {svc.status === "EM_ANDAMENTO" && (
          <View style={s.infoBar}>
            <Ionicons name="time" size={16} color="#92400E" />
            <Text style={[s.infoBarText, { color: "#92400E" }]}>
              Serviço em andamento. Aguarde a conclusão para confirmar.
            </Text>
          </View>
        )}

        {chatLiberado && (
          <DButton
            title="Abrir chat"
            variant="outline"
            onPress={() => navigation.navigate(CLIENTE_STACK_ROUTES.CHAT, { servicoId: svc.id })}
          />
        )}

        {/* Confirmar */}
        {podeConfirmar && (
          <DButton
            title={confirming ? "Confirmando..." : "Confirmar serviço"}
            onPress={onConfirmar}
            loading={confirming || loading}
            disabled={confirming || rating}
          />
        )}

        {/* Avaliação */}
        {podeAvaliar && (
          <View style={[s.card, { gap: 12 }]}>
            <Text style={s.sectionTitle}>Avaliar serviço</Text>
            <RatingRow label="Nota geral"    value={notaGeral}    onChange={setNotaGeral} />
            <RatingRow label="Pontualidade"  value={pontualidade} onChange={setPontualidade} />
            <RatingRow label="Qualidade"     value={qualidade}    onChange={setQualidade} />
            <RatingRow label="Comunicação"   value={comunicacao}  onChange={setComunicacao} />
            <DInput
              value={comentario}
              onChangeText={setComentario}
              placeholder="Comentário (opcional)"
              style={{ minHeight: 72 }}
              multiline
            />
            <DButton
              title={rating ? "Enviando..." : "Enviar avaliação"}
              loading={rating || loading}
              onPress={onAvaliar}
              disabled={rating || confirming}
            />
          </View>
        )}

        {/* Já avaliado */}
        {!podeConfirmar && !podeAvaliar && alreadyRated && (
          <View style={s.doneCard}>
            <Ionicons name="star" size={18} color={colors.star} />
            <Text style={s.doneText}>Você já avaliou este serviço. Obrigado!</Text>
          </View>
        )}

        {/* Voltar */}
        {!podeConfirmar && !podeAvaliar && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={16} color={colors.sub} />
            <Text style={s.backText}>Voltar</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md },

  toast: { padding: 12, borderRadius: radius.md, backgroundColor: colors.ink },
  toastText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title:    { ...typography.h1 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
    gap: 10,
    ...shadow.card,
  },
  infoRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, fontWeight: "600", color: colors.ink, flex: 1 },
  divider:  { height: 1, backgroundColor: colors.stroke },

  sectionTitle: { ...typography.h3 },

  contactCard: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.green,
    alignItems: "flex-start",
    ...shadow.card,
  },
  contactTitle: { fontSize: 13, fontWeight: "800", color: colors.greenDark },
  contactPhone: { fontSize: 15, fontWeight: "700", color: colors.greenDark, marginTop: 2 },
  contactSub:   { ...typography.sub, color: colors.greenDark, marginTop: 2 },

  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: "#E0F2FE",
  },
  infoBarText: { fontSize: 13, fontWeight: "600", color: "#0F172A", flex: 1 },

  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.greenLight,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  doneText: { fontSize: 14, fontWeight: "700", color: colors.greenDark },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
  },
  backText: { ...typography.sub, fontSize: 14 },
});
