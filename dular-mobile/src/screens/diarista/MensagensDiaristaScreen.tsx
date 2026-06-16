import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon } from "@/components/ui";
import { ConversaCard, ConversaCardSkeleton } from "@/components/ui/ConversaCard";
import { useMensagens } from "@/hooks/useMensagens";
import type { ChatRoom } from "@/hooks/useMensagens";
import { useGenderTheme } from "@/hooks/useProfileTheme";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;
type Tab = "conversas" | "arquivadas";

const SKELETON_COUNT = 5;

function EmptyState({ tab, accentColor, softBg }: { tab: Tab; accentColor: string; softBg: string }) {
  const arquivadas = tab === "arquivadas";
  return (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIconWrap, { backgroundColor: softBg }]}>
        <AppIcon name={arquivadas ? "Archive" : "MessageCircle"} size={40} color={accentColor} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>
        {arquivadas ? "Nenhuma conversa arquivada" : "Nenhuma conversa ainda"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {arquivadas
          ? "Conversas de serviços concluídos aparecem aqui."
          : "Seus chats com clientes aparecem aqui"}
      </Text>
    </View>
  );
}

function SkeletonList() {
  return (
    <>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <ConversaCardSkeleton key={i} />
      ))}
    </>
  );
}

export function MensagensDiaristaScreen() {
  const navigation = useNavigation<Navigation>();
  const theme = useGenderTheme("DIARISTA");
  const { rooms, loading, refetch } = useMensagens();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("conversas");

  const visiveis = useMemo(
    () => rooms.filter((r) => (tab === "arquivadas" ? r.arquivada : !r.arquivada)),
    [rooms, tab],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 1200);
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: ChatRoom }) => (
      <ConversaCard
        room={item}
        onPress={() =>
          navigation.navigate("ChatAberto", {
            roomId: item.servicoId,
            servicoId: item.servicoId,
            nomeUsuario: item.outroUsuario.nome,
          })
        }
      />
    ),
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mensagens</Text>
        </View>

        <View style={styles.tabs}>
          {(["conversas", "arquivadas"] as const).map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabPill,
                  active
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { borderColor: theme.border },
                ]}
              >
                <AppIcon
                  name={t === "conversas" ? "MessageCircle" : "Archive"}
                  size={15}
                  color={active ? colors.white : theme.primary}
                  strokeWidth={2.2}
                />
                <Text style={[styles.tabText, { color: active ? colors.white : colors.textSecondary }]}>
                  {t === "conversas" ? "Conversas" : "Arquivadas"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={visiveis}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListEmptyComponent={<EmptyState tab={tab} accentColor={theme.primary} softBg={theme.primarySoft} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

export default MensagensDiaristaScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    ...typography.h1,
    fontWeight: "700",
    letterSpacing: 0,
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 12,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  tabText: {
    ...typography.caption,
    fontWeight: "700",
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 112,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.bodyMedium,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: "500",
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
