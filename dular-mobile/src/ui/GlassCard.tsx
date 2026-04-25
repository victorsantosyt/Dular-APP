/**
 * GlassCard — Card branco com sombra sutil
 * SectionTitle — Título de seção
 */

import React, { ReactNode } from "react";
import { StyleSheet, Text, View, ViewProps } from "react-native";
import { colors, radius, shadow, typography } from "@/theme/tokens";

// ── GlassCard ────────────────────────────────────────────────────────────────

type CardProps = ViewProps & { children: ReactNode };

export function GlassCard({ children, style, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[styles.card, shadow.card, style]}
    >
      {children}
    </View>
  );
}

// ── SectionTitle ─────────────────────────────────────────────────────────────

type TitleProps = {
  title: string;
  subtitle?: string;
};

export function SectionTitle({ title, subtitle }: TitleProps) {
  return (
    <View style={styles.titleWrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg, // 18px
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: 14,
  },
  titleWrap: {
    gap: 3,
  },
  title: {
    ...typography.h2, // Nunito 800, 17px
  },
  subtitle: {
    ...typography.sub, // Nunito 600, 12px, cor sub
  },
});
