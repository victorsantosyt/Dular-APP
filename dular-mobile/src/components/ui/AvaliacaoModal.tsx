import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/lib/api";
import { DButton } from "@/components/ui/DButton";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface AvaliacaoModalProps {
  visible: boolean;
  servicoId: string;
  nomeAvaliado: string;
  onClose: () => void;
  onSucesso: () => void;
}

export default function AvaliacaoModal({
  visible,
  servicoId,
  nomeAvaliado,
  onClose,
  onSucesso,
}: AvaliacaoModalProps) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (nota === 0 || enviando) return;
    setEnviando(true);
    try {
      await api.post(`/api/servicos/${servicoId}/avaliar`, {
        nota,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      });
      setNota(0);
      setComentario("");
      onSucesso();
    } catch {
      Alert.alert("Erro", "Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <Text style={s.title}>Avaliar {nomeAvaliado}</Text>

          {/* Stars */}
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setNota(n)} hitSlop={8}>
                <Text style={[s.star, nota >= n && s.starFilled]}>
                  {nota >= n ? "★" : "☆"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Comment */}
          <TextInput
            value={comentario}
            onChangeText={(t) => setComentario(t.slice(0, 300))}
            placeholder="Deixe um comentário..."
            placeholderTextColor={colors.textMuted}
            multiline
            style={s.input}
          />
          <Text style={s.charCount}>{comentario.length}/300</Text>

          {/* Buttons */}
          <View style={s.btns}>
            <DButton
              label="Cancelar"
              onPress={onClose}
              variant="outline"
              style={s.btnHalf}
            />
            <DButton
              label="Enviar"
              onPress={handleEnviar}
              loading={enviando}
              disabled={nota === 0}
              style={s.btnHalf}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  star: {
    fontSize: 36,
    color: colors.textMuted,
  },
  starFilled: {
    color: colors.warning,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 80,
    color: colors.textPrimary,
    ...typography.body,
    textAlignVertical: "top",
  },
  charCount: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: -spacing.sm,
  },
  btns: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  btnHalf: {
    flex: 1,
  },
});
