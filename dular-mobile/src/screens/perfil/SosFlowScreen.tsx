import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { Screen } from "@/components/Screen";
import { AppIcon, BackCircleButton, type AppIconName } from "@/components/ui";
import { SOSIcon } from "@/assets/icons";
import { acionarSos, protocoloFromId } from "@/api/segurancaApi";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { ProfileTheme } from "@/theme/profileTheme";
import { colors, radius, shadow, typography } from "@/theme/tokens";

/**
 * SosFlowScreen — fluxo SOS (Etapa 2).
 *
 * Passos: tipo -> relato (+ provas) -> revisão -> enviando -> sucesso (protocolo).
 * A cor de acento segue o gênero do usuário (rosa/verde/roxo); o vermelho é
 * reservado à identidade de emergência (SOS) e à prioridade crítica.
 */

const RELATO_MAX = 1000;
const DANGER = colors.danger;

type Step = "tipo" | "relato" | "revisao" | "enviando" | "sucesso";

type IncidentType = { id: string; label: string; icon: AppIconName; hint: string };

const TIPOS: IncidentType[] = [
  { id: "comportamento", label: "Comportamento inadequado", icon: "MessageCircle", hint: "Ofensas, grosseria, ameaças" },
  { id: "agressao", label: "Agressão física ou verbal", icon: "AlertTriangle", hint: "Violência, intimidação, assédio" },
  { id: "danos", label: "Danos materiais", icon: "Home", hint: "Quebra de objetos, furtos" },
  { id: "pagamento", label: "Problemas com pagamento", icon: "Wallet", hint: "Não pagamento, cancelamento" },
  { id: "risco", label: "Situação de risco", icon: "Shield", hint: "Ambiente inseguro, perigo" },
  { id: "outro", label: "Outro tipo", icon: "FileText", hint: "Outros incidentes" },
];

type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
const PRIORIDADES: { value: Prioridade; label: string; color: string }[] = [
  { value: "BAIXA", label: "Baixa", color: colors.sub },
  { value: "MEDIA", label: "Média", color: colors.warning },
  { value: "ALTA", label: "Alta", color: colors.danger },
  { value: "CRITICA", label: "Crítica", color: colors.incidentCritical },
];

function gerarProtocolo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(10000 + Math.random() * 89999));
  return `#SOS-${y}-${m}-${d}-${seq}`;
}

