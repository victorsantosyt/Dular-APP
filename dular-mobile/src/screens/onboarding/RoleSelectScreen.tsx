import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ComponentProps } from "react";
import { DularLogo } from "@/assets/brand";
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { colors as tc } from "@/theme/tokens";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

const { width } = Dimensions.get("window");

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type ChosenRole = "empregador" | "diarista" | "montador";
type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const clienteImg = require("../../../assets/images/roles/role_cliente_card.png");
const diaristaImg = require("../../../assets/images/roles/role_diarista_card.png");
// Imagem placeholder para Montador — substituir quando asset próprio existir
const montadorImg = require("../../../assets/images/roles/role_diarista_card.png");

const PURPLE = tc.purpleStep;
const PINK = tc.pink;
const DARK = tc.navyDeep;
const GRAY = tc.grayMid;
const GRAY_MID = tc.grayFeat;
const GRAY_FEAT = tc.grayText;

type Feature = { icon: IoniconsName; text: string };

const clienteFeatures: Feature[] = [
  { icon: "search-outline", text: "Encontre\nprofissionais\nqualificadas" },
  { icon: "calendar-outline", text: "Agende em\npoucos cliques\ne economize tempo" },
  { icon: "shield-checkmark-outline", text: "Pagamento\nseguro e\nprotegido" },
  { icon: "star-outline", text: "Avaliações e\nrecomendações\nde quem já usou" },
];

const diaristaFeatures: Feature[] = [
  { icon: "star-outline", text: "Destaque seu\nperfil e seja\nencontrada" },
  { icon: "calendar-outline", text: "Receba\nagendamentos\nna sua região" },
  { icon: "wallet-outline", text: "Ganhos\nseguros e\ntransparentes" },
  { icon: "bar-chart-outline", text: "Acompanhe seu\ndesempenho e\nevolua sempre" },
];

const montadorFeatures: Feature[] = [
  { icon: "construct-outline", text: "Monte com\nprecisão e\nqualidade" },
  { icon: "calendar-outline", text: "Receba\noportunidades\nna sua região" },
  { icon: "wallet-outline", text: "Ganhos\nseguros e\ntransparentes" },
  { icon: "star-outline", text: "Construa sua\nreputação\nprofissional" },
];

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ onSkip }: { onSkip: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerSpacer} />

      <View style={styles.stepCenter}>
        <View style={styles.stepRow}>
          <View style={styles.stepCircleActive}>
            <Text allowFontScaling={false} style={styles.stepActiveText}>1</Text>
          </View>
          <View style={styles.stepDash} />
          <View style={styles.stepCircleInactive}>
            <Text allowFontScaling={false} style={styles.stepInactiveText}>2</Text>
          </View>
          <View style={styles.stepDash} />
          <View style={styles.stepCircleInactive}>
            <Text allowFontScaling={false} style={styles.stepInactiveText}>3</Text>
          </View>
        </View>
        <Text allowFontScaling={false} style={styles.stepCaption}>1 de 3</Text>
      </View>

      <View style={styles.headerRight}>
        <TouchableOpacity onPress={onSkip} hitSlop={12} accessibilityRole="button" accessibilityLabel="Pular">
          <Text allowFontScaling={false} style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

type RoleCardProps = {
  image: ReturnType<typeof require>;
  accent: string;
  bgTop: string;
  bgCard: string;
  borderHex: string;
  title: string;
  description: string;
  badgeIcon: IoniconsName;
  features: Feature[];
  buttonLabel: string;
  onPress: () => void;
};

