import type { ComponentProps } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { DularMark } from "@/assets/brand";
import { getRoleImage, type RoleImageKey } from "@/assets/roleImages";
import { AppIcon } from "@/components/ui";
import { AUTH_ROUTES } from "@/navigation/routes";

type Role = "CLIENTE" | "DIARISTA";
type ProfileVariant = RoleImageKey;
type IconName = ComponentProps<typeof AppIcon>["name"];

type AuthParamList = {
  [AUTH_ROUTES.ROLE_SELECT]: undefined;
  [AUTH_ROUTES.OAUTH_LOGIN]: { role: Role };
};

type Benefit = {
  icon: IconName;
  text: string;
};

type ProfileChoiceCardProps = {
  variant: ProfileVariant;
  titleHighlight: string;
  description: string;
  buttonLabel: string;
  benefits: Benefit[];
  compact: boolean;
  onPress: () => void;
};

const colors = {
  background: "#FCFAFF",
  surface: "#FFFFFF",
  primary: "#6D35E8",
  primaryDark: "#120A4D",
  primarySoft: "#EEE7FF",
  lavender: "#F5EFFF",
  borderPurple: "#D8C5FF",
  pink: "#FF3F86",
  pinkSoft: "#FFF0F6",
  borderPink: "#FFD3E3",
  text: "#120A4D",
  textMuted: "#6F6A8F",
  divider: "#E8E2F4",
  successSoft: "#F4EDFF",
};

const clienteBenefits: Benefit[] = [
  { icon: "Search", text: "Encontre profissionais qualificadas" },
  { icon: "Calendar", text: "Agende em poucos cliques" },
  { icon: "ShieldCheck", text: "Pagamento seguro e protegido" },
  { icon: "Star", text: "Avaliações de quem já usou" },
];

const diaristaBenefits: Benefit[] = [
  { icon: "Star", text: "Destaque seu perfil" },
  { icon: "Calendar", text: "Receba agendamentos" },
  { icon: "Wallet", text: "Ganhos seguros" },
  { icon: "BarChart3", text: "Acompanhe seu desempenho" },
];

function StepIndicator() {
  return (
    <View style={styles.stepWrap}>
      <View style={styles.stepRow}>
        <View style={styles.stepCircleActive}>
          <Text allowFontScaling={false} style={styles.stepActiveText}>
            1
          </Text>
        </View>

        <View style={styles.stepLine} />

        <View style={styles.stepCircleInactive}>
          <Text allowFontScaling={false} style={styles.stepInactiveText}>
            2
          </Text>
        </View>
      </View>

      <Text allowFontScaling={false} style={styles.stepLabel}>
        1 de 2
      </Text>
    </View>
  );
}

function LogoBlock() {
  return (
    <View style={styles.logoWrap}>
      <DularMark size={43} variant="color" />
      <Text allowFontScaling={false} style={styles.logoText}>
        dular
      </Text>
    </View>
  );
}

function BenefitItem({
  benefit,
  accent,
  isLast,
}: {
  benefit: Benefit;
  accent: string;
  isLast: boolean;
}) {
  return (
    <View style={styles.benefitCell}>
      <View style={[styles.benefitIcon, { backgroundColor: `${accent}12` }]}>
        <AppIcon name={benefit.icon} size={17} color={accent} strokeWidth={2.25} />
      </View>

      <Text
        allowFontScaling={false}
        numberOfLines={3}
        adjustsFontSizeToFit
        minimumFontScale={0.76}
        style={styles.benefitText}
      >
        {benefit.text}
      </Text>

      {!isLast && <View style={styles.benefitDivider} />}
    </View>
  );
}

