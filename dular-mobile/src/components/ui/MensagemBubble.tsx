import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { shadow } from "@/utils/platform";
import type { Mensagem } from "@/hooks/useChat";
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

        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther, isImage && styles.timeOnImage]}>
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
  timeOnImage: {
    position: "absolute",
    right: 8,
    bottom: 8,
    color: colors.white,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
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
