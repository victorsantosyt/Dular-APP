import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppIcon, AppIconName, DAvatar, DBottomNav, DButton, DCard } from "@/components/ui";
import { colors, radius, shadows, spacing, typography } from "@/theme";
import type { ClienteTabParamList } from "@/navigation/ClienteNavigator";
import type { ChatAbertoParams } from "@/screens/shared/ChatAbertoScreen";
import { getTrustSignals, type TrustSignals } from "@/api/safeScoreApi";

type Navigation = BottomTabNavigationProp<ClienteTabParamList>;
type SafeScoreStatus = "critical" | "low" | "medium" | "high" | "excellent";

type SafeScoreProfile = {
  score: number;
  status: SafeScoreStatus;
  verifiedDocuments: boolean;
  completedJobs: number;
  canceledJobs: number;
  incidentReports: number;
  averageRating: number | null;
  totalReviews: number;
  punctualityRate: number | null;
  responseTimeMinutes: number | null;
  recommendationEligible: boolean;
  searchBoostEligible: boolean;
  profileBadgeLabel: string | null;
  ratingDistribution: { stars: number; count: number }[];
  latestReview: {
    customerName: string;
    dateLabel: string;
    rating: number;
    text: string;
    verified: boolean;
    avatarUrl: string;
  } | null;
};

type TrustBadge = {
  icon: AppIconName;
  label: string;
};

const diarista = {
  name: "Carolina Silva",
  age: 23,
  city: "Campinas, SP",
  neighborhood: "Jardim América",
  price: 150,
  memberSince: "15/04/2023",
  avatarUrl: "",
  bio: "Olá! Me chamo Carolina. Atendo serviços de limpeza residencial e organização na região de Campinas. Você pode combinar detalhes do serviço pelo chat antes do agendamento.",
  serviceAreaNote: "Atende regiões próximas",
  services: [
    "Faxina completa",
    "Faxina pesada",
    "Organização",
    "Passar roupa",
    "Limpeza pós-obra",
    "Cozinha",
    "Banheiro",
  ],
};

// TODO: substituir pelo payload real da API SafeScore quando o contrato estiver disponível.
const safeScoreProfile: SafeScoreProfile = {
  score: 86,
  status: "high",
  verifiedDocuments: true,
  completedJobs: 214,
  canceledJobs: 4,
  incidentReports: 0,
  averageRating: 4.9,
  totalReviews: 128,
  punctualityRate: 94,
  responseTimeMinutes: 18,
  recommendationEligible: false,
  searchBoostEligible: false,
  profileBadgeLabel: null,
  ratingDistribution: [
    { stars: 5, count: 112 },
    { stars: 4, count: 12 },
    { stars: 3, count: 3 },
    { stars: 2, count: 1 },
    { stars: 1, count: 0 },
  ],
  latestReview: {
    customerName: "Juliana M.",
    dateLabel: "Hoje",
    rating: 5,
    text: "Excelente trabalho! Muito caprichosa e atenciosa.",
    verified: true,
    avatarUrl: "",
  },
};

function getTrustBadges(profile: SafeScoreProfile): TrustBadge[] {
  const badges: TrustBadge[] = [];

  if (profile.verifiedDocuments) {
    badges.push({ icon: "ShieldCheck", label: "Perfil verificado" });
  }
  if (profile.completedJobs >= 50) {
    badges.push({ icon: "Award", label: "Experiente" });
  }
  if (profile.averageRating !== null && profile.averageRating >= 4.7 && profile.totalReviews >= 10) {
    badges.push({ icon: "Star", label: "Alta avaliação" });
  }
  if (profile.punctualityRate !== null && profile.punctualityRate >= 90) {
    badges.push({ icon: "Clock", label: "Pontual" });
  }
  if (profile.recommendationEligible) {
    badges.push({ icon: "Heart", label: "Recomendada" });
  }
  if (profile.searchBoostEligible) {
    badges.push({ icon: "Search", label: "Destaque na busca" });
  }
  if (profile.profileBadgeLabel) {
    badges.push({ icon: "ShieldCheck", label: profile.profileBadgeLabel });
  }

  return badges;
}

function getSafeScoreLabel(_score: number, status: SafeScoreStatus) {
  switch (status) {
    case "critical":
      return "Histórico exige revisão";
    case "low":
      return "Histórico limitado";
    case "medium":
      return "Histórico em desenvolvimento";
    case "high":
      return "Histórico consistente";
    case "excellent":
      return "Histórico excelente";
  }
}

