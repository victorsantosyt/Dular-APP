import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { shadow } from "@/utils/platform";
import type { Mensagem } from "@/hooks/useChat";
import { useDularColors } from "@/hooks/useDularColors";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface MensagemBubbleProps {
  mensagem: Mensagem;
  isOwn: boolean;
  /** Cor da bolha própria (identidade de gênero). Default: roxo. */
  accent?: string;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function abrirLocalizacao(content: string) {
  try {
    const { lat, lng } = JSON.parse(content) as { lat: number; lng: number };
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  } catch {
    /* conteúdo inválido — ignora */
  }
}

/**
 * Recibo de leitura (estilo WhatsApp), só nas mensagens enviadas por mim.
 * - Otimista (id `temp-*`, ainda enviando): relógio translúcido
 * - Falhou (`status === "erro"`): texto "Falha ao enviar"
 * - Enviado (id real, readAt null): um check translúcido
 * - Lido (readAt definido): dois checks sólidos sobrepostos
 *
 * Cores vêm do tema (useDularColors) — sem hex hardcoded. As 2 variantes de
 * "minha" bolha (sólida com accent) usam tons de branco para garantir contraste.
 */
function MessageStatus({ mensagem }: { mensagem: Mensagem }) {
  const c = useDularColors();
  const isOptimistic = mensagem.id.startsWith("temp-") || mensagem.status === "enviando";

  if (mensagem.status === "erro") {
    return <Text style={[styles.statusErro, { color: c.error }]}>Falha ao enviar</Text>;
  }
  if (isOptimistic) {
    return <AppIcon name="Clock" size={11} color={c.whiteAlpha70} strokeWidth={2.4} />;
  }
  if (mensagem.readAt) {
    return (
      <View style={styles.checkRow}>
        <AppIcon name="Check" size={12} color={c.white} strokeWidth={2.6} />
        <View style={styles.checkOverlap}>
          <AppIcon name="Check" size={12} color={c.white} strokeWidth={2.6} />
        </View>
      </View>
    );
  }
  return <AppIcon name="Check" size={12} color={c.whiteAlpha70} strokeWidth={2.4} />;
}

export function MensagemBubble({ mensagem, isOwn, accent }: MensagemBubbleProps) {
  const ownBg = isOwn ? [styles.bubbleOwn, accent ? { backgroundColor: accent } : null] : null;
  const isImage = mensagem.tipo === "IMAGE";

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubble, isOwn ? ownBg : styles.bubbleOther, isImage && styles.bubbleImage]}>
        {mensagem.tipo === "IMAGE" ? (
          <Image source={{ uri: mensagem.texto }} style={styles.image} resizeMode="cover" />
        ) : mensagem.tipo === "LOCATION" ? (
          <Pressable
            onPress={() => abrirLocalizacao(mensagem.texto)}
            style={({ pressed }) => [styles.locationRow, pressed && { opacity: 0.8 }]}
          >
            <AppIcon name="MapPin" size={18} color={isOwn ? colors.white : colors.primary} strokeWidth={2.3} />
            <Text style={[styles.texto, isOwn ? styles.textoOwn : styles.textoOther, styles.locationText]}>
              Ver localização no mapa
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.texto, isOwn ? styles.textoOwn : styles.textoOther]}>
            {mensagem.texto}
          </Text>
        )}

        <View style={[styles.metaRow, isImage && styles.metaRowOnImage]}>
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {formatTime(mensagem.criadaEm)}
          </Text>
          {isOwn ? (
            <View style={styles.statusWrap}>
              <MessageStatus mensagem={mensagem} />
            </View>
          ) : null}
        </View>
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
  bubbleImage: {
    padding: 3,
    overflow: "hidden",
  },
  image: {
    width: 220,
    height: 220,
    borderRadius: RADIUS_BUBBLE - 3,
    backgroundColor: colors.background,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    textDecorationLine: "underline",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: spacing.xs,
  },
  metaRowOnImage: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
    marginTop: 0,
  },
  statusWrap: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkOverlap: {
    marginLeft: -6,
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
    textAlign: "right",
  },
  timeOwn: {
    color: colors.whiteAlpha70,
  },
  timeOther: {
    color: colors.textMuted,
  },
  statusErro: {
    ...typography.caption,
    textAlign: "right",
  },
});
