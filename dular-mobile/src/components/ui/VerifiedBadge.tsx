/**
 * VerifiedBadge — selo de conta verificada (estilo "selo azul" do Instagram):
 * círculo preenchido + check branco. Padrão único, usado nos cards de perfil
 * dos 3 papéis para manter consistência em ambos os lados do marketplace.
 *
 * `tier` deixa pronto o futuro: "verified" (padrão, azul), "gold" (assinante
 * mensal) e "black" (assinante anual). Por ora só "verified" é acionado.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { AppIcon } from "@/components/ui/AppIcon";
import { useDularColors } from "@/hooks/useDularColors";

export type VerifiedTier = "verified" | "gold" | "black";

export function VerifiedBadge({ size = 18, tier = "verified" }: { size?: number; tier?: VerifiedTier }) {
  const colors = useDularColors();
  const bg =
    tier === "gold" ? colors.verifiedGold : tier === "black" ? colors.verifiedBlack : colors.verified;
  const inner = Math.round(size * 0.62);
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <AppIcon name="Check" size={inner} color={colors.white} strokeWidth={3.4} />
    </View>
  );
}

export default VerifiedBadge;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
