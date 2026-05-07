import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { onboardingAssets } from "@/assets/onboardingAssets";
import { DularLogo, DularLogoWhite } from "@/assets/brand";
import { AppIcon } from "@/components/ui";
import { markOnboardingSeen } from "@/lib/onboarding";

const colors = {
  background: "#FCFAFF",
  surface: "#FFFFFF",
  primary: "#6D35E8",
  primaryDark: "#120A4D",
  primarySoft: "#EEE7FF",
  pink: "#FF3F86",
  pinkSoft: "#FFF0F6",
  lavender: "#F5EFFF",
  lavender2: "#EFE6FF",
  text: "#120A4D",
  textMuted: "#6F6A8F",
  border: "#ECE4F8",
  divider: "#E8E2F4",
  success: "#39C96B",
  successSoft: "#EFFFF4",
};

type ClearSlideKey = "welcome" | "benefits" | "security" | "start";

type ClearSlide = {
  key: ClearSlideKey;
  title: string;
  accentWords: string[];
  subtitle: string;
  hero: keyof typeof onboardingAssets;
  floatingCards?: Array<keyof typeof onboardingAssets>;
  features: string[];
  buttonLabel: string;
};

const clearSlides: ClearSlide[] = [
  {
    key: "welcome",
    title: "Bem-vindo ao Dular!",
    accentWords: ["Dular!"],
    subtitle: "O app que conecta você às\nmelhores diaristas da sua região.",
    hero: "welcomeHero",
    floatingCards: ["clientReviewCard", "confirmedCard"],
    features: [
      "Encontre com facilidade profissionais confiáveis.",
      "Agende em poucos cliques e economize tempo.",
      "Tudo com mais segurança e praticidade.",
    ],
    buttonLabel: "Próximo",
  },
  {
    key: "benefits",
    title: "Mais praticidade\npara o seu dia",
    accentWords: ["praticidade"],
    subtitle: "Tudo que você precisa em um\nsó lugar.",
    hero: "benefitsPhone",
    features: [
      "Agendamentos rápidos e flexíveis",
      "Recontrate suas favoritas",
      "Histórico completo de serviços",
      "Avaliações e recomendações personalizadas",
    ],
    buttonLabel: "Próximo",
  },
  {
    key: "security",
    title: "Segurança que você\npode confiar",
    accentWords: ["Segurança"],
    subtitle: "Nosso compromisso é com a sua\ntranquilidade.",
    hero: "securityShield",
    floatingCards: ["safescoreCard"],
    features: [
      "Profissionais verificados",
      "SafeScore: mais confiança na sua escolha",
      "Suporte rápido sempre que precisar",
      "Seus dados protegidos com sigilo total",
    ],
    buttonLabel: "Próximo",
  },
  {
    key: "start",
    title: "Pronta para ter\nmais tempo\npara você?",
    accentWords: ["mais tempo", "você?"],
    subtitle: "Faça parte de milhares de pessoas\nque já simplificaram a rotina com o Dular.",
    hero: "startHero",
    features: [],
    buttonLabel: "Vamos lá!",
  },
];

const featureIcons = ["Search", "Calendar", "ShieldCheck", "Star"] as const;

type OnboardingScreenProps = {
  onFinish?: () => void | Promise<void>;
  showSplash?: boolean;
};

