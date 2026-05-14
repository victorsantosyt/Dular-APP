import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, AppIconName, DAvatar } from "@/components/ui";
import { DCard } from "@/components/ui/DCard";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";

export type CategoriaFiltro = "todas" | "diarista" | "baba" | "cozinheira" | "montador";
export type StatusFiltro = "todas" | "pendentes" | "aceitas" | "andamento" | "concluidas" | "canceladas";
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
  observacao?: string | null;
  avatarUrl?: string;
};

export const CATEGORIAS: Array<{ label: string; value: CategoriaFiltro; icon: AppIconName }> = [
  { label: "Todas", value: "todas", icon: "Grid2x2" },
  { label: "Diarista", value: "diarista", icon: "BrushCleaning" },
  { label: "Babá", value: "baba", icon: "Baby" },
  { label: "Cozinheira", value: "cozinheira", icon: "ChefHat" },
  { label: "Montador", value: "montador", icon: "Wrench" },
];

export const STATUS_FILTERS: Array<{ label: string; value: StatusFiltro; color?: string }> = [
  { label: "Todas", value: "todas" },
  { label: "Pendentes", value: "pendentes", color: colors.warning },
  { label: "Aceitas", value: "aceitas", color: colors.success },
  { label: "Em andamento", value: "andamento", color: colors.primary },
  { label: "Concluídas", value: "concluidas", color: colors.textMuted },
  { label: "Canceladas", value: "canceladas", color: colors.danger },
];

const STATUS_FILTER_MAP: Record<Exclude<StatusFiltro, "todas">, StatusAgendamento> = {
  pendentes: "pendente",
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

export function AppointmentCard({ item, onDetails }: { item: AgendamentoItem; onDetails?: () => void }) {
  const status = STATUS_UI[item.status];
  const firstName = item.nome.split(" ")[0];
  const valorLabel = item.valor === "A combinar" ? "A combinar!" : item.valor;
  const dateLine = item.horario && item.horario !== "Horário a combinar"
    ? `${item.data} (${item.horario.toLowerCase()})`
    : item.data;

  return (
    <DCard style={s.card}>
      <View style={s.mainRow}>
        <View style={s.contentCol}>
          <Text allowFontScaling={false} style={s.name} numberOfLines={1}>{firstName}</Text>

          <View style={s.categoryPill}>
            <AppIcon name={item.categoriaIcon} size={12} color={colors.primary} strokeWidth={2.2} />
            <Text allowFontScaling={false} style={s.categoryPillText} numberOfLines={1}>{item.categoria}</Text>
          </View>

          <View style={s.metaStack}>
            <View style={s.inlineRow}>
              <AppIcon name="MapPin" size={14} color={colors.textMuted} strokeWidth={2.1} />
              <Text allowFontScaling={false} style={s.metaText} numberOfLines={1}>{item.local}</Text>
            </View>
            <View style={s.inlineRow}>
              <AppIcon name="Calendar" size={14} color={colors.textMuted} strokeWidth={2.1} />
              <Text allowFontScaling={false} style={s.metaText} numberOfLines={1}>{dateLine}</Text>
            </View>
            <View style={s.inlineRow}>
              <AppIcon name="Star" size={14} color={colors.warning} strokeWidth={2.2} />
              <Text allowFontScaling={false} style={s.metaStrong}>{item.nota}</Text>
              <Text allowFontScaling={false} style={s.metaMuted}>•</Text>
              <Text allowFontScaling={false} style={s.metaText} numberOfLines={1}>{item.experiencia}</Text>
            </View>
          </View>

          <View style={s.divider} />

          <Text allowFontScaling={false} style={s.observacao} numberOfLines={2}>
            {item.observacao || item.idade}
          </Text>
        </View>

        <View style={s.visualCol}>
          <View style={s.avatarRing}>
            <DAvatar size="lg" uri={item.avatarUrl} />
          </View>
          <View
            style={[
              s.statusPillCard,
              { backgroundColor: item.status === "pendente" ? "#FFF1E2" : status.bg },
            ]}
          >
            <AppIcon
              name={status.actionIcon}
              size={13}
              color={item.status === "pendente" ? "#E98A15" : status.actionColor}
              strokeWidth={2.4}
            />
            <Text
              allowFontScaling={false}
              style={[
                s.statusPillText,
                { color: item.status === "pendente" ? "#E98A15" : status.actionColor },
              ]}
              numberOfLines={1}
            >
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.actionsRow}>
        <View style={s.valueButton}>
          <AppIcon name="CircleUserRound" size={14} color={colors.primary} strokeWidth={2.2} />
          <Text allowFontScaling={false} style={s.valueButtonText} numberOfLines={1}>{valorLabel}</Text>
        </View>
        <Pressable
          onPress={onDetails ?? (() => Alert.alert("Agendamentos", "Detalhes do agendamento em breve."))}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <LinearGradient colors={["#FFB347", "#FF9F1C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.detailsButton}>
            <Text allowFontScaling={false} style={s.detailsText} numberOfLines={1}>Detalhes</Text>
            <AppIcon name="ChevronRight" size={14} color={colors.white} strokeWidth={2.7} />
          </LinearGradient>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 13,
    ...shadows.card,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  contentCol: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  name: {
    color: "#1F1B2D",
    ...typography.title,
    fontWeight: "800",
    letterSpacing: 0,
  },
  categoryPill: {
    alignSelf: "flex-start",
    minHeight: 24,
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.lavenderSoft,
  },
  categoryPillText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
  },
  metaStack: {
    gap: 5,
    paddingTop: 1,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  metaText: {
    flexShrink: 1,
    color: "#5F596B",
    ...typography.caption,
    fontWeight: "600",
    letterSpacing: 0,
  },
  metaStrong: {
    color: "#1F1B2D",
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0,
  },
  metaMuted: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "700",
    letterSpacing: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(31, 27, 45, 0.10)",
    alignSelf: "stretch",
  },
  observacao: {
    color: "#5F596B",
    ...typography.caption,
    fontWeight: "600",
    letterSpacing: 0,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  valueButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.primary,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  valueButtonText: {
    color: colors.primary,
    ...typography.caption,
    fontWeight: "800",
    letterSpacing: 0,
  },
  visualCol: {
    width: 86,
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  avatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3B2A66",
    shadowOpacity: 0.11,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  detailsButton: {
    width: 118,
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 3,
    shadowColor: "#FF9F1C",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  detailsText: {
    color: colors.white,
    ...typography.caption,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  statusPillCard: {
    minHeight: 28,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    alignSelf: "stretch",
  },
  statusPillText: {
    ...typography.caption,
    fontWeight: "800",
    letterSpacing: 0,
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
