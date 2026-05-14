/**
 * MontadorPublicProfile — Visão pública do montador para o Empregador.
 *
 * Recebe `montadorId` (e opcionalmente `nome`) via route params, busca o
 * perfil no backend e exibe foto/nome/especialidades/bio + botão Contratar
 * que abre o service flow com tipo MONTADOR.
 *
 * Identidade visual: usa `getProfileTheme` com role MONTADOR + gênero do
 * próprio profissional (não do empregador logado) — verde/rosa conforme
 * o genero do montador.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { api } from "@/lib/api";
import { AppIcon, DAvatar, DButton } from "@/components/ui";
import { useDularColors } from "@/hooks/useDularColors";
import { getProfileTheme, type Genero } from "@/theme/profileTheme";
import { radius, shadows, spacing, typography } from "@/theme";
import type { EmpregadorTabParamList } from "@/navigation/EmpregadorNavigator";
import type { MontadorItem } from "@/types/montador";

type Navigation = BottomTabNavigationProp<EmpregadorTabParamList>;
type RouteProps = RouteProp<EmpregadorTabParamList, "MontadorPublicProfile">;

type DetalheResponse = { ok?: boolean; montador?: MontadorItem };

export default function MontadorPublicProfile() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const colors = useDularColors();
  const { montadorId, nome: nomeParam } = route.params;

  const [montador, setMontador] = useState<MontadorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // TODO (backend): endpoint dedicado /api/montadores/[id]. Por enquanto
        // tentamos via /api/montadores/buscar e filtramos client-side; se não
        // achar, exibimos o nome do route param e dados vazios.
        const res = await api.get<DetalheResponse>(`/api/montadores/${montadorId}`).catch(() => null);
        if (cancelled) return;
        if (res?.data?.montador) {
          setMontador(res.data.montador);
        } else {
          setMontador(null);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [montadorId]);

  const nome = montador?.user.nome ?? nomeParam ?? "Montador";
  const genero: Genero = (montador?.user.genero ?? null) as Genero;
  const theme = useMemo(
    () => getProfileTheme({ role: "MONTADOR", genero }),
    [genero],
  );

  const especialidades = montador?.especialidades ?? [];
  const totalServicos = montador?.totalServicos ?? 0;
  const rating = montador?.rating ?? 0;
  const verificado = montador?.verificado ?? false;
  const cidade = montador?.cidade ?? "—";
  const estado = montador?.estado ?? "—";

  const styles = useMemo(
    () => makeStyles({ theme, surface: colors.surface, textPrimary: colors.textPrimary, textSecondary: colors.textSecondary, textMuted: colors.textMuted, border: colors.border, background: colors.background }),
    [theme, colors],
  );

  const handleContratar = () => {
    navigation.navigate("SolicitarServico", {
      categoriaInicial: "montador",
      tipoInicial: "MONTADOR",
      profissionalId: montadorId,
      profissionalNome: nome,
    });
  };

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <AppIcon name="ArrowLeft" size={20} color={theme.primary} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.headerTitle}>Perfil do Montador</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Hero */}
        <View style={[styles.hero, { borderColor: theme.border }]}>
          <DAvatar
            uri={montador?.fotoPerfil ?? montador?.user.avatarUrl ?? undefined}
            size="xl"
            initials={nome.slice(0, 2).toUpperCase()}
          />
          <View style={styles.heroText}>
            <Text style={styles.name} numberOfLines={1}>{nome}</Text>
            <Text style={styles.role}>Montador profissional</Text>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: theme.primarySoft }]}>
                <AppIcon name="Star" size={12} color={theme.primary} strokeWidth={2.5} />
                <Text style={[styles.badgeText, { color: theme.primary }]}>
                  {rating > 0 ? rating.toFixed(1) : "Sem avaliações"}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: verificado ? theme.primarySoft : colors.warningSoft },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: verificado ? theme.primary : colors.warningDark },
                  ]}
                >
                  {verificado ? "Verificado" : "Verificação pendente"}
                </Text>
              </View>
            </View>
            <Text style={styles.locationLine}>
              {cidade}{estado && estado !== "—" ? ` · ${estado}` : ""}
            </Text>
          </View>
        </View>

        {/* Bio */}
        {montador?.bio ? (
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Text style={styles.cardLabel}>Sobre</Text>
            <Text style={styles.bio}>{montador.bio}</Text>
          </View>
        ) : null}

        {/* Especialidades */}
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Text style={styles.cardLabel}>Especialidades</Text>
          {especialidades.length > 0 ? (
            <View style={styles.chips}>
              {especialidades.map((item) => (
                <View
                  key={item}
                  style={[styles.chip, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}
                >
                  <Text style={[styles.chipText, { color: theme.textAccent }]}>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>Especialidades não informadas.</Text>
          )}
        </View>

        {/* Estatísticas */}
        <View style={[styles.statsRow, { borderColor: theme.border }]}>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.textAccent }]}>{totalServicos}</Text>
            <Text style={styles.statLabel}>Serviços</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.textAccent }]}>
              {montador?.anosExperiencia ?? "—"}
            </Text>
            <Text style={styles.statLabel}>Anos de experiência</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <DButton label="Contratar" variant="primary" size="lg" onPress={handleContratar} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(p: {
  theme: ReturnType<typeof getProfileTheme>;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  background: string;
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: p.theme.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.border,
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      ...typography.bodyMedium,
      color: p.textPrimary,
      fontWeight: "700",
    },
    headerSpacer: { width: 40 },
    scroll: {
      paddingHorizontal: spacing.screenPadding,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 14,
    },
    errorCard: {
      borderRadius: radius.lg,
      padding: 12,
      backgroundColor: "rgba(255, 90, 110, 0.08)",
    },
    errorText: {
      color: "#FF5A6E",
      ...typography.bodySm,
      fontWeight: "600",
    },
    hero: {
      flexDirection: "row",
      gap: 14,
      backgroundColor: p.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: 14,
      ...shadows.card,
    },
    heroText: {
      flex: 1,
      gap: 6,
    },
    name: {
      ...typography.title,
      color: p.textPrimary,
      fontWeight: "800",
    },
    role: {
      ...typography.bodySm,
      color: p.textSecondary,
      fontWeight: "700",
    },
    heroBadges: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "900",
    },
    locationLine: {
      ...typography.caption,
      color: p.textMuted,
      fontWeight: "700",
    },
    card: {
      backgroundColor: p.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      padding: 14,
      gap: 10,
      ...shadows.soft,
    },
    cardLabel: {
      ...typography.caption,
      color: p.textMuted,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    bio: {
      ...typography.bodySm,
      color: p.textPrimary,
      lineHeight: 20,
      fontWeight: "500",
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    chipText: {
      fontSize: 12,
      fontWeight: "800",
    },
    empty: {
      ...typography.caption,
      color: p.textSecondary,
      fontWeight: "500",
      fontStyle: "italic",
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: p.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      paddingVertical: 14,
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      marginVertical: 4,
    },
    statValue: {
      ...typography.h2,
      fontWeight: "800",
    },
    statLabel: {
      ...typography.caption,
      color: p.textSecondary,
      fontWeight: "700",
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      backgroundColor: p.background,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
  });
}
