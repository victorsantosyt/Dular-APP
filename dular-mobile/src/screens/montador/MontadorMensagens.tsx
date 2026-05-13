import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, DEmptyState, DErrorState, DLoadingState, DScreen } from "@/components/ui";
import { useMontadorServicos } from "@/hooks/useMontadorServicos";
import { useProfileTheme } from "@/hooks/useProfileTheme";
import type { MontadorTabParamList } from "@/navigation/MontadorNavigator";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import { canOpenChat, labelServico, statusLabel } from "./montadorUtils";

type Navigation = BottomTabNavigationProp<MontadorTabParamList>;

export default function MontadorMensagens() {
  const navigation = useNavigation<Navigation>();
  const profileTheme = useProfileTheme("MONTADOR");
  const { servicos, loading, refreshing, error, refetch, reload } = useMontadorServicos();

  const conversas = useMemo(() => servicos.filter(canOpenChat), [servicos]);

  const carregarConversasMontador = reload;
  const abrirChat = (servicoId: string) => {
    navigation.navigate("MontadorChat", { servicoId });
  };
  const marcarComoLida = (_servicoId: string) => {
    // TODO: conectar quando houver endpoint de leitura de conversa por serviço.
  };

  return (
    <DScreen
      scroll
      withBottomPadding
      backgroundColor={profileTheme.background}
      refreshing={refreshing}
      refreshTintColor={profileTheme.primary}
      onRefresh={refetch}
      contentContainerStyle={styles.scroll}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Mensagens</Text>
        <Text style={styles.subtitle}>Conversas vinculadas a serviços aceitos</Text>
      </View>

      {loading ? (
        <DLoadingState text="Carregando conversas" color={profileTheme.primary} />
      ) : error ? (
        <DErrorState message={error} onRetry={carregarConversasMontador} />
      ) : conversas.length === 0 ? (
        <DEmptyState
          icon="MessageCircle"
          title="Nenhuma conversa liberada"
          subtitle="O chat aparece depois que uma solicitação é aceita."
          accentColor={profileTheme.primary}
          softBg={profileTheme.primarySoft}
        />
      ) : (
        <View style={styles.list}>
          {conversas.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                marcarComoLida(item.id);
                abrirChat(item.id);
              }}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              {(() => {
                const unread = Math.max(0, Number((item as { naoLidas?: number }).naoLidas) || 0);
                return (
                  <>
              <View style={[styles.iconBox, { backgroundColor: profileTheme.primarySoft }]}>
                <AppIcon name="MessageCircle" size={20} color={profileTheme.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.employerName}>{item.empregador?.nome ?? "Empregador"}</Text>
                <Text style={styles.serviceLine}>{labelServico(item)}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  Conversa do serviço aberta para alinhamentos finais.
                </Text>
              </View>
              <View style={styles.statusWrap}>
                <Text style={[styles.statusText, { color: profileTheme.primary }]}>{statusLabel(item.status)}</Text>
                {unread > 0 ? (
                  <View style={[styles.unreadBadge, { backgroundColor: profileTheme.primary }]}>
                    <Text style={styles.unreadText}>{unread > 9 ? "9+" : unread}</Text>
                  </View>
                ) : null}
              </View>
                  </>
                );
              })()}
            </Pressable>
          ))}
        </View>
      )}
    </DScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: 16,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: 0,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  list: {
    gap: 12,
  },
  card: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  employerName: {
    ...typography.bodySm,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  serviceLine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: "500",
  },
  lastMessage: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 5,
  },
  statusWrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusText: {
    ...typography.caption,
    fontWeight: "700",
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  unreadText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.76,
  },
});
