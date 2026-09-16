/**
 * SosEmergenciaModal — contagem regressiva antes de ligar para o 190.
 *
 * Usado com `useSosEmergencia`: fica visível enquanto a contagem corre.
 * O texto diz que a ligação é para a Polícia Militar, e não para a Dular,
 * e não promete acompanhamento nem retorno.
 */

import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface SosEmergenciaModalProps {
  /** null = sem contagem (modal fechado). */
  segundosRestantes: number | null;
  onCancelar: () => void;
}

export function SosEmergenciaModal({ segundosRestantes, onCancelar }: SosEmergenciaModalProps) {
  const visivel = segundosRestantes !== null;
  const segundos = segundosRestantes ?? 0;

  return (
    // Botão voltar do Android também cancela.
    <Modal visible={visivel} animationType="fade" transparent onRequestClose={onCancelar}>
      <View style={s.overlay}>
        <SafeAreaView style={s.card} edges={["bottom"]}>
          <Text style={s.titulo}>Ligar para a Polícia Militar (190)</Text>

          <View style={s.contador} accessibilityLiveRegion="polite">
            <Text style={s.numero}>{segundos}</Text>
          </View>

          <Text style={s.texto}>
            Em {segundos} {segundos === 1 ? "segundo" : "segundos"}, o telefone vai abrir a ligação para o 190, da
            Polícia Militar.
          </Text>
          <Text style={s.aviso}>Esta ligação não é para a Dular. Se tocou sem querer, cancele.</Text>

          <Pressable
            onPress={onCancelar}
            accessibilityRole="button"
            accessibilityLabel="Cancelar a ligação para o 190"
            hitSlop={8}
            style={({ pressed }) => [s.botaoCancelar, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.botaoCancelarTexto}>Cancelar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default SosEmergenciaModal;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    alignItems: "center",
  },
  titulo: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
  },
  contador: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.xs,
  },
  numero: {
    fontSize: 44,
    fontWeight: "800",
    color: colors.danger,
  },
  texto: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: "center",
  },
  aviso: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: "center",
  },
  botaoCancelar: {
    alignSelf: "stretch",
    minHeight: 56,
    marginTop: spacing.sm,
    borderRadius: radius.btn,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  botaoCancelarTexto: {
    ...typography.body,
    color: colors.white,
    fontWeight: "800",
  },
});
