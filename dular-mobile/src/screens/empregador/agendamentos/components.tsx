import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName, DAvatar } from "@/components/ui";
import { DCard } from "@/components/ui/DCard";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";

export type CategoriaFiltro = "todas" | "diarista" | "baba" | "cozinheira" | "exp";
export type StatusFiltro = "todas" | "aceitas" | "andamento" | "concluidas" | "canceladas";
export type StatusAgendamento = "pendente" | "aceita" | "andamento" | "concluida" | "cancelada";

export type AgendamentoItem = {
  id: string;
  nome: string;
  status: StatusAgendamento;
  idade: string;
  categoria: string;
  categoriaKey: CategoriaFiltro;
  categoriaIcon: AppIconName;
  local: string;
  data: string;
  horario: string;
  nota: string;
  experiencia: string;
  valor: string;
  avatarUrl?: string;
};

export const CATEGORIAS: Array<{ label: string; value: CategoriaFiltro; icon: AppIconName }> = [
  { label: "Todas", value: "todas", icon: "Grid2x2" },
  { label: "Diarista", value: "diarista", icon: "BrushCleaning" },
  { label: "Babá", value: "baba", icon: "Baby" },
  { label: "Cozinheira", value: "cozinheira", icon: "ChefHat" },
  { label: "Exp", value: "exp", icon: "UserRound" },
];

export const STATUS_FILTERS: Array<{ label: string; value: StatusFiltro; color?: string }> = [
  { label: "Todas", value: "todas" },
  { label: "Aceitas", value: "aceitas", color: colors.success },
  { label: "Em andamento", value: "andamento", color: colors.primary },
  { label: "Concluídas", value: "concluidas", color: colors.textMuted },
  { label: "Canceladas", value: "canceladas", color: colors.danger },
];

const STATUS_FILTER_MAP: Record<Exclude<StatusFiltro, "todas">, StatusAgendamento> = {
  aceitas: "aceita",
  andamento: "andamento",
  concluidas: "concluida",
  canceladas: "cancelada",
};

const STATUS_UI: Record<
  StatusAgendamento,
  {
    label: string;
    button: string;
    color: string;
    bg: string;
    actionBg?: string;
    actionColor: string;
    actionIcon: AppIconName;
    actionGradient?: boolean;
  }
> = {
  pendente: {
    label: "Pendente",
    button: "Aguardando",
    color: colors.warning,
    bg: colors.warningSoft,
    actionBg: "#FFE0BA",
    actionColor: colors.warning,
    actionIcon: "Hourglass",
  },
  aceita: {
    label: "Aceita",
    button: "Confirmado",
    color: colors.white,
    bg: colors.success,
    actionColor: colors.white,
    actionIcon: "CheckCircle",
    actionGradient: true,
  },
  andamento: {
    label: "Em andamento",
    button: "Em andamento",
    color: colors.primary,
    bg: colors.lavenderSoft,
    actionBg: colors.lavender,
    actionColor: colors.primary,
    actionIcon: "Clock3",
  },
  concluida: {
    label: "Concluída",
    button: "Concluído",
    color: colors.textSecondary,
    bg: colors.lavenderSoft,
    actionBg: colors.lavenderSoft,
    actionColor: colors.textSecondary,
    actionIcon: "CheckCircle",
  },
  cancelada: {
    label: "Cancelada",
    button: "Cancelado",
    color: colors.danger,
    bg: colors.dangerSoft,
    actionBg: colors.dangerSoft,
    actionColor: colors.danger,
    actionIcon: "XCircle",
  },
};

export function statusMatchesFilter(item: AgendamentoItem, status: StatusFiltro) {
  return status === "todas" || item.status === STATUS_FILTER_MAP[status];
}

export function CategoryChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: AppIconName;
  active: boolean;
  onPress: () => void;
}) {
  if (active) {
    return (
      <Pressable onPress={onPress}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.categoryActive}>
          <AppIcon name={icon} size={14} color={colors.white} strokeWidth={2.3} />
          <Text style={s.categoryActiveText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.categoryIdle, pressed && { opacity: 0.78 }]}>
      <AppIcon name={icon} size={14} color={colors.primary} strokeWidth={2.2} />
      <Text style={s.categoryIdleText}>{label}</Text>
    </Pressable>
  );
}