function formatRating(profile: SafeScoreProfile) {
  if (profile.averageRating === null || profile.totalReviews === 0) {
    return "Ainda sem avaliações";
  }

  return `${profile.averageRating.toFixed(1).replace(".", ",")} (${profile.totalReviews} avaliações)`;
}

function getQuickStats(profile: SafeScoreProfile) {
  return [
    { label: "Membro desde", value: diarista.memberSince },
    { label: "Serviços concluídos", value: `${profile.completedJobs} realizados` },
    {
      label: "Tempo de resposta",
      value: profile.responseTimeMinutes !== null ? `${profile.responseTimeMinutes} min` : "Não informado",
    },
  ];
}

function HeaderIcon({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={spacing.sm} style={styles.headerIcon}>
      {children}
    </Pressable>
  );
}

function StarRow({ size = 14, color = colors.pink }: { size?: number; color?: string }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, index) => (
        <AppIcon key={index} name="Star" size={size} color={color} strokeWidth={2.4} />
      ))}
    </View>
  );
}

function HeroCard({ favorite, profile }: { favorite: boolean; profile: SafeScoreProfile }) {
  return (
    <LinearGradient
      colors={[colors.primary, colors.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={styles.heroTop}>
        <View style={styles.avatarColumn}>
          <View style={styles.avatarShell}>
            <DAvatar
              size="xl"
              uri={diarista.avatarUrl}
              initials={diarista.name.slice(0, 2)}
            />
          </View>
          {profile.verifiedDocuments ? (
            <View style={styles.verifiedPill}>
              <AppIcon name="ShieldCheck" size={12} color={colors.success} strokeWidth={2.4} />
              <Text style={styles.verifiedText}>Verificada</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.heroInfo}>
          <View style={styles.heroNameRow}>
            <Text style={styles.heroName} numberOfLines={1}>{diarista.name}</Text>
            {profile.verifiedDocuments ? (
              <View style={styles.checkDot}>
                <AppIcon name="Check" size={12} color={colors.white} strokeWidth={3} />
              </View>
            ) : null}
          </View>

          <Text style={styles.heroAge}>{diarista.age} anos</Text>

          <View style={styles.heroMetaRow}>
            <AppIcon name="Star" size={14} color={colors.white} strokeWidth={2.4} />
            <Text style={styles.heroMetaText}>{formatRating(profile)}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            <AppIcon name="MapPin" size={14} color={colors.whiteAlpha85} strokeWidth={2.2} />
            <Text style={styles.heroMetaText}>{diarista.city}</Text>
          </View>

          <View style={styles.heroMetaRow}>
            <AppIcon name="Award" size={14} color={colors.whiteAlpha85} strokeWidth={2.2} />
            <Text style={styles.heroMetaText}>{profile.completedJobs} serviços concluídos</Text>
          </View>
        </View>

        <View style={styles.heroRight}>
          <View style={styles.favoriteGhost}>
            <AppIcon
              name="Heart"
              size={16}
              color={favorite ? colors.pink : colors.whiteAlpha85}
              strokeWidth={2.4}
            />
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function TrustBadges({ profile }: { profile: SafeScoreProfile }) {
  const badges = getTrustBadges(profile);
  const safeScoreLabel = getSafeScoreLabel(profile.score, profile.status);

  return (
    <DCard style={styles.trustCard}>
      <View style={styles.trustHeader}>
        <Text style={styles.trustTitle}>Sinais de confiança</Text>
        <Text style={styles.trustStatus}>{safeScoreLabel}</Text>
      </View>

      {badges.length > 0 ? (
        <View style={styles.trustGrid}>
          {badges.map((badge) => (
            <View key={badge.label} style={styles.trustItem}>
              <View style={styles.trustIcon}>
                <AppIcon name={badge.icon} size={18} color="purple" strokeWidth={2.2} />
              </View>
              <Text style={styles.trustLabel}>{badge.label}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.trustEmpty}>
          <AppIcon name="Info" size={18} color={colors.textSecondary} strokeWidth={2.2} />
          <Text style={styles.trustEmptyText}>
            Ainda não há sinais públicos suficientes para exibir no perfil.
          </Text>
        </View>
      )}

      {profile.incidentReports > 0 ? (
        <View style={styles.incidentNotice}>
          <AppIcon name="AlertTriangle" size={16} color={colors.warning} strokeWidth={2.4} />
          <Text style={styles.incidentNoticeText}>
            Há registros em análise no histórico desta profissional.
          </Text>
        </View>
      ) : null}
    </DCard>
  );
}

function SectionCard({
  title,
  children,
  right,
  style,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const cardStyle = style ? [styles.sectionCard, style] : styles.sectionCard;

  return (
    <DCard style={cardStyle}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </DCard>
  );
}

function MapPreview() {
  return (
    <View style={styles.mapPreview}>
      <View style={[styles.mapLine, styles.mapLineOne]} />
      <View style={[styles.mapLine, styles.mapLineTwo]} />
      <View style={[styles.mapLine, styles.mapLineThree]} />
      <View style={styles.mapPin}>
        <AppIcon name="MapPin" size={17} color={colors.white} strokeWidth={2.5} />
      </View>
    </View>
  );
}

function RatingBar({ stars, count, max }: { stars: number; count: number; max: number }) {
  const width = `${Math.max(3, Math.round((count / max) * 100))}%` as `${number}%`;

  return (
    <View style={styles.ratingBarRow}>
      <Text style={styles.ratingBarLabel}>{stars}</Text>
      <AppIcon name="Star" size={11} color={colors.pink} strokeWidth={2.3} />
      <View style={styles.ratingTrack}>
        <View style={[styles.ratingFill, { width }]} />
      </View>
      <Text style={styles.ratingCount}>{count}</Text>
    </View>
  );
}

function ReviewsCard({ profile }: { profile: SafeScoreProfile }) {
  const maxCount = useMemo(
    () => Math.max(1, ...profile.ratingDistribution.map((item) => item.count)),
    [profile.ratingDistribution],
  );
  const visibleDistribution = useMemo(
    () => profile.ratingDistribution.filter((item) => item.stars >= 1 && item.stars <= 5),
    [profile.ratingDistribution],
  );
  const hasReviews = profile.averageRating !== null && profile.totalReviews > 0;
  const review = profile.latestReview;
  const reviewStars = useMemo(
    () => Math.max(0, Math.min(5, review?.rating ?? 0)),
    [review?.rating],
  );

  return (
    <SectionCard
      title="Avaliações de clientes"
      right={
        <Pressable hitSlop={spacing.xs}>
          <Text style={styles.linkText}>Ver todas</Text>
        </Pressable>
      }
    >
      {hasReviews ? (
        <>
          <View style={styles.reviewsContent}>
            <View style={styles.ratingSummary}>
              <Text style={styles.ratingNumber}>
                {profile.averageRating!.toFixed(1).replace(".", ",")}
              </Text>
              <StarRow />
              <Text style={styles.ratingSub}>({profile.totalReviews} avaliações)</Text>
            </View>

            <View style={styles.ratingDistribution}>
              {visibleDistribution.map((item) => (
                <RatingBar key={item.stars} stars={item.stars} count={item.count} max={maxCount} />
              ))}
            </View>
          </View>

          {review ? (
            <>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <DAvatar
                  size="sm"
                  uri={review.avatarUrl}
                  initials={review.customerName.slice(0, 2)}
                />
                <View style={styles.reviewBody}>
                  <View style={styles.reviewHeader}>
                    <View>
                      <Text style={styles.reviewName}>{review.customerName}</Text>
                      <Text style={styles.reviewDate}>{review.dateLabel}</Text>
                    </View>
                    {review.verified ? (
                      <View style={styles.reviewVerified}>
                        <AppIcon name="Check" size={11} color={colors.success} strokeWidth={3} />
                        <Text style={styles.reviewVerifiedText}>Verificada</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.starRow}>
                    {Array.from({ length: reviewStars }).map((_, index) => (
                      <AppIcon key={index} name="Star" size={12} color={colors.pink} strokeWidth={2.4} />
                    ))}
                  </View>
                  <Text style={styles.reviewText}>{review.text}</Text>
                </View>
              </View>
            </>
          ) : null}
        </>
      ) : (
        <View style={styles.noReviewsBox}>
          <AppIcon name="Star" size={20} color={colors.textSecondary} strokeWidth={2.3} />
          <View style={styles.noReviewsTextBlock}>
            <Text style={styles.noReviewsTitle}>Ainda sem avaliações</Text>
            <Text style={styles.noReviewsText}>
              As avaliações aparecerão quando houver histórico suficiente de clientes.
            </Text>
          </View>
        </View>
      )}
    </SectionCard>
  );
}

function useTrustSignals(userId: string) {
  const [data, setData] = useState<TrustSignals | null>(null);

  useEffect(() => {
    if (!userId) return;
    getTrustSignals(userId)
      .then(setData)
      .catch(() => null); // falha silenciosa — mantém mock como fallback
  }, [userId]);

  return data;
}

export function DiaristaProfileScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<ClienteTabParamList, "ProfissionalPerfil">>();
  const diaristaId = route.params?.id;
  const trustSignals = useTrustSignals(diaristaId ?? "");

  const isVerified = trustSignals?.isVerified ?? safeScoreProfile.verifiedDocuments;
  const totalServicos = trustSignals?.totalServicos ?? safeScoreProfile.completedJobs;

  // Profile efetivo: mock como base, com overrides reais quando trust-signals responde
  const effectiveProfile: SafeScoreProfile = useMemo(
    () => ({
      ...safeScoreProfile,
      verifiedDocuments: isVerified,
      completedJobs: totalServicos,
    }),
    [isVerified, totalServicos],
  );

  const [favorite, setFavorite] = useState(false);

  const handleShare = async () => {
    await Share.share({
      message: `Conheça o perfil de ${diarista.name} na Dular.`,
    });
  };

  const handleBottomNav = (tab: "home" | "search" | "new" | "messages" | "profile") => {
    if (tab === "home") navigation.navigate("Home");
    if (tab === "search") navigation.navigate("Buscar");
    if (tab === "new") navigation.navigate("SolicitarServico");
    if (tab === "messages") navigation.navigate("Mensagens");
    if (tab === "profile") navigation.navigate("Perfil");
  };

  const chatParams: ChatAbertoParams = {
    nome: diarista.name,
    avatarUrl: diarista.avatarUrl,
    servico: "Faxina completa",
    dataHora: "Hoje, 14:00 - 18:00",
    bairro: diarista.neighborhood,
    status: "Perfil público",
    papel: "cliente",
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <HeaderIcon onPress={() => navigation.goBack()}>
            <AppIcon name="ArrowLeft" size={22} color={colors.textPrimary} strokeWidth={2.5} />
          </HeaderIcon>

          <Text style={styles.headerTitle}>Perfil da diarista</Text>

          <View style={styles.headerActions}>
            <HeaderIcon onPress={handleShare}>
              <AppIcon name="Share2" size={20} color={colors.textPrimary} strokeWidth={2.3} />
            </HeaderIcon>
            <HeaderIcon onPress={() => setFavorite((current) => !current)}>
              <AppIcon
                name="Heart"
                size={20}
                color={favorite ? colors.pink : colors.textPrimary}
                strokeWidth={2.4}
              />
            </HeaderIcon>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <HeroCard favorite={favorite} profile={effectiveProfile} />
          <TrustBadges profile={effectiveProfile} />

          <SectionCard
            title="Sobre mim"
            right={
              <Pressable hitSlop={spacing.xs}>
                <Text style={styles.linkText}>Ver mais</Text>
              </Pressable>
            }
          >
            <Text style={styles.aboutText}>{diarista.bio}</Text>
          </SectionCard>

          <SectionCard title="Serviços que ofereço">
            <View style={styles.servicesWrap}>
              {diarista.services.map((service) => (
                <View key={service} style={styles.servicePill}>
                  <Text style={styles.servicePillText}>{service}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Localização">
            <View style={styles.locationRow}>
              <View style={styles.locationTextBlock}>
                <View style={styles.locationLine}>
                  <AppIcon name="MapPin" size={17} color={colors.primary} strokeWidth={2.4} />
                  <Text style={styles.locationTitle}>Jardim América, Campinas - SP</Text>
                </View>
                <Text style={styles.locationSub}>{diarista.serviceAreaNote}</Text>
              </View>
              <MapPreview />
            </View>
          </SectionCard>

          <View style={styles.statsRow}>
            {getQuickStats(effectiveProfile).map((stat) => (
              <DCard key={stat.label} style={styles.statCard}>
                <Text style={styles.statLabel}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </DCard>
            ))}
          </View>

          <ReviewsCard profile={effectiveProfile} />
        </ScrollView>

        <View style={styles.fixedFooter}>
          <View style={styles.priceBlock}>
            <Text style={styles.priceLabel}>A partir de</Text>
            <Text style={styles.priceValue}>R$ {diarista.price}</Text>
            <Text style={styles.priceSub}>por serviço</Text>
          </View>

          <View style={styles.footerActions}>
            <DButton
              label="Mensagem"
              variant="secondary"
              size="md"
              onPress={() => navigation.navigate("ChatAberto", chatParams)}
              style={styles.messageButton}
            />
            <DButton
              label="Agendar"
              variant="primary"
              size="md"
              onPress={() => navigation.navigate("SolicitarServico")}
              style={styles.scheduleButton}
            />
          </View>
        </View>

        <DBottomNav activeTab="search" onPress={handleBottomNav} />
      </View>
    </SafeAreaView>
  );
}

export default DiaristaProfileScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
  },
  headerTitle: {
    position: "absolute",
    left: 88,
    right: 88,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 210,
    gap: spacing.md,
  },
  heroCard: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    overflow: "hidden",
    ...shadows.medium,
    shadowColor: colors.primary,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  avatarColumn: {
    width: 82,
    alignItems: "center",
  },
  avatarShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 3,
    borderColor: colors.whiteAlpha70,
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedPill: {
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    color: colors.success,
  },
  heroInfo: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroName: {
    flex: 1,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "900",
    color: colors.white,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  heroAge: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.whiteAlpha85,
  },
  heroMetaRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroMetaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.whiteAlpha90,
  },
  heroRight: {
    width: 78,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  availablePill: {
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  availableText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    color: colors.primary,
    textAlign: "center",
  },
  favoriteGhost: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.whiteAlpha20,
    alignItems: "center",
    justifyContent: "center",
  },
  trustCard: {
    padding: spacing.md,
    gap: spacing.md,
  },
  trustHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
  trustTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  trustStatus: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.textSecondary,
    textAlign: "right",
  },
  trustGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  trustItem: {
    width: "23%",
    minWidth: 68,
    alignItems: "center",
    gap: spacing.xs,
  },
  trustIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  trustLabel: {
    minHeight: 28,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    color: colors.textSecondary,
    textAlign: "center",
  },
  trustEmpty: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  trustEmptyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  incidentNotice: {
    borderRadius: radius.lg,
    backgroundColor: colors.yellowSoft,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  incidentNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: colors.warning,
  },
  sectionCard: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: "900",
  },
  linkText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: colors.primary,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  servicesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  servicePill: {
    borderRadius: radius.full,
    backgroundColor: colors.purpleSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.12)",
  },
  servicePillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: colors.primary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  locationTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  locationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  locationTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  locationSub: {
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  mapPreview: {
    width: 104,
    height: 84,
    borderRadius: radius.lg,
    backgroundColor: colors.purpleSoft,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(124,92,255,0.14)",
  },
  mapLine: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(124,92,255,0.22)",
  },
  mapLineOne: {
    width: 92,
    top: 18,
    left: -8,
    transform: [{ rotate: "-15deg" }],
  },
  mapLineTwo: {
    width: 116,
    top: 45,
    left: 4,
    transform: [{ rotate: "18deg" }],
  },
  mapLineThree: {
    width: 72,
    bottom: 14,
    left: 20,
    transform: [{ rotate: "-8deg" }],
  },
  mapPin: {
    position: "absolute",
    left: 41,
    top: 26,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.soft,
    shadowColor: colors.primary,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minHeight: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    color: colors.textMuted,
    textAlign: "center",
  },
  statValue: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "900",
    color: colors.textPrimary,
    textAlign: "center",
  },
  reviewsContent: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  ratingSummary: {
    width: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingNumber: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  ratingSub: {
    marginTop: spacing.xs,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    color: colors.textSecondary,
    textAlign: "center",
  },
  ratingDistribution: {
    flex: 1,
    gap: 6,
  },
  ratingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingBarLabel: {
    width: 8,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    color: colors.textSecondary,
    textAlign: "center",
  },
  ratingTrack: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: "hidden",
  },
  ratingFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  ratingCount: {
    width: 24,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    color: colors.textSecondary,
    textAlign: "right",
  },
  reviewDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  reviewRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  reviewBody: {
    flex: 1,
    minWidth: 0,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: 4,
  },
  reviewName: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  reviewDate: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  reviewVerified: {
    borderRadius: radius.full,
    backgroundColor: colors.greenSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  reviewVerifiedText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "900",
    color: colors.success,
  },
  reviewText: {
    marginTop: spacing.xs,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  noReviewsBox: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  noReviewsTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  noReviewsTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  noReviewsText: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  fixedFooter: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    ...shadows.medium,
  },
  priceBlock: {
    width: 88,
  },
  priceLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.textMuted,
  },
  priceValue: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  priceSub: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  footerActions: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  messageButton: {
    flex: 0.9,
  },
  scheduleButton: {
    flex: 1,
  },
});
