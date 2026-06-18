import React, { useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { DCard } from "@/components/ui/DCard";
import type { EmpregadorServiceFlowStackParamList } from "@/navigation/EmpregadorServiceFlowNavigator";
import { colors, radius, spacing } from "@/theme";
import { criarServico, prepararPayload } from "@/api/empregadorApi";
import { motivoLabel } from "@/api/perfilApi";
import { useAuth } from "@/stores/authStore";
import { SERVICE_LABELS, useServiceFlow } from "./ServiceFlowContext";
import { FlowPrimaryButton, flowStyles, StepHeader, SummaryCard } from "./components";
import { getServiceFlowTheme } from "@/theme/serviceFlowTheme";

type Navigation = NativeStackNavigationProp<EmpregadorServiceFlowStackParamList, "ConfirmarSolicitacao">;

function formatDate(value: string) {
  if (!value) return "Data não definida";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function ConfirmarSolicitacaoScreen() {
  const navigation = useNavigation<Navigation>();
  const { draft } = useServiceFlow();
  const [submitting, setSubmitting] = useState(false);
  const flowTheme = getServiceFlowTheme(draft.tipo);
  const isMontador = draft.tipo === "MONTADOR";

  // Nichos sem preço fixo — valor sempre "a combinar".
  const CATEGORIAS_A_COMBINAR = new Set(["faxineira", "cuidadora", "passadeira", "lavadeira"]);

  // Rótulo de preço exibido na tela de confirmação.
  // Prioridade: 1) precoEstimadoLabel do draft (vindo do perfil público)
  //             2) fallback por categoria
  // Nunca exibe número fixo hardcoded.
  function resolvePrecoLabel(): string {
    if (isMontador) return "A orçar";
    if (CATEGORIAS_A_COMBINAR.has(draft.categoria)) return "A combinar";
    if (draft.precoEstimadoLabel) return draft.precoEstimadoLabel;
    // Preço não disponível por nenhum motivo — omite com "A combinar"
    return "A combinar";
  }
  const precoLabel = resolvePrecoLabel();

  const empregadorVerificado = useAuth(
    (state) =>
      state.user?.verificacao?.status === "APROVADO" ||
      state.user?.verificado === true,
  );

  // T-18.5/T-18.6: modal bloqueante. Checa o estado local primeiro (UX
  // rápido); o backend é a fonte da verdade e devolve 403 GUARDIAN_BLOCKED
  // (Guardian) ou 403 VERIFICACAO_OBRIGATORIA (gate legado) — caso ocorra,
  // mostramos o mesmo modal, agora com motivos do Guardian quando vierem.
  function showVerificacaoObrigatoria(opts?: { motivos?: string[]; message?: string }) {
    const baseTitle = "Verificação obrigatória";
    const baseText =
      opts?.message ??
      "Para solicitar serviços, envie seus documentos. Essa etapa ajuda a manter a segurança da plataforma.";
    const motivosTexto = (opts?.motivos ?? [])
      .map(motivoLabel)
      .filter(Boolean)
      .map((m) => `• ${m}`)
      .join("\n");
    const finalText = motivosTexto ? `${baseText}\n\n${motivosTexto}` : baseText;
    Alert.alert(baseTitle, finalText, [
      { text: "Depois", style: "cancel" },
      {
        text: "Verificar agora",
        onPress: () => navigation.getParent()?.navigate("VerificacaoDocs" as never),
      },
    ]);
  }

  const confirmRequest = async () => {
    const prepared = prepararPayload(draft);
    if (!prepared.ok) {
      Alert.alert("Não foi possível confirmar", prepared.error);
      return;
    }

    if (!empregadorVerificado) {
      showVerificacaoObrigatoria();
      return;
    }

    try {
      setSubmitting(true);
      const result = await criarServico(prepared.payload);
      navigation.navigate("SolicitacaoSucesso", { servicoId: result.servicoId });
    } catch (err: unknown) {
      // 403 do backend: GUARDIAN_BLOCKED (T-18.6) ou VERIFICACAO_OBRIGATORIA
      // (T-18.5 legado). Ambos abrem o mesmo modal — Guardian traz motivos.
      const e = err as {
        response?: {
          status?: number;
          data?: { error?: string; message?: string; motivos?: string[] };
        };
      };
      const errorCode = e?.response?.data?.error;
      if (
        e?.response?.status === 403 &&
        (errorCode === "GUARDIAN_BLOCKED" || errorCode === "VERIFICACAO_OBRIGATORIA")
      ) {
        showVerificacaoObrigatoria({
          motivos: e?.response?.data?.motivos,
          message: e?.response?.data?.message,
        });
        return;
      }
      // Paywall / limite de plano: mensagem clara do backend.
      if (e?.response?.status === 403 && errorCode === "LIMIT_EXCEEDED") {
        Alert.alert(
          "Limite do plano atingido",
          e?.response?.data?.message ??
            "Você atingiu o limite de solicitações do seu plano atual.",
        );
        return;
      }
      // Demais erros de validação do backend (ex.: bairro não cadastrado,
      // profissional indisponível): surface a mensagem específica quando houver.
      const backendMsg = e?.response?.data?.message ?? e?.response?.data?.error;
      Alert.alert(
        "Não foi possível enviar",
        backendMsg && backendMsg !== "LIMIT_EXCEEDED"
          ? backendMsg
          : "Não foi possível criar a solicitação agora. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const ruaLinha = [
    draft.rua,
    draft.numero ? `nº ${draft.numero}` : null,
    draft.complemento || null,
  ]
    .filter(Boolean)
    .join(", ");
  const cidadeUfLinha = [draft.bairro, [draft.cidade, draft.uf].filter(Boolean).join(" - ")]
    .filter(Boolean)
    .join(", ");
  const address =
    [ruaLinha, cidadeUfLinha].filter(Boolean).join("\n") || "Endereço não informado";
  const rows = useMemo(() => {
    if (isMontador) {
      return [
        { label: "Especialidade", value: draft.especialidadeLabel ?? "Especialidade não selecionada", icon: "Wrench" as const },
        { label: "Descrição", value: draft.observacoes || "Descrição não informada.", icon: "FileText" as const },
        { label: "Data e horário", value: `${formatDate(draft.dataISO)} às ${draft.horario || "--:--"}`, icon: "Calendar" as const },
        { label: "Endereço", value: address, icon: "MapPin" as const },
        { label: "Profissional", value: draft.profissionalNome ?? "Profissional selecionado", icon: "User" as const },
      ];
    }

    return [
      { label: "Serviço", value: SERVICE_LABELS[draft.categoria], icon: "BriefcaseBusiness" as const },
      { label: "Data e horário", value: `${formatDate(draft.dataISO)} às ${draft.horario || "--:--"}`, icon: "Calendar" as const },
      { label: "Endereço", value: address, icon: "MapPin" as const },
      { label: "Observações", value: draft.observacoes || "Nenhuma observação adicionada.", icon: "FileText" as const },
    ];
  }, [address, draft, isMontador]);

  return (
    <SafeAreaView style={flowStyles.screen}>
      <ScrollView contentContainerStyle={flowStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <StepHeader
          title="Confirmar solicitação"
          subtitle="Revise tudo antes de enviar para os profissionais."
          step={5}
          total={5}
          onBack={() => navigation.goBack()}
          theme={flowTheme}
        />

        <SummaryCard rows={rows} theme={flowTheme} />

        <DCard style={[s.priceCard, { backgroundColor: flowTheme.primarySoft }]}>
          <View>
            <Text style={s.priceLabel}>Valor estimado</Text>
            <Text style={[s.priceValue, { color: flowTheme.textAccent }]}>{precoLabel}</Text>
          </View>
          <Text style={s.priceHint}>Pagamento após confirmação</Text>
        </DCard>
      </ScrollView>

      <SafeAreaView style={flowStyles.footer}>
        <FlowPrimaryButton
          label="Confirmar solicitação"
          theme={flowTheme}
          loading={submitting}
          onPress={confirmRequest}
        />
        <Text style={s.editLink} onPress={() => navigation.navigate("EscolherServico")}>Editar informações</Text>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  priceCard: {
    marginTop: 14,
    borderRadius: radius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  priceLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  priceValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
  },
  priceHint: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "right",
  },
  editLink: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