function RoleCard({
  image,
  accent,
  bgTop,
  bgCard,
  borderHex,
  title,
  description,
  badgeIcon,
  features,
  buttonLabel,
  onPress,
}: RoleCardProps) {
  return (
    <View style={[styles.card, { borderColor: borderHex, backgroundColor: bgCard }]}>
      {/* ── Top photo area ── */}
      <View style={[styles.cardTop, { backgroundColor: bgTop }]}>
        <Image source={image} style={styles.cardFullImage} resizeMode="cover" />

        <View style={styles.cardTopText}>
          <Text allowFontScaling={false} style={styles.souText}>Sou</Text>
          <Text allowFontScaling={false} style={[styles.cardTitle, { color: accent }]}>{title}</Text>
          <Text allowFontScaling={false} style={styles.cardDesc}>{description}</Text>
        </View>
      </View>

      <View style={[styles.cardBadge, { backgroundColor: accent }]}>
        <Ionicons name={badgeIcon} size={22} color={tc.white} />
      </View>

      {/* ── Bottom features + button ── */}
      <View style={styles.cardBottom}>
        <View style={styles.featuresRow}>
          {features.map((f) => (
            <View key={f.text} style={styles.featureItem}>
              <Ionicons name={f.icon} size={22} color={accent} />
              <Text
                allowFontScaling={false}
                numberOfLines={3}
                style={styles.featureText}
              >
                {f.text}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: accent }]}
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text allowFontScaling={false} style={styles.buttonText}>{buttonLabel} →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function RoleSelectScreen() {
  const navigation = useNavigation<Navigation>();

  const chooseRole = (role: ChosenRole) => {
    const mapped: Role = role === "empregador" ? "EMPREGADOR" : role === "diarista" ? "DIARISTA" : "MONTADOR";
    useAuthStore.getState().setSelectedRole(mapped);
    navigation.navigate("GeneroSelect");
  };

  const skip = () => navigation.navigate("Login");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StepIndicator onSkip={skip} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <DularLogo size="md" />
        </View>

        {/* Title + subtitle */}
        <View style={styles.titleBlock}>
          <Text allowFontScaling={false} style={styles.title}>
            {"Escolha seu perfil\n"}
            <Text style={styles.titleAccent}>para começar</Text>
          </Text>

          <View style={styles.subtitleRow}>
            <Text style={styles.subtitleDecL}>✦</Text>
            <Text allowFontScaling={false} style={styles.subtitle}>
              {"Selecione o perfil que melhor descreve você.\nVocê pode alterar isso depois."}
            </Text>
            <Text style={styles.subtitleDecR}>♥</Text>
          </View>
        </View>

        {/* Cards */}
        <RoleCard
          image={clienteImg}
          accent={PURPLE}
          bgTop="#EDE9FF"
          bgCard="#F5F3FF"
          borderHex="#7C5CFF4D"
          title="Empregador"
          description={"Encontre diaristas\nconfiáveis e facilite\nsua rotina."}
          badgeIcon="person-outline"
          features={clienteFeatures}
          buttonLabel="Sou Empregador"
          onPress={() => chooseRole("empregador")}
        />

        <RoleCard
          image={diaristaImg}
          accent={PINK}
          bgTop="#FFE0EC"
          bgCard="#FFF0F5"
          borderHex="#FF6B9A4D"
          title="Diarista"
          description={"Conquiste mais\noportunidades e\naumente sua renda."}
          badgeIcon="briefcase-outline"
          features={diaristaFeatures}
          buttonLabel="Sou Diarista"
          onPress={() => chooseRole("diarista")}
        />

        <RoleCard
          image={montadorImg}
          accent={tc.teal}
          bgTop="#DFF2ED"
          bgCard="#F0FAF8"
          borderHex={tc.teal + "4D"}
          title="Montador"
          description={"Instale e monte\ncom qualidade e\nprecisão."}
          badgeIcon="construct-outline"
          features={montadorFeatures}
          buttonLabel="Sou Montador"
          onPress={() => chooseRole("montador")}
        />

        {/* Security footer */}
        <View style={styles.footer}>
          <View style={styles.footerIcon}>
            <Ionicons name="lock-closed" size={18} color={tc.white} />
          </View>
          <View style={styles.footerText}>
            <Text allowFontScaling={false} style={styles.footerTitle}>Seguro e confiável</Text>
            <Text allowFontScaling={false} style={styles.footerSubtitle}>
              {"Todos os perfis são verificados e seus\ndados são protegidos com total sigilo."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default RoleSelectScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_WIDTH = width - 32;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: tc.white,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  headerSpacer: { flex: 1 },
  headerRight: { flex: 1, alignItems: "flex-end" },
  stepCenter: { alignItems: "center", gap: 6 },
  stepRow: { flexDirection: "row", alignItems: "center" },
  stepCircleActive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PURPLE,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepActiveText: { color: tc.white, fontSize: 13, fontWeight: "800" },
  stepDash: {
    width: 36,
    height: 2,
    backgroundColor: tc.grayDisabled,
    marginHorizontal: 6,
  },
  stepCircleInactive: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: tc.grayBorder,
    backgroundColor: tc.white,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInactiveText: { color: tc.grayLight, fontSize: 13, fontWeight: "800" },
  stepCaption: { color: PURPLE, fontSize: 12, fontWeight: "700" },
  skipText: { color: PURPLE, fontSize: 14, fontWeight: "600" },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 20,
  },

  // Logo
  logoWrap: { alignSelf: "center" },

  // Title
  titleBlock: { alignItems: "center", gap: 10 },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: DARK,
    textAlign: "center",
  },
  titleAccent: { color: PINK },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: GRAY,
    textAlign: "center",
    flex: 1,
  },
  subtitleDecL: { fontSize: 18, color: PINK, fontWeight: "700" },
  subtitleDecR: { fontSize: 18, color: PURPLE, fontWeight: "700" },

  // Card
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: tc.black,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTop: {
    height: 220,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  cardFullImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: CARD_WIDTH,
    height: 220,
  },
  cardTopText: {
    position: "absolute",
    top: 20,
    left: 16,
    zIndex: 2,
  },
  souText: {
    fontSize: 18,
    fontWeight: "600",
    color: DARK,
    lineHeight: 22,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
  },
  cardDesc: {
    fontSize: 13,
    color: GRAY_MID,
    lineHeight: 19,
    marginTop: 6,
  },
  cardBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    shadowColor: tc.black,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // Card bottom
  cardBottom: {
    backgroundColor: tc.white,
    padding: 16,
  },
  featuresRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  featureItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  featureText: {
    fontSize: 10,
    color: GRAY_FEAT,
    textAlign: "center",
    lineHeight: 13,
  },
  button: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: tc.black,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonText: {
    color: tc.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: tc.lavenderSoftAlt,
    borderWidth: 1,
    borderColor: tc.lavenderDivider,
  },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { flex: 1 },
  footerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: DARK,
    lineHeight: 18,
  },
  footerSubtitle: {
    fontSize: 11,
    color: GRAY,
    lineHeight: 15,
    marginTop: 2,
  },
});
