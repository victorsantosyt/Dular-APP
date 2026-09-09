import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { AppIcon } from "./AppIcon";
import { BackCircleButton } from "./BackCircleButton";
import { DAvatar } from "./DAvatar";

type Props = {
  title?: string;
  subtitle?: string;
  /** URI or initials for the avatar displayed on the right side of the greeting area */
  avatarUri?: string;
  avatarInitials?: string;
  /** Show back arrow on the left */
  onBack?: () => void;
  /** Show notification bell on the right (replaces avatar when both provided, avatar takes priority) */
  onNotification?: () => void;
  notificationBadge?: number;
  /** Arbitrary right-side slot — takes priority over onNotification */
  rightAction?: ReactNode;
  /** Extra container style */
  style?: ViewStyle;
};

/**
 * Cabeçalho de tela secundária: voltar à esquerda, título ao centro, ação à
 * direita.
 *
 * Desenhava um cabeçalho PRÓPRIO — botão de voltar sem borda e com sombra,
 * título preto de 17px — enquanto o resto do app usa `BackCircleButton` com
 * borda e título em `typography.h2` na cor do perfil. Cinco telas do
 * empregador (Histórico, Favoritos, Ações rápidas, Profissionais em destaque
 * e sugeridos) ficavam visivelmente fora do padrão por causa disto.
 *
 * A correção é aqui, e não em cada tela: assim as cinco acertam de uma vez e
 * nenhuma nova nasce diferente.
 */
export function DScreenHeader({
  title,
  subtitle,
  avatarUri,
  avatarInitials,
  onBack,
  onNotification,
  notificationBadge,
  rightAction,
  style,
}: Props) {
  const showAvatar = !!(avatarUri || avatarInitials);
  const tema = useGenderTheme();

  return (
    <View style={[s.row, style]}>
      {/* Left: back button or spacer */}
      <View style={s.side}>
        {onBack ? (
          <BackCircleButton onPress={onBack} color={tema.icon} borderColor={tema.border} />
        ) : null}
      </View>

      {/* Center: title + subtitle */}
      {title || subtitle ? (
        <View style={s.center}>
          {title ? (
            <Text style={[s.title, { color: tema.textAccent }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      ) : (
        <View style={s.centerFlex} />
      )}

      {/* Right: avatar / notification / custom */}
      <View style={[s.side, s.sideRight]}>
        {rightAction ? (
          rightAction
        ) : showAvatar ? (
          <DAvatar size="sm" uri={avatarUri} initials={avatarInitials} />
        ) : onNotification ? (
          <Pressable onPress={onNotification} hitSlop={8} style={s.iconBtn}>
            <AppIcon name="Bell" size={20} color={colors.textPrimary} strokeWidth={2} />
            {notificationBadge && notificationBadge > 0 ? (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeText}>
                  {notificationBadge > 9 ? "9+" : notificationBadge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  side: {
    // Mesma largura do BackCircleButton (42) mais folga, para o título ficar
    // no centro da linha e não no centro do que sobra.
    width: 44,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  centerFlex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    // Mesmo tratamento das outras telas secundárias: h2 na cor de destaque do
    // perfil. A cor vem por prop, do tema.
    ...typography.h2,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  // Mesmo círculo do BackCircleButton, do outro lado da linha: 42 com borda,
  // não 40 com sombra. Os dois lados do cabeçalho tinham desenhos diferentes.
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.notification,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.white,
    lineHeight: 12,
  },
});
