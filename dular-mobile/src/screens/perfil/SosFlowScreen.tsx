import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { Screen } from "@/components/Screen";
import { useAuth } from "@/stores/authStore";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import { useSosStore } from "@/stores/sosStore";
import { colors } from "@/theme/tokens";

/**
 * SosFlowScreen — fluxo SOS (Etapa 2).
 *
 * Passos: tipo -> relato (+ provas) -> revisão -> enviando -> sucesso (protocolo).
 * Dados locais/mock por enquanto (protocolo gerado no app). A denúncia formal
 * continua na tela ReportIncident, acessível pelo link "Fazer denúncia".
 */

const RELATO_MAX = 1000;
const DANGER = colors.danger;

type Step = "tipo" | "relato" | "revisao" | "enviando" | "sucesso";

type IncidentType = { id: string; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string };

const TIPOS: IncidentType[] = [
  { id: "comportamento", label: "Comportamento inadequado", icon: "sad-outline", hint: "Ofensas, grosseria, ameaças" },
  { id: "agressao", label: "Agressão física ou verbal", icon: "warning-outline", hint: "Violência, intimidação, assédio" },
  { id: "danos", label: "Danos materiais", icon: "hammer-outline", hint: "Quebra de objetos, furtos" },
  { id: "pagamento", label: "Problemas com pagamento", icon: "card-outline", hint: "Não pagamento, cancelamento" },
  { id: "risco", label: "Situação de risco", icon: "alert-circle-outline", hint: "Ambiente inseguro, perigo" },
  { id: "outro", label: "Outro tipo", icon: "ellipsis-horizontal", hint: "Outros incidentes" },
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

  const setLastSos = useSosStore((s) => s.setLastSos);
  const voltarPerfil = () => nav.navigate(currentUser?.role === "MONTADOR" ? "MontadorPerfil" : "Perfil");
  const [step, setStep] = useState<Step>("tipo");
  const [tipoId, setTipoId] = useState<string | null>(null);
  const [relato, setRelato] = useState("");
  const [provas, setProvas] = useState<string[]>([]);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const enviadoEm = useRef<Date | null>(null);

  const tipo = useMemo(() => TIPOS.find((t) => t.id === tipoId) ?? null, [tipoId]);

  const addProva = async () => {
    if (provas.length >= 10) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (res.canceled) return;
    const uri = res.assets?.[0]?.uri;
    if (uri) setProvas((prev) => [...prev, uri]);
  };

  const enviar = () => {
    setStep("enviando");
    setTimeout(() => {
      const novoProtocolo = gerarProtocolo();
      const agora = new Date();
      setProtocolo(novoProtocolo);
      enviadoEm.current = agora;
      setLastSos({
        protocolo: novoProtocolo,
        tipoLabel: tipo?.label ?? "Incidente",
        status: "EM_ANALISE",
        criadoEm: agora.toISOString(),
      });
      setStep("sucesso");
    }, 1800);
  };

  const dataHora = enviadoEm.current
    ? `${enviadoEm.current.toLocaleDateString("pt-BR")} • ${enviadoEm.current.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "";

  const title =
    step === "sucesso" ? "SOS" : step === "enviando" ? "SOS" : step === "revisao" ? "Revisão" : "SOS";

  return (
    <Screen
      title={title}
      rightAction={
        <Pressable onPress={voltarPerfil} hitSlop={12}>
          <Ionicons name="chevron-forward" size={22} color={colors.ink} />
        </Pressable>
      }
      contentStyle={{ gap: 14 }}
    >
      {/* ───────────────── TIPO (ANTES) ───────────────── */}
      {step === "tipo" ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Precisando de ajuda?</Text>
              <Text style={{ color: DANGER, fontWeight: "700" }}>Estamos aqui para você.</Text>
              <Text style={{ color: colors.sub, fontSize: 12 }}>
                Relate o que aconteceu. Nossa equipe vai analisar com prioridade.
              </Text>
            </View>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: DANGER, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.white, fontWeight: "900", fontSize: 18 }}>SOS</Text>
            </View>
          </View>

          <Text style={{ fontWeight: "800", color: colors.ink, marginTop: 4 }}>O que aconteceu?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {TIPOS.map((t) => {
              const active = tipoId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTipoId(t.id)}
                  style={{
                    width: "47%",
                    borderWidth: 1.5,
                    borderColor: active ? theme.primary : theme.border,
                    backgroundColor: active ? theme.backgroundSoft : "rgba(255,255,255,0.92)",
                    borderRadius: 14,
                    padding: 12,
                    gap: 6,
                  }}
                >
                  <Ionicons name={t.icon} size={22} color={active ? theme.primary : colors.sub} />
                  <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 13 }}>{t.label}</Text>
                  <Text style={{ color: colors.sub, fontSize: 11 }}>{t.hint}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setStep("relato")}
            disabled={!tipoId}
            style={{ marginTop: 8, backgroundColor: theme.primary, borderRadius: 14, padding: 14, alignItems: "center", opacity: tipoId ? 1 : 0.6 }}
          >
            <Text style={{ color: colors.white, fontWeight: "800" }}>Relatar incidente</Text>
          </Pressable>
          <Pressable
            onPress={() => nav.navigate("ReportIncident")}
            style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, alignItems: "center" }}
          >
            <Text style={{ color: theme.textAccent, fontWeight: "800" }}>Fazer denúncia formal</Text>
          </Pressable>
        </>
      ) : null}

      {/* ───────────────── RELATO (DURANTE) ───────────────── */}
      {step === "relato" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
          <Text style={{ fontWeight: "800", color: colors.ink }}>Relate o ocorrido</Text>
          <TextInput
            value={relato}
            onChangeText={(v) => setRelato(v.slice(0, RELATO_MAX))}
            placeholder="Descreva com detalhes o que aconteceu…"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 130, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, color: colors.ink, backgroundColor: "rgba(255,255,255,0.92)" }}
          />
          <Text style={{ alignSelf: "flex-end", color: colors.sub, fontSize: 12 }}>{relato.length}/{RELATO_MAX}</Text>

          <Text style={{ fontWeight: "800", color: colors.ink }}>Envie provas (opcional)</Text>
          <Text style={{ color: colors.sub, fontSize: 12 }}>Fotos, prints ou documentos. Máx. 10 arquivos.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {provas.map((uri, i) => (
              <View key={`${uri}-${i}`} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", backgroundColor: theme.backgroundSoft }}>
                <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
              </View>
            ))}
            {provas.length < 10 ? (
              <Pressable
                onPress={addProva}
                style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", gap: 2 }}
              >
                <Ionicons name="add" size={22} color={theme.primary} />
                <Text style={{ color: theme.textAccent, fontSize: 10, fontWeight: "700" }}>Adicionar</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Pressable onPress={() => setStep("tipo")} style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: theme.textAccent, fontWeight: "800" }}>Voltar</Text>
            </Pressable>
            <Pressable
              onPress={() => setStep("revisao")}
              disabled={relato.trim().length < 10}
              style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, padding: 14, alignItems: "center", opacity: relato.trim().length < 10 ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.white, fontWeight: "800" }}>Revisar</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* ───────────────── REVISÃO (DURANTE) ───────────────── */}
      {step === "revisao" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
          <Text style={{ fontWeight: "800", color: colors.ink, fontSize: 16 }}>Revise suas informações</Text>
          <Text style={{ color: colors.sub, fontSize: 12 }}>Confira os detalhes antes de enviar.</Text>

          <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, gap: 4, backgroundColor: theme.backgroundSoft }}>
            <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "700" }}>Tipo de incidente</Text>
            <Text style={{ color: colors.ink, fontWeight: "700" }}>{tipo?.label ?? "—"}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, gap: 4, backgroundColor: theme.backgroundSoft }}>
            <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "700" }}>Relato</Text>
            <Text style={{ color: colors.ink }}>{relato.trim()}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, gap: 4, backgroundColor: theme.backgroundSoft }}>
            <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "700" }}>Provas</Text>
            <Text style={{ color: colors.ink, fontWeight: "700" }}>{provas.length} arquivo(s) anexado(s)</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Pressable onPress={() => setStep("relato")} style={{ flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: theme.textAccent, fontWeight: "800" }}>Editar</Text>
            </Pressable>
            <Pressable onPress={enviar} style={{ flex: 1, backgroundColor: theme.primary, borderRadius: 14, padding: 14, alignItems: "center" }}>
              <Text style={{ color: colors.white, fontWeight: "800" }}>Enviar agora</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : null}

      {/* ───────────────── ENVIANDO (DEPOIS) ───────────────── */}
      {step === "enviando" ? (
        <View style={{ alignItems: "center", gap: 16, paddingTop: 60 }}>
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: theme.backgroundSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="paper-plane-outline" size={52} color={theme.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.ink }}>Enviando seu relato…</Text>
          <Text style={{ color: colors.sub, textAlign: "center", paddingHorizontal: 24 }}>
            Aguarde enquanto enviamos suas informações para nossa equipe de segurança.
          </Text>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : null}

      {/* ───────────────── SUCESSO (DEPOIS) ───────────────── */}
      {step === "sucesso" ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
          <View style={{ alignItems: "center", gap: 10, paddingTop: 8 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "800", color: colors.ink, textAlign: "center" }}>Relato enviado com sucesso!</Text>
            <Text style={{ color: colors.sub, textAlign: "center", paddingHorizontal: 16 }}>
              Sua solicitação foi recebida e está sendo analisada com prioridade.
            </Text>
          </View>

          <View style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 16, gap: 10, backgroundColor: theme.backgroundSoft }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.sub, fontSize: 12, fontWeight: "700" }}>Número do protocolo</Text>
              <Text style={{ color: theme.textAccent, fontWeight: "800", fontSize: 16 }}>{protocolo}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.sub, fontSize: 12 }}>Data e hora</Text>
              <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>{dataHora}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.sub, fontSize: 12 }}>Tipo de incidente</Text>
              <Text style={{ color: colors.ink, fontWeight: "700", fontSize: 12 }}>{tipo?.label}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.sub, fontSize: 12 }}>Status</Text>
              <View style={{ backgroundColor: colors.warningSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Text style={{ color: colors.warning, fontWeight: "800", fontSize: 12 }}>Em análise</Text>
              </View>
            </View>
          </View>

          <Text style={{ fontWeight: "800", color: colors.ink }}>O que acontece agora?</Text>
          {[
            "Nossa equipe já foi notificada",
            "Você receberá atualizações sobre o andamento",
            "Entraremos em contato caso precisemos de mais informações",
          ].map((t) => (
            <View key={t} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={theme.primary} style={{ marginTop: 1 }} />
              <Text style={{ color: colors.sub, flex: 1, fontSize: 13 }}>{t}</Text>
            </View>
          ))}

          <Pressable onPress={voltarPerfil} style={{ marginTop: 6, backgroundColor: theme.primary, borderRadius: 14, padding: 14, alignItems: "center" }}>
            <Text style={{ color: colors.white, fontWeight: "800" }}>Entendi</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </Screen>
  );
}
