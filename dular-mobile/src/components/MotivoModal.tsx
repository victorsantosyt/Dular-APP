/**
 * MotivoModal — Modal de motivo para cancelar/recusar serviço.
 *
 * Reutilizável entre empregador, diarista e montador.
 * Layout: bottom sheet com lista de motivos + observação opcional.
 */

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/theme/tokens";

// Mantido em sincronia com shared/types/servico.ts (MOTIVOS_CANCELAMENTO).
// Inline no mobile porque o Metro não resolve imports cross-package sem
// configuração de watchFolders.
const MOTIVOS_CANCELAMENTO = [
  { value: "indisponibilidade", label: "Indisponibilidade" },
  { value: "endereco_incompativel", label: "Endereço/área incompatível" },
  { value: "comportamento_inadequado", label: "Comportamento inadequado" },
  { value: "problema_seguranca", label: "Problema de segurança" },
  { value: "outro", label: "Outro" },
] as const;

export interface MotivoModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (motivo: string, observacao: string) => Promise<void>;
  confirmLabel?: string;
}

export function MotivoModal({
  visible,
  title,
  onClose,
  onConfirm,
  confirmLabel = "Confirmar",
}: MotivoModalProps) {
  const [motivo, setMotivo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const slide = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      setMotivo(null);
      setObservacao("");
      setEnviando(false);
      Animated.timing(slide, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      slide.setValue(0);
    }
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const opacity = slide;

  const handleConfirm = async () => {
    if (!motivo || enviando) return;
    setEnviando(true);
    try {
      await onConfirm(motivo, observacao.trim());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={enviando ? undefined : onClose} />
        <Animated.View style={[s.sheetWrap, { transform: [{ translateY }], opacity }]}>
          <SafeAreaView style={s.sheet} edges={["bottom"]}>
            <View style={s.handle} />
            <Text style={s.title}>{title}</Text>
            <Text style={s.subtitle}>Selecione um motivo para continuar.</Text>

            <View style={s.options}>
              {MOTIVOS_CANCELAMENTO.map((opt) => {
                const selected = motivo === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setMotivo(opt.value)}
                    disabled={enviando}
                    style={({ pressed }) => [
                      s.option,
                      selected && s.optionSelected,
                      pressed && !enviando && { opacity: 0.85 },
                    ]}
                  >
                    <View style={[s.radio, selected && s.radioSelected]}>
                      {selected ? <View style={s.radioDot} /> : null}
                    </View>
                    <Text style={[s.optionText, selected && s.optionTextSelected]} numberOfLines={2}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={observacao}
              onChangeText={(t) => setObservacao(t.slice(0, 240))}
              placeholder="Observação (opcional)"
              placeholderTextColor={colors.textMuted}
              multiline
              editable={!enviando}
              style={s.input}
            />
            <Text style={s.charCount}>{observacao.length}/240</Text>

            <View style={s.btns}>
              <Pressable
                onPress={onClose}
                disabled={enviando}
                style={({ pressed }) => [s.btn, s.btnCancel, pressed && !enviando && { opacity: 0.85 }]}
              >
                <Text style={s.btnCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={!motivo || enviando}
                style={({ pressed }) => [
                  s.btn,
                  s.btnConfirm,
                  (!motivo || enviando) && s.btnDisabled,
                  pressed && motivo && !enviando && { opacity: 0.9 },
                ]}
              >
                {enviando ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={s.btnConfirmText}>{confirmLabel}</Text>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default MotivoModal;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    width: "100%",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  options: {
    gap: 8,
    marginTop: 4,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderSoft,
  },
  optionText: {
    flex: 1,
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 64,
    color: colors.textPrimary,
    ...typography.bodySm,
    textAlignVertical: "top",
    marginTop: spacing.xs,
  },
  charCount: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: -4,
  },
  btns: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  btnCancel: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnCancelText: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  btnConfirm: {
    backgroundColor: colors.primary,
  },
  btnConfirmText: {
    color: colors.white,
    ...typography.bodySm,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