export function StatusChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.statusChip, active && s.statusChipActive, pressed && { opacity: 0.8 }]}>
      {color ? <View style={[s.statusDot, { backgroundColor: color }]} /> : null}
      <Text style={[s.statusChipText, active && s.statusChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function StatusFilterBar({ children }: { children: React.ReactNode }) {
  return <View style={s.statusBar}>{children}</View>;
}

export function AppointmentCard({ item }: { item: AgendamentoItem }) {
  const status = STATUS_UI[item.status];
  const firstName = item.nome.split(" ")[0];

  return (
    <DCard style={s.card}>
      {/* Avatar column: badge above photo */}
      <View style={s.leftCol}>
        <View style={[s.floatingBadge, { backgroundColor: status.bg }]}>
          <Text style={[s.floatingBadgeText, { color: status.color }]}>{status.label}</Text>
        </View>
        <DAvatar size="md" uri={item.avatarUrl} />
      </View>

      <View style={s.centerCol}>
        <Text style={s.name} numberOfLines={1}>{firstName}</Text>
        <Text style={s.age}>{item.idade}</Text>

        <View style={s.categoryPill}>
          <AppIcon name={item.categoriaIcon} size={12} color={colors.primary} strokeWidth={2.1} />
          <Text style={s.categoryPillText}>{item.categoria}</Text>
        </View>

        <View style={s.inlineRow}>
          <AppIcon name="MapPin" size={13} color={colors.textMuted} strokeWidth={2.1} />
          <Text style={s.metaText} numberOfLines={1}>{item.local}</Text>
        </View>

        <View style={s.inlineRow}>
          <AppIcon name="Calendar" size={13} color={colors.textMuted} strokeWidth={2.1} />
          <Text style={s.metaText} numberOfLines={1}>
            {item.data} • {item.horario}
          </Text>
        </View>

        <View style={s.inlineRow}>
          <AppIcon name="Star" size={13} color={colors.warning} strokeWidth={2.2} />
          <Text style={s.metaStrong}>{item.nota}</Text>
          <Text style={s.metaMuted}>•</Text>
          <Text style={s.metaText}>{item.experiencia}</Text>
        </View>

        <Text style={s.value}>{item.valor}</Text>
      </View>

      <View style={s.rightCol}>
        {status.actionGradient ? (
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.statusButton}>
            <AppIcon name={status.actionIcon} size={15} color={colors.white} strokeWidth={2.5} />
            <Text style={[s.statusButtonText, { color: colors.white }]}>{status.button}</Text>
          </LinearGradient>
        ) : (
          <View style={[s.statusButton, { backgroundColor: status.actionBg }]}>
            <AppIcon name={status.actionIcon} size={15} color={status.actionColor} strokeWidth={2.3} />
            <Text style={[s.statusButtonText, { color: status.actionColor }]}>{status.button}</Text>
          </View>
        )}
        <Pressable
          onPress={() => Alert.alert("Agendamentos", "Detalhes do agendamento em breve.")}
          style={({ pressed }) => [s.detailsButton, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.detailsText}>Ver detalhes</Text>
        </Pressable>
      </View>
    </DCard>
  );
}

export function BottomInfoBanner({ onPress }: { onPress: () => void }) {
  return (
    <DCard style={s.banner}>
      <View style={s.bannerIcon}>
        <AppIcon name="CalendarCheck" size={28} color={colors.primary} strokeWidth={2.1} />
      </View>
      <View style={s.bannerCopy}>
        <Text style={s.bannerTitle}>Precisou mudar algo?</Text>
        <Text style={s.bannerSubtitle}>Você pode reagendar ou cancelar seus serviços facilmente.</Text>
      </View>
      <Pressable onPress={onPress} style={({ pressed }) => [s.bannerButton, pressed && { opacity: 0.82 }]}>
        <Text style={s.bannerButtonText}>Ver histórico</Text>
      </Pressable>
    </DCard>
  );
}

const s = StyleSheet.create({
  categoryActive: {
    minHeight: 28,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    ...shadows.primaryButton,
  },
  categoryIdle: {
    minHeight: 28,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  categoryActiveText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "700",
  },
  categoryIdleText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "600",
  },
  statusBar: {
    minHeight: 32,
    borderRadius: radius.lg,
    paddingHorizontal: 4,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  statusChip: {
    minHeight: 22,
    borderRadius: radius.md,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderSoft,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
  },
  statusChipTextActive: {
    color: colors.primary,
  },
  card: {
    borderRadius: radius.lg,
    padding: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  leftCol: {
    width: 60,
    alignItems: "center",
    gap: 6,
    paddingTop: 2,
  },
  floatingBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  centerCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    color: colors.textPrimary,
    ...typography.bodySmMedium,
    
    fontWeight: "700",
  },
  age: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "500",
    
    marginTop: -2,
  },
  categoryPill: {
    alignSelf: "flex-start",
    minHeight: 18,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.lavenderSoft,
  },
  categoryPillText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  metaStrong: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "600",
  },
  metaMuted: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "600",
  },
  value: {
    color: colors.primary,
    ...typography.bodySmMedium,
    fontWeight: "700",
    marginTop: 2,
  },
  rightCol: {
    width: 84,
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 7,
  },
  statusButton: {
    minHeight: 28,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 4,
  },
  statusButtonText: {
    ...typography.caption,
    fontWeight: "700",
    textAlign: "center",
  },
  detailsButton: {
    minHeight: 28,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: colors.lavenderStrong,
    backgroundColor: colors.surface,
  },
  detailsText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "700",
    textAlign: "center",
  },
  banner: {
    marginTop: 0,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: colors.lavenderSoft,
    borderColor: colors.lavenderDivider,
  },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  bannerCopy: {
    flex: 1,
    gap: 3,
  },
  bannerTitle: {
    color: colors.textPrimary,
    ...typography.bodySm,
    fontWeight: "700",
  },
  bannerSubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    
    fontWeight: "500",
  },
  bannerButton: {
    minHeight: 31,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    backgroundColor: colors.primary,
  },
  bannerButtonText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "700",
  },
});