function ProfileChoiceCard({
  variant,
  titleHighlight,
  description,
  buttonLabel,
  benefits,
  compact,
  onPress,
}: ProfileChoiceCardProps) {
  const isCliente = variant === "cliente";

  const accent = isCliente ? colors.primary : colors.pink;
  const border = isCliente ? colors.borderPurple : colors.borderPink;

  const cardGradient = isCliente
    ? (["#FFFFFF", "#FBF7FF"] as const)
    : (["#FFFFFF", "#FFF8FB"] as const);

  const buttonGradient = isCliente
    ? (["#8F63F3", colors.primary] as const)
    : (["#FF5FA0", colors.pink] as const);

  return (
    <View style={[styles.cardShadow, { shadowColor: accent }]}>
      <LinearGradient
        colors={cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.profileCard,
          compact && styles.profileCardCompact,
          { borderColor: border },
        ]}
      >
        <View style={styles.cardCopy}>
          <Text allowFontScaling={false} style={styles.cardTitleTop}>
            Sou
          </Text>

          <Text
            allowFontScaling={false}
            style={[styles.cardTitleHighlight, { color: accent }]}
          >
            {titleHighlight}
          </Text>

          <Text
            allowFontScaling={false}
            numberOfLines={4}
            adjustsFontSizeToFit
            minimumFontScale={0.9}
            style={styles.cardDescription}
          >
            {description}
          </Text>
        </View>

        <View
          pointerEvents="none"
          style={[
            styles.heroBackground,
            compact && styles.heroBackgroundCompact,
            isCliente ? styles.clientHeroBackground : styles.diaristaHeroBackground,
          ]}
        />

        <View
          pointerEvents="none"
          style={[styles.heroImageArea, compact && styles.heroImageAreaCompact]}
        >
          <Image
            source={getRoleImage(variant)}
            style={[
              styles.heroImage,
              compact && styles.heroImageCompact,
              isCliente ? styles.clientHeroImage : styles.diaristaHeroImage,
            ]}
            resizeMode="contain"
          />
        </View>

        <View style={[styles.roleIconBadge, { backgroundColor: accent }]}>
          <AppIcon
            name={isCliente ? "User" : "BriefcaseBusiness"}
            size={24}
            color="#FFFFFF"
            strokeWidth={2.2}
          />
        </View>

        <View style={[styles.benefitsBox, compact && styles.benefitsBoxCompact]}>
          {benefits.map((benefit, index) => (
            <BenefitItem
              key={`${variant}-${benefit.text}`}
              benefit={benefit}
              accent={accent}
              isLast={index === benefits.length - 1}
            />
          ))}
        </View>

        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.buttonPressable,
            compact && styles.buttonPressableCompact,
            pressed && styles.buttonPressed,
          ]}
        >
          <LinearGradient
            colors={buttonGradient}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradientButton}
          >
            <Text allowFontScaling={false} style={styles.buttonText}>
              {buttonLabel}
            </Text>
            <AppIcon name="ChevronRight" size={22} color="#FFFFFF" strokeWidth={2.5} />
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

function TrustFooter() {
  return (
    <View style={styles.trustFooter}>
      <View style={styles.trustIconWrap}>
        <AppIcon name="Lock" size={24} color={colors.primary} strokeWidth={2.3} />
      </View>

      <View style={styles.trustCopy}>
        <Text allowFontScaling={false} style={styles.trustTitle}>
          Seguro e confiável
        </Text>

        <Text allowFontScaling={false} style={styles.trustText}>
          Todos os perfis são verificados e seus dados são protegidos com total sigilo.
        </Text>
      </View>
    </View>
  );
}

