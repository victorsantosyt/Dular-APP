import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { DAvatar } from "./DAvatar";
import type { ChatRoom } from "@/hooks/useMensagens";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export interface ConversaCardProps {
  room: ChatRoom;
  onPress: () => void;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const msPerDay = 86_400_000;
  const diffDays = Math.floor((now.getTime() - date.getTime()) / msPerDay);
  if (diffDays < 7) {
    const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    return days[date.getDay()];
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function ConversaCard({ room, onPress }: ConversaCardProps) {
  const hasUnread = room.naoLidas > 0;
  const initials = room.outroUsuario.nome.slice(0, 2).toUpperCase();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <DAvatar
          size="md"
          uri={room.outroUsuario.avatarUrl ?? undefined}
          initials={initials}
        />

        <View style={styles.center}>
          <Text style={styles.name} numberOfLines={1}>
            {room.outroUsuario.nome}
          </Text>
          <Text
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
            numberOfLines={1}
          >
            {room.ultimaMensagem?.texto ?? ""}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.time}>
            {formatTime(room.atualizadaEm)}
          </Text>
          {hasUnread ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {room.naoLidas > 99 ? "99+" : room.naoLidas}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.separator} />
    </Pressable>
  );
}

export function ConversaCardSkeleton() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1.0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonRow, { opacity }]}>
      <View style={styles.skeletonAvatar} />
      <View style={styles.skeletonCenter}>
        <View style={[styles.skeletonLine, styles.skeletonLineName]} />
        <View style={[styles.skeletonLine, styles.skeletonLineMsg]} />
      </View>
      <View style={styles.skeletonRight}>
        <View style={styles.skeletonTime} />
      </View>
    </Animated.View>
  );
}

const CARD_HEIGHT = 68;

const styles = StyleSheet.create({
  pressable: {
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    height: CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  center: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  lastMessage: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  lastMessageUnread: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  right: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  badgeText: {
    ...typography.label,
    color: colors.white,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 48 + spacing.md,
  },
  // Skeleton
  skeletonRow: {
    height: CARD_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  skeletonAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.skeletonBg,
  },
  skeletonCenter: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonLine: {
    borderRadius: radius.xs,
    backgroundColor: colors.skeletonBg,
  },
  skeletonLineName: {
    height: 14,
    width: "55%",
  },
  skeletonLineMsg: {
    height: 12,
    width: "80%",
  },
  skeletonRight: {
    alignItems: "flex-end",
  },
  skeletonTime: {
    width: 32,
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: colors.skeletonBg,
  },
});