export default function SosFlowScreen() {
  const nav = useNavigation<any>();
  const currentUser = useAuth((s) => s.user);
  const theme = useProfileTheme(currentUser?.role);
  const st = useMemo(() => makeStyles(theme), [theme]);

  const voltarPerfil = () => nav.navigate(currentUser?.role === "MONTADOR" ? "MontadorPerfil" : "Perfil");
  const [step, setStep] = useState<Step>("tipo");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [relato, setRelato] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>("MEDIA");
  const [provas, setProvas] = useState<string[]>([]);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const enviadoEm = useRef<Date | null>(null);

  const tipo = useMemo(() => TIPOS.find((t) => t.id === tipoId) ?? null, [tipoId]);
  // Prestadores (montador/diarista) não relatam "danos materiais" — não são donos
  // do imóvel. O empregador (recebe pessoas em casa) vê a lista completa.
  const tipos = useMemo(
    () => (currentUser?.role === "EMPREGADOR" ? TIPOS : TIPOS.filter((t) => t.id !== "danos")),
    [currentUser?.role],
  );
  const prioridadeInfo = PRIORIDADES.find((p) => p.value === prioridade) ?? PRIORIDADES[1];

  const adicionarUri = (uri?: string) => {
    if (uri) setProvas((prev) => [...prev, uri]);
  };

  const tirarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso à câmera para registrar uma foto do incidente.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) adicionarUri(res.assets?.[0]?.uri);
  };

  const escolherDaGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Permita o acesso às fotos para anexar provas.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 });
    if (!res.canceled) adicionarUri(res.assets?.[0]?.uri);
  };

  const addProva = () => {
    if (provas.length >= 10) return;
    Alert.alert("Adicionar prova", "Como deseja registrar?", [
      { text: "Tirar foto", onPress: () => void tirarFoto() },
      { text: "Galeria", onPress: () => void escolherDaGaleria() },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const enviar = async () => {
    setStep("enviando");
    const agora = new Date();
    // O endpoint /api/seguranca/sos aceita apenas texto livre (máx. 500 chars):
    // consolidamos tipo + prioridade + relato numa única mensagem. As provas
    // (fotos) ainda não são enviadas — o endpoint atual não tem campo de anexo.
    const mensagem = [tipo?.label ?? "Incidente", `Prioridade: ${prioridadeInfo.label}`, relato.trim()]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 500);
    try {
      const res = await acionarSos({ mensagem, tipo: tipo?.label, prioridade: prioridadeInfo.label });
      setProtocolo(res?.id ? protocoloFromId(res.id) : gerarProtocolo());
      enviadoEm.current = agora;
      setStep("sucesso");
    } catch {
      Alert.alert(
        "Falha ao enviar SOS",
        "Não foi possível registrar seu SOS agora. Verifique sua conexão e tente novamente.",
      );
      setStep("revisao");
    }
  };

  const dataHora = enviadoEm.current
    ? `${enviadoEm.current.toLocaleDateString("pt-BR")} • ${enviadoEm.current.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "";

  const title = step === "revisao" ? "Revisão" : "SOS";

  return (
    <Screen
      title={title}
      rightAction={<BackCircleButton onPress={voltarPerfil} color={theme.icon} borderColor={theme.border} />}
      contentStyle={{ gap: 14 }}
    >
      {/* ───────────────── TIPO ───────────────── */}
      {step === "tipo" ? (
        <>
          <View style={st.introRow}>
            <View style={st.introText}>
              <Text style={st.h1}>Precisando de ajuda?</Text>
              <Text style={st.dangerText}>Estamos aqui para você.</Text>
              <Text style={st.muted}>
                Relate o que aconteceu. Nossa equipe vai analisar com prioridade.
              </Text>
            </View>
            <View style={st.sosBadge}>
              <SOSIcon size={40} />
            </View>
          </View>

          <Text style={st.label}>O que aconteceu?</Text>
          <View style={st.typeGrid}>
            {tipos.map((t) => {
              const active = tipoId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTipoId(t.id)}
                  style={[st.typeCard, active && st.typeCardActive]}
                >
                  <View style={[st.typeIcon, active && st.typeIconActive]}>
                    <AppIcon name={t.icon} size={20} color={active ? colors.white : theme.primary} strokeWidth={2.2} />
                  </View>
                  <Text style={st.typeLabel}>{t.label}</Text>
                  <Text style={st.typeHint}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setStep("relato")}
            disabled={!tipoId}
            style={[st.primaryBtn, !tipoId && st.disabled]}
          >
            <Text style={st.primaryBtnText}>Relatar incidente</Text>
          </Pressable>
          <Pressable onPress={() => nav.navigate("ReportIncident")} style={st.secondaryBtn}>
            <Text style={st.secondaryBtnText}>Fazer denúncia formal</Text>
          </Pressable>
        </>
      ) : null}

      {/* ───────────────── RELATO ───────────────── */}
      {step === "relato" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.stepScroll}>
          <Text style={st.label}>Relate o ocorrido</Text>
          <TextInput
            value={relato}
            onChangeText={(v) => setRelato(v.slice(0, RELATO_MAX))}
            placeholder="Descreva com detalhes o que aconteceu…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={st.input}
          />
          <Text style={st.counter}>{relato.length}/{RELATO_MAX}</Text>

          <Text style={st.label}>Prioridade</Text>
          <View style={st.prioRow}>
            {PRIORIDADES.map((p) => {
              const active = prioridade === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPrioridade(p.value)}
                  style={[
                    st.prioChip,
                    { borderColor: active ? p.color : theme.border, backgroundColor: active ? p.color : colors.card },
                  ]}
                >
                  <Text style={[st.prioChipText, { color: active ? colors.white : colors.ink }]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={st.label}>Envie provas (opcional)</Text>
          <Text style={st.muted}>Tire uma foto na hora pela câmera ou anexe da galeria. Máx. 10 arquivos.</Text>
          <View style={st.provasRow}>
            {provas.map((uri, i) => (
              <View key={`${uri}-${i}`} style={st.provaThumb}>
                <Image source={{ uri }} style={st.provaImg} />
              </View>
            ))}
            {provas.length < 10 ? (
              <Pressable onPress={addProva} style={st.addProva}>
                <AppIcon name="Plus" size={22} color={theme.primary} strokeWidth={2.3} />
                <Text style={st.addProvaText}>Adicionar</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={st.navRow}>
            <Pressable onPress={() => setStep("tipo")} style={[st.secondaryBtn, st.flex1]}>
              <Text style={st.secondaryBtnText}>Voltar</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("revisao")}
              disabled={relato.trim().length < 10}
              style={[st.primaryBtn, st.flex1, relato.trim().length < 10 && st.disabled]}
            >
              <Text style={st.primaryBtnText}>Revisar</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* ───────────────── REVISÃO ───────────────── */}
      {step === "revisao" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.stepScroll}>
          <Text style={st.h2}>Revise suas informações</Text>
          <Text style={st.muted}>Confira os detalhes antes de enviar.</Text>

          <View style={st.reviewCard}>
            <Text style={st.reviewLabel}>Tipo de incidente</Text>
            <Text style={st.reviewValue}>{tipo?.label ?? "—"}</Text>
          </View>
          <View style={st.reviewCard}>
            <Text style={st.reviewLabel}>Prioridade</Text>
            <Text style={[st.reviewValue, { color: prioridadeInfo.color }]}>{prioridadeInfo.label}</Text>
          </View>
          <View style={st.reviewCard}>
            <Text style={st.reviewLabel}>Relato</Text>
            <Text style={st.reviewValue}>{relato.trim()}</Text>
          </View>
          <View style={st.reviewCard}>
            <Text style={st.reviewLabel}>Provas</Text>
            <Text style={st.reviewValue}>{provas.length} arquivo(s) anexado(s)</Text>
          </View>

          <View style={st.navRow}>
            <Pressable onPress={() => setStep("relato")} style={[st.secondaryBtn, st.flex1]}>
              <Text style={st.secondaryBtnText}>Editar</Text>
            </Pressable>
            <Pressable onPress={enviar} style={[st.primaryBtn, st.flex1]}>
              <Text style={st.primaryBtnText}>Enviar agora</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* ───────────────── ENVIANDO ───────────────── */}
      {step === "enviando" ? (
        <View style={st.centerBlock}>
          <View style={st.circleSoft}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
          <Text style={st.h2}>Enviando seu relato…</Text>
          <Text style={st.centerMuted}>
            Aguarde enquanto enviamos suas informações para nossa equipe de segurança.
          </Text>
        </View>
      ) : null}

      {/* ───────────────── SUCESSO ───────────────── */}
      {step === "sucesso" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.stepScroll}>
          <View style={st.successHero}>
            <View style={st.successCircle}>
              <AppIcon name="CheckCircle" size={54} color={colors.success} strokeWidth={2.1} />
            </View>
            <Text style={st.successTitle}>Relato enviado com sucesso!</Text>
            <Text style={st.centerMuted}>
              Sua solicitação foi recebida e está sendo analisada com prioridade.
            </Text>
          </View>

          <View style={st.protocoloCard}>
            <View style={st.protocoloHead}>
              <Text style={st.reviewLabel}>Número do protocolo</Text>
              <Text style={st.protocoloValue}>{protocolo}</Text>
            </View>
            <View style={st.kvRow}>
              <Text style={st.kvLabel}>Data e hora</Text>
              <Text style={st.kvValue}>{dataHora}</Text>
            </View>
            <View style={st.kvRow}>
              <Text style={st.kvLabel}>Tipo de incidente</Text>
              <Text style={st.kvValue}>{tipo?.label}</Text>
            </View>
            <View style={st.kvRow}>
              <Text style={st.kvLabel}>Prioridade</Text>
              <Text style={[st.kvValue, { color: prioridadeInfo.color }]}>{prioridadeInfo.label}</Text>
            </View>
            <View style={[st.kvRow, { alignItems: "center" }]}>
              <Text style={st.kvLabel}>Status</Text>
              <View style={st.statusBadge}>
                <Text style={st.statusBadgeText}>Em análise</Text>
              </View>
            </View>
          </View>

          <Text style={st.label}>O que acontece agora?</Text>
          {[
            "Nossa equipe já foi notificada",
            "Você receberá atualizações sobre o andamento",
            "Entraremos em contato caso precisemos de mais informações",
          ].map((t) => (
            <View key={t} style={st.checkRow}>
              <AppIcon name="CheckCircle" size={16} color={theme.primary} strokeWidth={2.3} />
              <Text style={st.checkText}>{t}</Text>
            </View>
          ))}

          <Pressable onPress={voltarPerfil} style={[st.primaryBtn, { marginTop: 6 }]}>
            <Text style={st.primaryBtnText}>Entendi</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function makeStyles(theme: ProfileTheme) {
  return StyleSheet.create({
    stepScroll: { gap: 14, paddingBottom: 8 },
    flex1: { flex: 1 },

    introRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    introText: { flex: 1, gap: 3 },
    h1: { fontSize: 19, fontWeight: "800", color: colors.ink },
    h2: { fontSize: 16, fontWeight: "800", color: colors.ink },
    dangerText: { color: DANGER, ...typography.bodySm, fontWeight: "700" },
    muted: { color: colors.sub, fontSize: 12, fontWeight: "500" },
    label: { fontSize: 15, fontWeight: "800", color: colors.ink, marginTop: 4 },

    sosBadge: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    typeCard: {
      width: "47.5%",
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 12,
      gap: 8,
    },
    typeCardActive: { borderColor: theme.primary, backgroundColor: theme.backgroundSoft },
    typeIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    typeIconActive: { backgroundColor: theme.primary },
    typeLabel: { fontWeight: "800", color: colors.ink, fontSize: 13 },
    typeHint: { color: colors.sub, fontSize: 11, fontWeight: "500" },

    primaryBtn: {
      backgroundColor: theme.primary,
      borderRadius: radius.lg,
      padding: 14,
      alignItems: "center",
      ...shadow.card,
    },
    primaryBtnText: { color: colors.white, ...typography.bodySm, fontWeight: "800" },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 14,
      alignItems: "center",
      backgroundColor: colors.card,
    },
    secondaryBtnText: { color: theme.textAccent, ...typography.bodySm, fontWeight: "800" },
    disabled: { opacity: 0.55 },

    input: {
      minHeight: 130,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: 12,
      color: colors.ink,
      backgroundColor: colors.card,
      ...typography.bodySm,
    },
    counter: { alignSelf: "flex-end", color: colors.sub, fontSize: 12, fontWeight: "500" },

    prioRow: { flexDirection: "row", gap: 8 },
    prioChip: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: radius.md,
      paddingVertical: 10,
      alignItems: "center",
    },
    prioChipText: { fontWeight: "800", fontSize: 12 },

    provasRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    provaThumb: { width: 72, height: 72, borderRadius: 12, overflow: "hidden", backgroundColor: theme.backgroundSoft },
    provaImg: { width: "100%", height: "100%" },
    addProva: {
      width: 72,
      height: 72,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderStyle: "dashed",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      backgroundColor: theme.primarySoft,
    },
    addProvaText: { color: theme.textAccent, fontSize: 10, fontWeight: "700" },

    navRow: { flexDirection: "row", gap: 10, marginTop: 6 },

    reviewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 14,
      gap: 4,
      backgroundColor: theme.backgroundSoft,
    },
    reviewLabel: { color: colors.sub, fontSize: 12, fontWeight: "700" },
    reviewValue: { color: colors.ink, ...typography.bodySm, fontWeight: "700" },

    centerBlock: { alignItems: "center", gap: 16, paddingTop: 60 },
    centerMuted: { color: colors.sub, textAlign: "center", paddingHorizontal: 24, ...typography.bodySm, fontWeight: "500" },
    circleSoft: {
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: theme.backgroundSoft,
      alignItems: "center",
      justifyContent: "center",
    },

    successHero: { alignItems: "center", gap: 10, paddingTop: 8 },
    successCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.successSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    successTitle: { fontSize: 19, fontWeight: "800", color: colors.ink, textAlign: "center", marginTop: 2 },

    protocoloCard: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.lg,
      padding: 16,
      gap: 10,
      backgroundColor: theme.backgroundSoft,
    },
    protocoloHead: { gap: 2 },
    protocoloValue: { color: theme.textAccent, fontWeight: "800", fontSize: 16 },
    kvRow: { flexDirection: "row", justifyContent: "space-between" },
    kvLabel: { color: colors.sub, fontSize: 12, fontWeight: "500" },
    kvValue: { color: colors.ink, fontWeight: "700", fontSize: 12 },
    statusBadge: {
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    statusBadgeText: { color: colors.warning, fontWeight: "800", fontSize: 12 },

    checkRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
    checkText: { color: colors.sub, flex: 1, fontSize: 13, fontWeight: "500" },
  });
}
