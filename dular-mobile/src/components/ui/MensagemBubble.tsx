import { StyleSheet, Text, View } from "react-native";
import { shadow } from "@/utils/platform";
import type { Mensagem } from "@/hooks/useChat";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface MensagemBubbleProps {
  mensagem: Mensagem;
  isOwn: boolean;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MensagemBubble({ mensagem, isOwn }: MensagemBubbleProps) {
  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.texto, isOwn ? styles.textoOwn : styles.textoOther]}>
          {mensagem.texto}
        </Text>

        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {formatTime(mensagem.criadaEm)}
        </Text>

        {isOwn && mensagem.status === "enviando" && (
          <Text style={styles.statusEnviando}>...</Text>
        )}
        {isOwn && mensagem.status === "erro" && (
          <Text style={styles.statusErro}>Falha ao enviar</Text>
        )}
      </View>
    </View>
  );
}

export default MensagemBubble;

const RADIUS_BUBBLE = radius.lg;
const RADIUS_CORNER = radius.xs / 2;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  rowOwn: {
    justifyContent: "flex-end",
  },
  rowOther: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "75%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: RADIUS_BUBBLE,
  },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: RADIUS_CORNER,
  },
  bubbleOther: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: RADIUS_CORNER,
    ...shadow(2),
  },
  texto: {
    ...typography.body,
  },
  textoOwn: {
    color: colors.white,
  },
  textoOther: {
    color: colors.textPrimary,
  },
  time: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: "right",
  },
  timeOwn: {
    color: colors.whiteAlpha70,
  },
  timeOther: {
    color: colors.textMuted,
  },
  statusEnviando: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.6,
    textAlign: "right",
  },
  statusErro: {
    ...typography.caption,
    color: colors.error,
    textAlign: "right",
  },
});
