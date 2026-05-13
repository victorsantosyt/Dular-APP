import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon } from "@/components/ui";
import { ConversaCard, ConversaCardSkeleton } from "@/components/ui/ConversaCard";
import { useMensagens } from "@/hooks/useMensagens";
import type { ChatRoom } from "@/hooks/useMensagens";
import { colors, spacing, typography } from "@/theme/tokens";
import type { DiaristaTabParamList } from "@/navigation/DiaristaNavigator";

type Navigation = BottomTabNavigationProp<DiaristaTabParamList>;

const SKELETON_COUNT = 5;

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <AppIcon name="MessageCircle" size={40} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
      <Text style={styles.emptySubtitle}>
        Seus chats com clientes aparecem aqui
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
  const { rooms, loading, refetch } = useMensagens();
  const [refreshing, setRefreshing] = useState(false);

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
            roomId: item.id,
            servicoId: item.servicoId,
            nomeUsuario: item.outroUsuario.nome,
          })
        }
      />
    ),
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Mensagens</Text>
        </View>

        {loading ? (
          <SkeletonList />
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={<EmptyState />}
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
    paddingBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    ...typography.h1,

    fontWeight: "700",
    letterSpacing: 0,
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
