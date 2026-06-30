import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon, type AppIconName, DAvatar } from "@/components/ui";
import { DCard } from "@/components/ui/DCard";
import { colors, gradients, radius, shadows, spacing, typography } from "@/theme";

export type CategoriaFiltro = "todas" | "diarista" | "baba" | "cozinheira" | "montador";
export type StatusFiltro = "todas" | "aguardando" | "aceitas" | "concluidas" | "canceladas";
export type StatusAgendamento = "pendente" | "aceita" | "andamento" | "concluida" | "cancelada";

export type AgendamentoItem = {
  id: string;
  nome: string;
  /** Bucket visual (cor/ícone do pill de status). */
  status: StatusAgendamento;
  /** Status CRU do backend (UPPERCASE) — usado nos filtros por status. */
  statusRaw: string;
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
  /** precoFinal em centavos (0 = a combinar) — decide valor vs botão "A Combinar". */
  precoFinalCentavos: number;
  observacao?: string | null;
  avatarUrl?: string;
  /** Há uma proposta de reagendamento do profissional aguardando decisão. */
  reagendamentoPendente?: boolean;
};

export const CATEGORIAS: Array<{ label: string; value: CategoriaFiltro; icon: AppIconName }> = [
  { label: "Todas", value: "todas", icon: "Grid2x2" },
  { label: "Diarista", value: "diarista", icon: "BrushCleaning" },
  { label: "Babá", value: "baba", icon: "Baby" },
  { label: "Cozinheira", value: "cozinheira", icon: "ChefHat" },
  { label: "Montador", value: "montador", icon: "Wrench" },
];

export const STATUS_FILTERS: Array<{ label: string; value: StatusFiltro; color?: string }> = [
  { label: "Todos", value: "todas" },
  { label: "Aguardando", value: "aguardando", color: colors.warning },
  { label: "Aceitas", value: "aceitas", color: colors.success },
  { label: "Concluídas", value: "concluidas", color: colors.textMuted },
  { label: "Canceladas", value: "canceladas", color: colors.danger },
];

// Filtro por STATUS CRU do backend (não pelo bucket visual). Aguardando=SOLICITADO;
// Aceitas=ACEITO/EM_ANDAMENTO (+AGUARDANDO_FINALIZACAO, ainda ativo); Concluídas=
// CONCLUIDO/CONFIRMADO/FINALIZADO; Canceladas=CANCELADO/RECUSADO.
const STATUS_FILTER_RAW: Record<Exclude<StatusFiltro, "todas">, string[]> = {
  aguardando: ["SOLICITADO", "PENDENTE", "RASCUNHO"],
  aceitas: ["ACEITO", "EM_ANDAMENTO", "AGUARDANDO_FINALIZACAO"],
  concluidas: ["CONCLUIDO", "CONFIRMADO", "FINALIZADO"],
  canceladas: ["CANCELADO", "RECUSADO"],
};

const STATUS_UI: Record<
  StatusAgendamento,
  { label: string; color: string; bg: string; actionColor: string; actionIcon: AppIconName }
> = {
  pendente: {
    label: "Pendente",
    color: colors.warning,
    bg: colors.warningSoft,
    actionColor: colors.warning,
    actionIcon: "Hourglass",
  },
  aceita: {
    label: "Aceita",
    color: colors.white,
    bg: colors.success,
    actionColor: colors.white,
    actionIcon: "CheckCircle",
  },
  andamento: {
    label: "Em andamento",
    color: colors.primary,
    bg: colors.lavenderSoft,
    actionColor: colors.primary,
    actionIcon: "Clock3",
  },
  concluida: {
    label: "Concluída",
    color: colors.textSecondary,
    bg: colors.lavenderSoft,
    actionColor: colors.textSecondary,
    actionIcon: "CheckCircle",
  },
  cancelada: {
    label: "Cancelada",
    color: colors.danger,
    bg: colors.dangerSoft,
    actionColor: colors.danger,
    actionIcon: "XCircle",
  },
};