export default function OnboardingScreen({ onFinish, showSplash = true }: OnboardingScreenProps) {
  const [index, setIndex] = useState(showSplash ? 0 : 1);
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 740;
  const clearIndex = Math.max(index - 1, 0);
  const currentSlide = clearSlides[clearIndex];

  useEffect(() => {
    console.log("[ONBOARDING] mounted");
  }, []);

  useEffect(() => {
    if (!showSplash || index !== 0) return undefined;

    const timer = setTimeout(() => {
      setIndex(1);
    }, 1700);

    return () => clearTimeout(timer);
  }, [index, showSplash]);

  const finish = async () => {
    console.log("[ONBOARDING] finished");

    if (onFinish) {
      await onFinish();
      return;
    }

    await markOnboardingSeen();
  };

  const next = async () => {
    if (index === 0) {
      setIndex(1);
      return;
    }

    if (clearIndex < clearSlides.length - 1) {
      setIndex((value) => value + 1);
      return;
    }

    await finish();
  };

  if (index === 0) {
    return <SplashSlide onNext={next} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable hitSlop={12} onPress={finish} style={styles.skipButton}>
          <Text allowFontScaling={false} style={styles.skipText}>
            Pular
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isSmallScreen && styles.scrollSmall]}
      >
        <View style={styles.logoRow}>
          <DularLogo size="md" />
        </View>

        <View style={styles.titleBlock}>
          <TitleText slide={currentSlide} compact={isSmallScreen} />
          <Text allowFontScaling={false} style={styles.subtitle}>
            {currentSlide.subtitle}
          </Text>
        </View>

        <HeroVisual slide={currentSlide} compact={isSmallScreen} />

        {currentSlide.key === "start" ? (
          <StartCard compact={isSmallScreen} />
        ) : (
          <View style={styles.features}>
            {currentSlide.features.map((feature, featureIndex) => (
              <FeatureItem key={feature} text={feature} icon={featureIcons[featureIndex]} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <OnboardingDots activeIndex={clearIndex} />
        <PrimaryButton
          label={currentSlide.buttonLabel}
          isLast={currentSlide.key === "start"}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}

function SplashSlide({ onNext }: { onNext: () => void }) {
  return (
    <Pressable onPress={onNext} style={styles.splashPressable}>
      <LinearGradient
        colors={["#7C3AED", "#5B25D9", "#4520B8"]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.splash}
      >
        <View style={styles.splashBg}>
          <View style={[styles.splashShape, styles.splashShapeTop]} />
          <View style={[styles.splashShape, styles.splashShapeLeft]} />
          <View style={[styles.splashShape, styles.splashShapeBottom]} />

          <View style={styles.splashCenter}>
            <DularLogoWhite size="lg" />
            <Text allowFontScaling={false} style={styles.splashTitle}>
              Conexões que{"\n"}facilitam <Text style={styles.splashTitleAccent}>sua rotina.</Text>
            </Text>
          </View>

          <View style={styles.splashHeart}>
            <AppIcon name="Heart" size={22} color={colors.pink} strokeWidth={2.8} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function TitleText({ slide, compact }: { slide: ClearSlide; compact: boolean }) {
  const parts = useMemo(() => {
    const pattern = new RegExp(`(${slide.accentWords.map(escapeRegExp).join("|")})`, "g");
    return slide.title.split(pattern).filter(Boolean);
  }, [slide]);

  return (
    <Text allowFontScaling={false} style={[styles.title, compact && styles.titleSmall]}>
      {parts.map((part, partIndex) => (
        <Text
          allowFontScaling={false}
          key={`${part}-${partIndex}`}
          style={slide.accentWords.includes(part) ? styles.titleAccent : undefined}
        >
          {part}
        </Text>
      ))}
    </Text>
  );
}

function HeroVisual({ slide, compact }: { slide: ClearSlide; compact: boolean }) {
  const isSecurity = slide.key === "security";

  return (
    <View style={[styles.heroWrap, compact && styles.heroWrapSmall]}>
      <View style={[styles.heroHalo, isSecurity && styles.heroHaloPink]} />
      <Image
        source={onboardingAssets[slide.hero]}
        style={[styles.heroImage, compact && styles.heroImageSmall]}
        resizeMode="contain"
      />

      {slide.key === "welcome" ? (
        <>
          <Image
            source={onboardingAssets.clientReviewCard}
            style={[styles.floatReviewCard, compact && styles.floatReviewCardSmall]}
            resizeMode="contain"
          />
          <Image
            source={onboardingAssets.confirmedCard}
            style={[styles.floatConfirmedCard, compact && styles.floatConfirmedCardSmall]}
            resizeMode="contain"
          />
        </>
      ) : null}

      {slide.key === "security" ? (
        <Image
          source={onboardingAssets.safescoreCard}
          style={[styles.floatSafescoreCard, compact && styles.floatSafescoreCardSmall]}
          resizeMode="contain"
        />
      ) : null}

      {slide.key === "start" ? <DecorativeIcons compact={compact} /> : null}
    </View>
  );
}

function DecorativeIcons({ compact }: { compact: boolean }) {
  const iconSize = compact ? 42 : 48;
  return (
    <>
      <Image source={onboardingAssets.heartIcon} style={[styles.decorIcon, styles.decorHeart, { width: iconSize, height: iconSize }]} resizeMode="contain" />
      <Image source={onboardingAssets.calendarIcon} style={[styles.decorIcon, styles.decorCalendar, { width: iconSize, height: iconSize }]} resizeMode="contain" />
      <Image source={onboardingAssets.shieldIcon} style={[styles.decorIcon, styles.decorShield, { width: iconSize, height: iconSize }]} resizeMode="contain" />
      <Image source={onboardingAssets.starIcon} style={[styles.decorIcon, styles.decorStar, { width: iconSize, height: iconSize }]} resizeMode="contain" />
    </>
  );
}

function FeatureItem({ text, icon }: { text: string; icon: (typeof featureIcons)[number] }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIcon}>
        <AppIcon name={icon} size={18} color={colors.primary} strokeWidth={2.4} />
      </View>
      <Text allowFontScaling={false} style={styles.featureText}>
        {text}
      </Text>
    </View>
  );
}

function StartCard({ compact }: { compact: boolean }) {
  return (
    <View style={[styles.startCard, compact && styles.startCardSmall]}>
      <Image source={onboardingAssets.giftIcon} style={styles.giftIcon} resizeMode="contain" />
      <Text allowFontScaling={false} style={styles.startCardText}>
        Comece agora e tenha{"\n"}uma experiência incrível!
      </Text>
    </View>
  );
}

function OnboardingDots({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.dots}>
      {clearSlides.map((slide, itemIndex) => (
        <View
          key={slide.key}
          style={[
            styles.dot,
            itemIndex === activeIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function PrimaryButton({
  label,
  isLast,
  onPress,
}: {
  label: string;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.buttonShadow}>
      <LinearGradient
        colors={isLast ? ["#FF3F86", "#FF5A9B"] : ["#7C3AED", "#5B25D9"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}
      >
        <Text allowFontScaling={false} style={styles.primaryButtonText}>
          {label}
        </Text>
        {isLast ? <AppIcon name="ChevronRight" size={20} color="#FFFFFF" strokeWidth={2.7} /> : null}
      </LinearGradient>
    </Pressable>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  skipButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingLeft: 18,
  },
  skipText: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
  },
  scrollSmall: {
    paddingTop: 0,
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  titleBlock: {
    alignItems: "center",
  },
  title: {
    color: colors.text,
    textAlign: "center",
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: 0,
  },
  titleSmall: {
    fontSize: 28,
    lineHeight: 34,
  },
  titleAccent: {
    color: colors.pink,
  },
  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "500",
    marginTop: 12,
  },
  heroWrap: {
    height: 310,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  heroWrapSmall: {
    height: 260,
    marginTop: 16,
  },
  heroHalo: {
    position: "absolute",
    width: 272,
    height: 236,
    borderRadius: 70,
    backgroundColor: colors.lavender,
    transform: [{ rotate: "-8deg" }],
  },
  heroHaloPink: {
    backgroundColor: colors.pinkSoft,
  },
  heroImage: {
    width: "100%",
    height: 300,
  },
  heroImageSmall: {
    height: 250,
  },
  floatReviewCard: {
    position: "absolute",
    left: 0,
    top: 38,
    width: 132,
    height: 82,
  },
  floatReviewCardSmall: {
    width: 112,
    height: 70,
    top: 30,
  },
  floatConfirmedCard: {
    position: "absolute",
    right: 0,
    bottom: 32,
    width: 150,
    height: 74,
  },
  floatConfirmedCardSmall: {
    width: 128,
    height: 64,
    bottom: 24,
  },
  floatSafescoreCard: {
    position: "absolute",
    right: 12,
    bottom: 28,
    width: 164,
    height: 94,
  },
  floatSafescoreCardSmall: {
    width: 140,
    height: 80,
    bottom: 22,
  },
  decorIcon: {
    position: "absolute",
    borderRadius: 16,
  },
  decorHeart: {
    left: 20,
    top: 36,
  },
  decorCalendar: {
    right: 24,
    top: 48,
  },
  decorShield: {
    left: 28,
    bottom: 42,
  },
  decorStar: {
    right: 34,
    bottom: 50,
  },
  features: {
    gap: 12,
    marginTop: 4,
  },
  featureItem: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  startCard: {
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  startCardSmall: {
    marginTop: 0,
    padding: 15,
  },
  giftIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  startCardText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "900",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.background,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginBottom: 16,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.divider,
  },
  buttonShadow: {
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
  },
  splashPressable: {
    flex: 1,
  },
  splash: {
    flex: 1,
  },
  splashBg: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  splashShape: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  splashShapeTop: {
    top: -70,
    right: -44,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  splashShapeLeft: {
    left: -86,
    top: 190,
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  splashShapeBottom: {
    right: -72,
    bottom: 96,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  splashCenter: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  splashTitle: {
    color: colors.surface,
    textAlign: "center",
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: 0,
  },
  splashTitleAccent: {
    color: colors.pink,
  },
  splashHeart: {
    position: "absolute",
    bottom: 92,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
});
