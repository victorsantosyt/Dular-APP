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
    </SafeAreaView>
  );
}

export default MensagensDiaristaScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.lavender,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
});
