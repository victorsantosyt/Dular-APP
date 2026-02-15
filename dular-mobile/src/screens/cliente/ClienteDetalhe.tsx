import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { View, Text, Alert, TouchableOpacity, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { Servico } from "../../types/servico";
import { DInput } from "../../components/DInput";
import { DButton } from "../../components/DButton";
import { colors } from "../../theme/theme";

function statusLabel(st: string) {
  const s = (st || "").toUpperCase();
  if (["ACEITO"].includes(s)) return "Aceito";
  if (["EM_ANDAMENTO"].includes(s)) return "Em andamento";
  if (["CONCLUIDO", "CONCLUÍDO"].includes(s)) return "Concluído (aguardando confirmação)";
  if (["CONFIRMADO"].includes(s)) return "Confirmado";
  if (["FINALIZADO"].includes(s)) return "Finalizado";
  return s || "Status";
}

const brl = (v: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (v: string | number | Date) => new Date(v).toLocaleDateString("pt-BR");

export default function ClienteDetalhe({ route, navigation }: any) {
  const { servico } = route.params as { servico: Servico };
  const [svc, setSvc] = useState<Servico>(servico);
  const [notaGeral, setNotaGeral] = useState(5);
  const [pontualidade, setPontualidade] = useState<number | null>(null);
  const [qualidade, setQualidade] = useState<number | null>(null);
  const [comunicacao, setComunicacao] = useState<number | null>(null);
  const [comentario, setComentario] = useState("Serviço ok.");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rating, setRating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const statusRaw = useMemo(() => String(svc?.status ?? "").toUpperCase(), [svc?.status]);
  const isFinal = useMemo(
    () => ["CONFIRMADO", "FINALIZADO", "FINALIZADO_CLIENTE", "CONCLUIDO", "CONCLUÍDO", "PAGO", "AVALIADO"].includes(statusRaw),
    [statusRaw]
  );
  const alreadyConfirmed = useMemo(
    () => Boolean((svc as any)?.__confirmedByClient || (svc as any)?.finishedAt || (svc as any)?.finalizadoEm || isFinal),
    [svc, isFinal]
  );
  const alreadyRated = useMemo(
    () =>
      Boolean(
        (svc as any)?.__ratedByClient ||
          (svc as any)?.avaliacaoCliente ||
          (svc as any)?.notaCliente ||
          (svc as any)?.avaliadoEm ||
          (svc as any)?.ratingCliente ||
          (svc as any)?.reviewCliente ||
          statusRaw === "AVALIADO"
      ),
    [svc, statusRaw]
  );
  const podeConfirmar = useMemo(
    () =>
      !alreadyConfirmed &&
      ["ACEITO", "EM_ANDAMENTO", "ANDAMENTO", "AGUARDANDO_CONFIRMACAO", "AGUARDANDO_CONFIRMAÇÃO"].includes(statusRaw),
    [alreadyConfirmed, statusRaw]
  );
  const podeAvaliar = useMemo(() => !alreadyRated && statusRaw === "CONFIRMADO", [alreadyRated, statusRaw]);
  const POLL_MS = 5000; // atualiza a cada 5s para refletir aceite/andamento rapidamente

  const fetchAtual = useCallback(async () => {
    try {
      const res = await api.get("/api/servicos/minhas");
      const found = Array.isArray(res.data?.servicos)
        ? res.data.servicos.find((s: Servico) => s.id === svc.id)
        : Array.isArray(res.data)
        ? res.data.find((s: Servico) => s.id === svc.id)
        : null;
      if (found) setSvc(found);
    } catch {
      // silencioso
    }
  }, [svc.id]);

  useEffect(() => {
    fetchAtual();
  }, [fetchAtual]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      fetchAtual();
      let timer: NodeJS.Timeout | null = null;
      timer = setInterval(() => {
        fetchAtual();
      }, POLL_MS);
      return () => {
        if (timer) clearInterval(timer);
      };
    }, [fetchAtual])
  );

  async function action(name: string, body?: unknown) {
    try {
      setLoading(true);
      await api.post(`/api/servicos/${svc.id}/${name}`, body ?? {});
      await fetchAtual();
      setToast(`Ação ${name} executada`);
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? e?.message ?? "Falha na ação.");
    } finally {
      setLoading(false);
    }
  }

  const contatoLiberado = useMemo(
    () => svc.status !== "SOLICITADO" && svc.diarista?.telefone,
    [svc.status, svc.diarista]
  );

  const onConfirmar = useCallback(async () => {
    if (confirming || rating || busyRef.current) return;
    busyRef.current = true;
    try {
      setToast(null);
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

  type AvaliacaoPayload = {
    notaGeral: number;
    pontualidade: number;
    qualidade: number;
    comunicacao: number;
    comentario?: string;
  };

  const onAvaliar = useCallback(async () => {
    if (rating || confirming || busyRef.current) return;
    const nota = Math.max(1, Math.min(5, Number(notaGeral) || 5));
    const payload: AvaliacaoPayload = {
      notaGeral: nota,
      pontualidade: pontualidade ?? nota,
      qualidade: qualidade ?? nota,
      comunicacao: comunicacao ?? nota,
    };
    const comentarioFinal = (comentario ?? "").trim();
    if (comentarioFinal) payload.comentario = comentarioFinal;
    busyRef.current = true;
    try {
      setToast(null);
      setRating(true);
      await api.post(`/api/servicos/${svc.id}/avaliar`, payload);
      setSvc((cur) => ({
        ...cur,
        avaliacaoCliente: {
          notaGeral: nota,
          pontualidade: payload.pontualidade,
          qualidade: payload.qualidade,
          comunicacao: payload.comunicacao,
          comentario: payload.comentario ?? null,
          createdAt: new Date().toISOString(),
        } as any,
        __ratedByClient: true,
      }));
      setToast("Avaliação enviada. Obrigado.");
    } catch (e: any) {
      setToast(e?.response?.data?.error ?? e?.message ?? "Falha ao enviar avaliação.");
    } finally {
      setRating(false);
      busyRef.current = false;
    }
  }, [rating, confirming, notaGeral, pontualidade, qualidade, comunicacao, comentario, svc.id]);

  const RatingRow = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number | null;
    onChange: (v: number) => void;
  }) => (
    <View style={{ marginTop: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (value ?? 0) >= n;
          return (
            <TouchableOpacity
              key={n}
              onPress={() => onChange(n)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: active ? "#4FA38F" : "#D7DEE4",
                backgroundColor: active ? "rgba(79,163,143,0.18)" : "#fff",
              }}
            >
              <Text style={{ color: active ? "#2B6B60" : "#64748B", fontWeight: "700" }}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          gap: 12,
          paddingBottom: Math.max(24, insets.bottom + 12),
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchAtual} />}
      >
        <Text style={{ fontSize: 20, fontWeight: "600" }}>Serviço {svc.id.slice(0, 6)}</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 6 }}>
          <Text style={{ fontWeight: "700", color: colors.text }}>{statusLabel(svc.status)}</Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "#EAF7F0",
            }}
          >
            <Text style={{ color: "#15803D", fontWeight: "700" }}>{statusLabel(svc.status)}</Text>
          </View>
        </View>

        <Text style={{ color: colors.text }}>
          {svc.bairro} — {svc.cidade}/{svc.uf}
        </Text>
        <Text style={{ color: colors.text, fontWeight: "700", marginTop: 4 }}>Preço: {brl(svc.precoFinal / 100)}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>Criado em {formatDate(svc.createdAt)}</Text>
        <Text style={{ marginTop: 6, color: colors.text }}>Diarista: {svc.diarista?.nome ?? "Pendente"}</Text>

        {toast ? (
          <View style={{ marginTop: 10, marginBottom: 4, padding: 12, borderRadius: 14, backgroundColor: "#0F172A" }}>
            <Text style={{ color: "#FFF", fontWeight: "700" }}>{toast}</Text>
          </View>
        ) : null}

        {contatoLiberado && (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#e5f6f0", gap: 4 }}>
            <Text style={{ fontWeight: "700", color: colors.text }}>Contato liberado</Text>
            <Text style={{ color: colors.text }}>{svc.diarista?.telefone}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Combine detalhes e pagamento diretamente com a diarista.
            </Text>
          </View>
        )}

        {/* Status em andamento / aceito para o cliente acompanhar */}
        {svc.status === "ACEITO" && (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#e0f2fe" }}>
            <Text style={{ color: "#0f172a" }}>Sua solicitação foi aceita. A diarista está a caminho.</Text>
          </View>
        )}
        {svc.status === "EM_ANDAMENTO" && (
          <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#e0f2fe" }}>
            <Text style={{ color: "#0f172a" }}>Serviço em andamento. Aguarde a conclusão para confirmar.</Text>
          </View>
        )}

        {podeConfirmar && (
          <DButton
            title={confirming ? "Confirmando..." : "Confirmar serviço"}
            onPress={onConfirmar}
            loading={loading || confirming}
            disabled={confirming || rating}
          />
        )}

        {podeAvaliar && (
          <View style={{ gap: 8 }}>
            <Text style={{ fontWeight: "600" }}>Avaliação</Text>
            <RatingRow label="Nota geral" value={notaGeral} onChange={setNotaGeral} />
            <RatingRow label="Pontualidade" value={pontualidade} onChange={setPontualidade} />
            <RatingRow label="Qualidade" value={qualidade} onChange={setQualidade} />
            <RatingRow label="Comunicação" value={comunicacao} onChange={setComunicacao} />
            <Text>Comentário (opcional)</Text>
            <DInput value={comentario} onChangeText={setComentario} style={{ minHeight: 80 }} multiline />
            <DButton
              title={rating ? "Enviando..." : "Enviar avaliação"}
              loading={rating || loading}
              onPress={onAvaliar}
              disabled={rating || confirming}
            />
          </View>
        )}

        <View style={{ padding: 12, borderRadius: 12, backgroundColor: "#e0f2fe" }}>
          {svc.status === "CONCLUIDO" || svc.status === "CONCLUÍDO" ? (
            <Text style={{ color: "#0f172a" }}>Confirme se o serviço foi concluído corretamente.</Text>
          ) : null}
          {svc.status === "CONFIRMADO" ? (
            <Text style={{ color: "#0f172a" }}>Avalie para ajudar outras pessoas a escolherem.</Text>
          ) : null}
          {svc.status === "FINALIZADO" ? (
            <Text style={{ color: "#0f172a" }}>Obrigado! Avaliação enviada.</Text>
          ) : null}
        </View>

        {!podeConfirmar && !podeAvaliar && alreadyRated && (
          <View
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 16,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontWeight: "800", color: colors.text }}>Avaliação</Text>
            <Text style={{ marginTop: 4, color: colors.muted }}>Você já avaliou este serviço.</Text>
          </View>
        )}

        {!podeConfirmar && !podeAvaliar && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 12 }}>
            <Text style={{ color: "#6B7280", textAlign: "center", fontWeight: "700" }}>Voltar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