export function statusMatchesFilter(item: AgendamentoItem, status: StatusFiltro) {
  // "Todos" = só as solicitações ainda pendentes (feitas e não aceitas).
  // Aceitas, em andamento, concluídas e canceladas aparecem só nas próprias abas.
  if (status === "todas") return STATUS_FILTER_RAW.aguardando.includes(item.statusRaw);
  return STATUS_FILTER_RAW[status].includes(item.statusRaw);
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

export function AppointmentCard({
  item,
  onDetails,
  onChat,
}: {
  item: AgendamentoItem;
  onDetails?: () => void;
  onChat?: () => void;
}) {
  const status = STATUS_UI[item.status];
  const firstName = item.nome.split(" ")[0];
  const dateLine = item.horario && item.horario !== "Horário a combinar"
    ? `${item.data} (${item.horario.toLowerCase()})`
    : item.data;
  const temValor = item.precoFinalCentavos > 0;

  return (
    <DCard style={s.card}>
      <View style={s.mainRow}>
        <View style={s.contentCol}>
          <Text allowFontScaling={false} style={s.name} numberOfLines={1}>{firstName}</Text>

          <View style={s.categoryPill}>
            <AppIcon name={item.categoriaIcon} size={12} color={colors.primary} strokeWidth={2.2} />
            <Text allowFontScaling={false} style={s.categoryPillText} numberOfLines={1}>{item.categoria}</Text>
          </View>

          {item.reagendamentoPendente ? (
            <View style={[s.categoryPill, { backgroundColor: colors.warningSoft }]}>
              <AppIcon name="Clock" size={12} color={colors.warning} strokeWidth={2.2} />
              <Text allowFontScaling={false} style={[s.categoryPillText, { color: colors.warning }]} numberOfLines={1}>
                Reagendamento pendente
              </Text>
            </View>
          ) : null}

          <View style={s.metaStack}>
            <View style={s.inlineRow}>
              <AppIcon name="MapPin" size={14} color={colors.textMuted} strokeWidth={2.1} />
              <Text allowFontScaling={false} style={s.metaText} numberOfLines={1}>{item.local}</Text>
            </View>
            <View style={s.inlineRow}>
              <AppIcon name="Calendar" size={14} color={colors.textMuted} strokeWidth={2.1} />
              <Text allowFontScaling={false} style={s.metaText} numberOfLines={1}>{dateLine}</Text>
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
          <View style={[s.statusPillCard, { backgroundColor: status.bg }]}>
            <AppIcon name={status.actionIcon} size={13} color={status.actionColor} strokeWidth={2.4} />
            <Text
              allowFontScaling={false}
              style={[s.statusPillText, { color: status.actionColor }]}
              numberOfLines={1}
            >
              {status.label}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.divider} />

      <View style={s.actionsRow}>
        {/* precoFinal > 0 → mostra valor ao lado do botão; === 0 → botão "A Combinar" (vai ao chat). */}
        {temValor ? (
          <View style={s.valueTag}>
            <Text allowFontScaling={false} style={s.valueLabel}>Valor</Text>
            <Text allowFontScaling={false} style={s.valueAmount} numberOfLines={1}>{item.valor}</Text>
          </View>
        ) : (
          <Pressable
            onPress={onChat ?? (() => Alert.alert("Combinar valor", "Abra o chat para combinar o valor."))}
            style={({ pressed }) => [s.combinarBtn, pressed && { opacity: 0.85 }]}
          >
            <AppIcon name="MessageCircle" size={14} color={colors.primary} strokeWidth={2.2} />
            <Text allowFontScaling={false} style={s.combinarText} numberOfLines={1}>A Combinar</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onDetails ?? (() => Alert.alert("Agendamentos", "Detalhes do agendamento em breve."))}
          style={({ pressed }) => [pressed && { opacity: 0.9 }]}
        >
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.detailsButton}>
            <Text allowFontScaling={false} style={s.detailsText} numberOfLines={1}>Ver Detalhes</Text>
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
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
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
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
    letterSpacing: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    alignSelf: "stretch",
  },
  observacao: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "600",
    letterSpacing: 0,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  valueTag: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  valueLabel: {
    color: colors.textMuted,
    ...typography.caption,
    fontWeight: "600",
  },
  valueAmount: {
    color: colors.textPrimary,
    ...typography.caption,
    fontWeight: "800",
    letterSpacing: 0,
  },
  combinarBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  combinarText: {
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
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  detailsButton: {
    width: 130,
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 3,
    ...shadows.primaryButton,
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
    width: "100%",
    maxWidth: 430,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 9,
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
    minWidth: 0,
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
