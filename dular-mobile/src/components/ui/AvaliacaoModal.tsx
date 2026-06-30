import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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
  /**
   * Rota de avaliação. Default = empregador→profissional (`/avaliar`).
   * O profissional avaliando o empregador passa `/avaliar-empregador`.
   */
  endpoint?: string;
  /**
   * Cor de acento (identidade por gênero/perfil) aplicada aos botões.
   * Omitida = roxo padrão do empregador. Os perfis profissionais
   * (diarista/montador) passam a cor do seu tema para seguir o padrão do app.
   */
  accent?: string;
}

export default function AvaliacaoModal({
  visible,
  servicoId,
  nomeAvaliado,
  onClose,
  onSucesso,
  endpoint,
  accent,
}: AvaliacaoModalProps) {
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleEnviar = async () => {
    if (nota === 0 || enviando) return;
    setEnviando(true);
    try {
      // O backend (avaliarServicoSchema) exige as quatro dimensões como
      // inteiros 1–5. Este modal usa uma nota única (estrelas), então
      // replicamos o valor nas quatro dimensões para satisfazer o contrato.
      await api.post(endpoint ?? `/api/servicos/${servicoId}/avaliar`, {
        notaGeral: nota,
        pontualidade: nota,
        qualidade: nota,
        comunicacao: nota,
        ...(comentario.trim() ? { comentario: comentario.trim() } : {}),
      });
      setNota(0);
      setComentario("");
      onSucesso();
    } catch (e: any) {
      const backendMsg = e?.response?.data?.error ?? e?.response?.data?.message;
      Alert.alert(
        "Não foi possível avaliar",
        typeof backendMsg === "string" && backendMsg.length > 0
          ? backendMsg
          : "Erro ao enviar avaliação. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* KeyboardAvoidingView sobe a folha junto com o teclado; o ScrollView
          (keyboardShouldPersistTaps) mantém estrelas e "Enviar" acessíveis com
          o teclado aberto, sem precisar fechá-lo antes. */}
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.sheetContent}
          >
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
                tint={accent}
                style={s.btnHalf}
              />
              <DButton
                label="Enviar"
                onPress={handleEnviar}
                loading={enviando}
                disabled={nota === 0}
                tint={accent}
                style={s.btnHalf}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
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
    // Limita a folha para que, com o teclado aberto, o conteúdo role em vez de
    // estourar a tela.
    maxHeight: "88%",
  },
  sheetContent: {
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