export default function RoleSelect() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthParamList>>();
  const { height } = useWindowDimensions();

  const compact = height < 740;

  const goTo = (role: Role) => {
    navigation.navigate(AUTH_ROUTES.OAUTH_LOGIN, { role });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="dark" backgroundColor={colors.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
      >
        <View style={styles.topBar}>
          <Pressable hitSlop={12} onPress={() => goTo("CLIENTE")} style={styles.skipButton}>
            <Text allowFontScaling={false} style={styles.skipText}>
              Pular
            </Text>
          </Pressable>
        </View>

        <StepIndicator />

        <LogoBlock />

        <View style={[styles.headerText, compact && styles.headerTextCompact]}>
          <Text
            allowFontScaling={false}
            style={[styles.screenTitle, compact && styles.screenTitleCompact]}
          >
            Escolha seu perfil{"\n"}
            <Text allowFontScaling={false} style={styles.titlePink}>
              para começar
            </Text>
          </Text>

          <Text
            allowFontScaling={false}
            style={[styles.subtitle, compact && styles.subtitleCompact]}
          >
            Selecione o perfil que melhor descreve você.{"\n"}
            Você pode alterar isso depois.
          </Text>
        </View>

        <View style={[styles.cardsWrap, compact && styles.cardsWrapCompact]}>
          <ProfileChoiceCard
            variant="cliente"
            titleHighlight="Cliente"
            description="Encontre diaristas confiáveis e facilite sua rotina."
            buttonLabel="Sou Cliente"
            benefits={clienteBenefits}
            compact={compact}
            onPress={() => goTo("CLIENTE")}
          />

          <ProfileChoiceCard
            variant="diarista"
            titleHighlight="Diarista"
            description="Conquiste mais oportunidades e aumente sua renda."
            buttonLabel="Sou Diarista"
            benefits={diaristaBenefits}
            compact={compact}
            onPress={() => goTo("DIARISTA")}
          />
        </View>

        <TrustFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 34,
  },

  contentCompact: {
    paddingTop: 0,
    paddingHorizontal: 20,
  },

  topBar: {
    minHeight: 34,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  skipButton: {
    minHeight: 32,
    justifyContent: "center",
    paddingLeft: 18,
  },

  skipText: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },

  stepWrap: {
    alignItems: "center",
    marginTop: 2,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  stepCircleActive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  stepCircleInactive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },

  stepActiveText: {
    color: colors.surface,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  stepInactiveText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },

  stepLine: {
    width: 58,
    height: 2,
    backgroundColor: colors.divider,
  },

  stepLabel: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    marginTop: 7,
  },

  logoWrap: {
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  logoText: {
    color: colors.primaryDark,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.7,
  },

  headerText: {
    alignItems: "center",
    marginTop: 18,
  },

  headerTextCompact: {
    marginTop: 14,
  },

  screenTitle: {
    color: colors.text,
    textAlign: "center",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.9,
  },

  screenTitleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },

  titlePink: {
    color: colors.pink,
    fontWeight: "700",
  },

  subtitle: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "400",
    marginTop: 12,
    letterSpacing: -0.15,
  },

  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },

  cardsWrap: {
    marginTop: 24,
    gap: 16,
  },

  cardsWrapCompact: {
    marginTop: 18,
    gap: 14,
  },

  cardShadow: {
    borderRadius: 28,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  profileCard: {
    height: 382,
    borderRadius: 28,
    borderWidth: 1.1,
    position: "relative",
    overflow: "hidden",
  },

  profileCardCompact: {
    height: 362,
  },

  cardCopy: {
    position: "absolute",
    left: 22,
    top: 28,
    width: 122,
    zIndex: 8,
  },

  cardTitleTop: {
    color: colors.text,
    fontSize: 23,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.45,
  },

  cardTitleHighlight: {
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.5,
  },

  cardDescription: {
    color: colors.textMuted,
    fontSize: 13.4,
    lineHeight: 18.5,
    fontWeight: "400",
    marginTop: 14,
    maxWidth: 124,
    letterSpacing: -0.15,
  },

  heroBackground: {
    position: "absolute",
    top: 72,
    left: 116,
    right: 0,
    height: 150,
    borderTopLeftRadius: 92,
    borderBottomLeftRadius: 40,
    zIndex: 1,
    overflow: "hidden",
  },

  heroBackgroundCompact: {
    top: 66,
    left: 112,
    height: 142,
  },

  clientHeroBackground: {
    backgroundColor: "#F3ECFF",
  },

  diaristaHeroBackground: {
    backgroundColor: "#FFF0F6",
  },

  heroImageArea: {
    position: "absolute",
    top: 54,
    right: 4,
    width: 292,
    height: 178,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },

  heroImageAreaCompact: {
    top: 50,
    right: 2,
    width: 276,
    height: 166,
  },

  heroImage: {
    width: 292,
    height: 170,
  },

  heroImageCompact: {
    width: 276,
    height: 160,
  },

  clientHeroImage: {
    marginLeft: 0,
    marginTop: 0,
  },

  diaristaHeroImage: {
    marginLeft: 0,
    marginTop: 0,
  },

  roleIconBadge: {
    position: "absolute",
    top: 52,
    right: 30,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
    zIndex: 9,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  benefitsBox: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 214,
    height: 102,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(232, 226, 244, 0.72)",
    flexDirection: "row",
    alignItems: "stretch",
    zIndex: 12,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    overflow: "hidden",
  },

  benefitsBoxCompact: {
    top: 202,
    height: 96,
  },

  benefitCell: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 8,
  },

  benefitDivider: {
    position: "absolute",
    right: 0,
    top: 22,
    bottom: 22,
    width: 1,
    backgroundColor: colors.divider,
  },

  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },

  benefitText: {
    color: colors.text,
    fontSize: 10.5,
    lineHeight: 12.8,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: -0.12,
  },

  buttonPressable: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 16,
    zIndex: 13,
  },

  buttonPressableCompact: {
    bottom: 16,
  },

  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.992 }],
  },

  gradientButton: {
    height: 50,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },

  buttonText: {
    color: colors.surface,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
  },

  trustFooter: {
    marginTop: 24,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 17,
    borderRadius: 24,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.divider,
  },

  trustIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  trustCopy: {
    flex: 1,
  },

  trustTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },

  trustText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    marginTop: 3,
  },
});