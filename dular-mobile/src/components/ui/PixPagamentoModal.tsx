import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { AppIcon } from "@/components/ui/AppIcon";
import { DButton } from "@/components/ui/DButton";
import { useDularColors } from "@/hooks/useDularColors";
import { radius, spacing, typography } from "@/theme";
import { formatPrice } from "@/utils/formatPrice";
import { apiMsg } from "@/utils/apiMsg";
import {
  gerarPix,
  informarPagamento,
  registrarPixCopiado,
  type PixGerado,
} from "@/api/pagamentoApi";

export type PixPagamentoModalProps = {
  visible: boolean;
  servicoId: string;
  /** Cor de acento (tema do papel). */
  accent?: string;
  onClose: () => void;
  /** Chamado após o empregador informar o pagamento com sucesso. */
  onPagamentoInformado: () => void;
};

/**
 * Modal "Pagamento via PIX" do empregador: QR Code + Copia e Cola gerados
 * pelo backend (valor = precoFinal congelado do serviço; TxId = id do
 * serviço). O app nunca monta valor nem chave.
 */
export function PixPagamentoModal({
  visible,
  servicoId,
  accent,
  onClose,
  onPagamentoInformado,
}: PixPagamentoModalProps) {
  const colors = useDularColors();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const [pix, setPix] = useState<PixGerado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let ativo = true;
    setPix(null);
    setErro(null);
    setCopiado(false);
    setCarregando(true);
    (async () => {
      try {
        const gerado = await gerarPix(servicoId);
        if (ativo) setPix(gerado);
      } catch (e) {
        if (ativo) setErro(apiMsg(e, "Não foi possível gerar o PIX."));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [visible, servicoId]);

  const copiar = useCallback(async () => {
    if (!pix) return;
    await Clipboard.setStringAsync(pix.copiaECola);
    setCopiado(true);
    void registrarPixCopiado(servicoId);
  }, [pix, servicoId]);

  const jaRealizei = useCallback(() => {
    Alert.alert("Confirmar pagamento", "Confirma que realizou o pagamento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setEnviando(true);
          setErro(null);
          try {
            await informarPagamento(servicoId);
            onPagamentoInformado();
          } catch (e) {
            setErro(apiMsg(e, "Não foi possível informar o pagamento."));
          } finally {
            setEnviando(false);
          }
        },
      },
    ]);
  }, [servicoId, onPagamentoInformado]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            <View style={s.header}>
              <Text style={s.title}>Pagamento via PIX</Text>
              <Pressable onPress={onClose} hitSlop={16} style={{ padding: 6 }}>
                <AppIcon name="XCircle" size={23} color={colors.textSecondary} />
              </Pressable>
            </View>

            {carregando ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color={accent ?? colors.primary} />
              </View>
            ) : pix ? (
              <>
                <View style={s.infoBox}>
                  <Text style={s.infoLine}>
                    Profissional: <Text style={s.infoStrong}>{pix.profissional.nome}</Text>
                  </Text>
                  <Text style={s.infoLine}>
                    Valor:{" "}
                    <Text style={[s.infoStrong, { color: colors.success }]}>
                      {formatPrice(pix.valorCentavos)}
                    </Text>
                  </Text>
                  {pix.banco ? <Text style={s.infoMuted}>Banco: {pix.banco}</Text> : null}
                  <Text style={s.infoMuted}>Chave: {pix.chaveMascarada}</Text>
                </View>

                <View style={s.qrBox}>
                  <QRCode value={pix.copiaECola} size={190} />
                </View>

                <Text style={s.payload} numberOfLines={3}>
                  {pix.copiaECola}
                </Text>

                <DButton
                  label={copiado ? "Código copiado!" : "Copiar código"}
                  onPress={copiar}
                  variant="outline"
                  tint={accent}
                  flat
                  icon={<AppIcon name="Copy" size={16} color={accent ?? colors.primary} />}
                />
                <DButton
                  label="Já realizei o pagamento"
                  onPress={jaRealizei}
                  loading={enviando}
                  tint={accent}
                  flat
                  style={s.confirmBtn}
                />
              </>
            ) : null}

            {erro ? <Text style={s.erro}>{erro}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default PixPagamentoModal;

function makeStyles(colors: ReturnType<typeof useDularColors>) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: "90%",
    },
    content: { padding: spacing.lg, gap: spacing.sm },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    title: { ...typography.h3, color: colors.textPrimary, fontWeight: "700" },
    center: { paddingVertical: spacing["3xl"], alignItems: "center" },
    infoBox: {
      borderRadius: radius.md,
      backgroundColor: colors.background,
      padding: spacing.md,
      gap: 3,
    },
    infoLine: { ...typography.bodySm, color: colors.textPrimary, fontWeight: "600" },
    infoStrong: { fontWeight: "800" },
    infoMuted: { ...typography.caption, color: colors.textSecondary },
    qrBox: {
      alignSelf: "center",
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: "#FFFFFF",
      marginVertical: spacing.xs,
    },
    payload: {
      ...typography.caption,
      color: colors.textMuted,
      backgroundColor: colors.background,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },
    confirmBtn: { marginTop: 2 },
    erro: { ...typography.caption, color: colors.error, fontWeight: "700", marginTop: 4 },
  });
}
