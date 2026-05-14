import React, { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { AppIcon, AppIconName } from "@/components/ui/AppIcon";
import { DCard } from "@/components/ui/DCard";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { getServiceFlowTheme, type ServiceFlowTheme } from "@/theme/serviceFlowTheme";

type StepHeaderProps = {
  title: string;
  subtitle?: string;
  step: number;
  total: number;
  onBack: () => void;
  theme?: ServiceFlowTheme;
};

export function StepHeader({ title, subtitle, step, total, onBack, theme }: StepHeaderProps) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  return (
    <View style={s.header}>
      <View style={s.headerTop}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={10}>
          <AppIcon name="ArrowLeft" size={21} color={colors.textPrimary} />
        </Pressable>
        <View style={s.stepTrack}>
          {Array.from({ length: total }).map((_, index) => (
            <View
              key={index}
              style={[
                s.stepDot,
                index + 1 <= step && {
                  width: 28,
                  backgroundColor: flowTheme.primary,
                },
              ]}
            />
          ))}
        </View>
        <View style={s.headerSpacer} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

type ServiceOptionCardProps = {
  title: string;
  subtitle: string;
  icon: AppIconName;
  selected: boolean;
  onPress: () => void;
  theme?: ServiceFlowTheme;
};

export function ServiceOptionCard({ title, subtitle, icon, selected, onPress, theme }: ServiceOptionCardProps) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  const selectedStyle: ViewStyle = {
    borderColor: flowTheme.primary,
    borderWidth: 1.8,
    backgroundColor: flowTheme.primarySoft,
  };
  return (
    <DCard
      onPress={onPress}
      style={selected ? [s.serviceCard, selectedStyle] : s.serviceCard}
    >
      <View style={[s.serviceIcon, { backgroundColor: selected ? colors.white : flowTheme.primarySoft }]}>
        <AppIcon name={icon} size={25} color={selected ? flowTheme.primary : colors.textSecondary} />
      </View>
      <View style={s.serviceText}>
        <Text style={s.serviceTitle}>{title}</Text>
        <Text style={s.serviceSubtitle}>{subtitle}</Text>
      </View>
      <View
        style={[
          s.selectMark,
          selected && {
            borderColor: flowTheme.primary,
            backgroundColor: flowTheme.primary,
          },
        ]}
      >
        {selected ? <AppIcon name="Check" size={15} color={colors.white} strokeWidth={3} /> : null}
      </View>
      <AppIcon name="ChevronRight" size={19} color={colors.textMuted} />
    </DCard>
  );
}

type TimeSlotButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme?: ServiceFlowTheme;
};

export function TimeSlotButton({ label, selected, onPress, theme }: TimeSlotButtonProps) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.timeSlot,
        selected && {
          backgroundColor: flowTheme.primary,
          borderColor: flowTheme.primary,
          shadowColor: flowTheme.primary,
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
        },
        pressed && { opacity: 0.88 },
      ]}
    >
      <Text style={[s.timeSlotText, selected && s.timeSlotTextSelected]}>{label}</Text>
    </Pressable>
  );
}

type UploadChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme?: ServiceFlowTheme;
};

export function UploadChip({ label, selected, onPress, theme }: UploadChipProps) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.chip,
        selected && {
          borderColor: flowTheme.primary,
          backgroundColor: flowTheme.primarySoft,
        },
      ]}
    >
      <Text style={[s.chipText, selected && { color: flowTheme.primary }]}>{label}</Text>
    </Pressable>
  );
}

type SummaryRow = {
  label: string;
  value: string;
  icon: AppIconName;
};

type SummaryCardProps = {
  rows: SummaryRow[];
  footer?: ReactNode;
  style?: ViewStyle;
  theme?: ServiceFlowTheme;
};

export function SummaryCard({ rows, footer, style, theme }: SummaryCardProps) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  return (
    <DCard style={style ? [s.summaryCard, style] : s.summaryCard}>
      {rows.map((row, index) => (
        <View key={row.label} style={[s.summaryRow, index > 0 && s.summaryDivider]}>
          <View style={[s.summaryIcon, { backgroundColor: flowTheme.primarySoft }]}>
            <AppIcon name={row.icon} size={18} color={flowTheme.primary} strokeWidth={2.2} />
          </View>
          <View style={s.summaryText}>
            <Text style={s.summaryLabel}>{row.label}</Text>
            <Text style={s.summaryValue}>{row.value}</Text>
          </View>
        </View>
      ))}
      {footer ? <View style={[s.summaryFooter, { backgroundColor: flowTheme.primarySoft }]}>{footer}</View> : null}
    </DCard>
  );
}

export function FlowPrimaryButton({
  label,
  onPress,
  theme,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  theme: ServiceFlowTheme;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.flowButtonShadow, { shadowColor: theme.primary }, style, disabled && s.flowButtonDisabled]}>
      <Pressable onPress={onPress} disabled={disabled || loading}>
        <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.flowButton}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={s.flowButtonText}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export function SuccessBadge({ theme }: { theme?: ServiceFlowTheme }) {
  const flowTheme = theme ?? getServiceFlowTheme("DIARISTA");
  return (
    <View style={[s.successGlow, { backgroundColor: flowTheme.primarySoft, shadowColor: flowTheme.primary }]}>
      <LinearGradient colors={flowTheme.gradient} style={s.successBadge}>
        <AppIcon name="Check" size={36} color={colors.white} strokeWidth={3} />
      </LinearGradient>
    </View>
  );
}

export const flowStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 28,
  },
  content: {
    gap: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.background,
  },
});

const s = StyleSheet.create({
  header: {
    paddingTop: 6,
    paddingBottom: spacing.lg,
  },
  headerTop: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  headerSpacer: {
    width: 40,
  },
  stepTrack: {
    flex: 1,
    maxWidth: 156,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  stepDot: {
    width: 20,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.lavenderStrong,
  },
  title: {
    marginTop: 12,
    color: colors.textPrimary,
    ...typography.h1,
    
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    ...typography.bodySm,
    
    fontWeight: "500",
  },
  serviceCard: {
    minHeight: 72,
    padding: 10,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  serviceIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderSoft,
  },
  serviceText: {
    flex: 1,
    gap: 4,
  },
  serviceTitle: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    fontWeight: "700",
  },
  serviceSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  selectMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.lavenderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  timeSlot: {
    width: "31%",
    minHeight: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  timeSlotText: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  timeSlotTextSelected: {
    color: colors.white,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
  },
  summaryCard: {
    gap: 0,
    padding: 0,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  summaryText: {
    flex: 1,
    gap: 4,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: colors.textPrimary,
    ...typography.bodySm,
    
    fontWeight: "600",
  },
  summaryFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    padding: spacing.md,
  },
  flowButtonShadow: {
    width: "88%",
    maxWidth: 336,
    alignSelf: "center",
    borderRadius: radius.pill,
    ...shadows.primaryButton,
  },
  flowButtonDisabled: {
    opacity: 0.5,
  },
  flowButton: {
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  flowButtonText: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
  },
  successGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lavenderStrong,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
