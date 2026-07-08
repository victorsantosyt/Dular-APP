import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIcon } from "@/components/ui/AppIcon";
import { DButton } from "@/components/ui/DButton";
import { PixPagamentoModal } from "@/components/ui/PixPagamentoModal";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, spacing, typography } from "@/theme";
import { formatPrice } from "@/utils/formatPrice";
import { apiMsg } from "@/utils/apiMsg";
import { platformSelect } from "@/utils/platform";
import {
  confirmarRecebimento,
  contestarRecebimento,
  type PaymentStatus,
} from "@/api/pagamentoApi";

export type PagamentoChatBannerProps = {
  servicoId: string;
  /** Papel do usuário logado nesta conversa. */
  papel: "EMPREGADOR" | "PROFISSIONAL";
  paymentStatus: PaymentStatus | null;
  precoFinal: number | null;
  profissionalTemPix: boolean;
  /** Cor de acento (tema do papel). */
  accent?: string;
  /** Re-busca a sala após uma mudança de estado (o polling de 8s também cobre). */
  onChange: () => void;
};

/**
 * Banner condicional de pagamento no chat.
 *
 * EMPREGADOR: "Pagamento — [Pagar com PIX]" quando o serviço está contratado,
 * o profissional tem chave PIX e o pagamento está pendente/contestado.
 * PROFISSIONAL: quando o empregador informa o pagamento, oferece
 * [Confirmar recebimento] / [Ainda não recebi] (com motivo).
 */
export function PagamentoChatBanner({
  servicoId,
  papel,
  paymentStatus,
  precoFinal,
  profissionalTemPix,
  accent,
  onChange,
}: PagamentoChatBannerProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [pixVisible, setPixVisible] = useState(false);
  const [contestarVisible, setContestarVisible] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = useCallback(() => {
    Alert.alert("Confirmar recebimento", "Você confirma que recebeu o pagamento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setEnviando(true);
          setErro(null);
          try {
            await confirmarRecebimento(servicoId);
            onChange();
          } catch (e) {
            setErro(apiMsg(e, "Não foi possível confirmar."));
          } finally {
            setEnviando(false);
          }
        },
      },
    ]);
  }, [servicoId, onChange]);

  const enviarContestacao = useCallback(async () => {
    if (motivo.trim().length < 3) {
      setErro("Descreva o motivo (ex.: valor não caiu na conta).");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await contestarRecebimento(servicoId, motivo.trim());
      setContestarVisible(false);
      setMotivo("");
      onChange();
    } catch (e) {
      setErro(apiMsg(e, "Não foi possível enviar."));
    } finally {
      setEnviando(false);
    }
  }, [servicoId, motivo, onChange]);

  // ── EMPREGADOR: CTA de pagamento ───────────────────────────────────────────
  if (papel === "EMPREGADOR") {
    const pagavel =
      paymentStatus === "WAITING_PAYMENT" || paymentStatus === "PAYMENT_DISPUTED";
    if (!pagavel || !profissionalTemPix) return null;

    return (
      <View style={s.banner}>
        <View style={s.bannerTextCol}>
          <Text style={s.bannerTitle}>Pagamento</Text>
          <Text style={s.bannerSubtitle}>
            {paymentStatus === "PAYMENT_DISPUTED"
              ? "O profissional ainda não recebeu — pague novamente."
              : precoFinal != null
                ? formatPrice(precoFinal)
                : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => setPixVisible(true)}
          style={[s.payBtn, { backgroundColor: accent ?? colors.primary }]}
        >
          <AppIcon name="QrCode" size={16} color={colors.white} strokeWidth={2.4} />
          <Text style={s.payBtnText}>Pagar com PIX</Text>
        </Pressable>

        <PixPagamentoModal
          visible={pixVisible}
          servicoId={servicoId}
          accent={accent}
          onClose={() => setPixVisible(false)}
          onPagamentoInformado={() => {
            setPixVisible(false);
            onChange();
          }}
        />
      </View>
    );
  }

  // ── PROFISSIONAL: confirmação de recebimento ───────────────────────────────
  if (paymentStatus !== "PAYMENT_REPORTED") return null;

  return (
    <View style={s.bannerCol}>
      <Text style={s.bannerTitle}>O empregador informou que realizou o pagamento.</Text>
      {erro ? <Text style={s.erro}>{erro}</Text> : null}
      <View style={s.btnRow}>
        <DButton
          label="Confirmar recebimento"
          onPress={confirmar}
          loading={enviando}
          tint={accent}
          flat
          size="sm"
          style={s.btnHalf}
        />
        <DButton
          label="Ainda não recebi"
          onPress={() => setContestarVisible(true)}
          variant="outline"
          tint={accent}
          flat
          size="sm"
          style={s.btnHalf}
        />
      </View>

      <Modal
        visible={contestarVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setContestarVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={platformSelect({ ios: "padding", android: undefined })}
        >
          <SafeAreaView style={s.sheet} edges={["bottom"]}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Ainda não recebi</Text>
              <Pressable
                onPress={() => setContestarVisible(false)}
                hitSlop={16}
                style={{ padding: 6 }}
              >
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={s.sheetLabel}>Motivo</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Conte o que aconteceu (ex.: o valor não caiu na conta)."
              placeholderTextColor={colors.textMuted}
              style={s.sheetInput}
              multiline
              maxLength={500}
            />
            {erro ? <Text style={s.erro}>{erro}</Text> : null}
            <View style={s.btnRow}>
              <DButton
                label="Cancelar"
                onPress={() => setContestarVisible(false)}
                variant="outline"
                tint={accent}
                flat
                style={s.btnHalf}
              />
              <DButton
                label="Enviar"
                onPress={enviarContestacao}
                loading={enviando}
                tint={accent}
                flat
                style={s.btnHalf}
              />
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {enviando && !contestarVisible ? (
        <ActivityIndicator color={accent ?? colors.primary} />
      ) : null}
    </View>
  );
}

export default PagamentoChatBanner;

function makeStyles(colors: ReturnType<typeof useDularColors>) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: 2,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerCol: {
      gap: spacing.sm,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: 2,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerTextCol: { flex: 1, gap: 1 },
    bannerTitle: { ...typography.bodySmMedium, color: colors.textPrimary, fontWeight: "700" },
    bannerSubtitle: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
    payBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.pill,
    },
    payBtnText: { ...typography.caption, color: colors.white, fontWeight: "800" },
    btnRow: { flexDirection: "row", gap: spacing.sm },
    btnHalf: { flex: 1 },
    erro: { ...typography.caption, color: colors.error, fontWeight: "700" },
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    sheetTitle: { ...typography.h3, color: colors.textPrimary, fontWeight: "700" },
    sheetLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "700" },
    sheetInput: {
      minHeight: 90,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: 10,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      fontSize: 15,
      fontWeight: "600",
      textAlignVertical: "top",
    },
  });
}
