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
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { PageDots } from "@/components/onboarding/PageDots";
import { colors as tc, typography } from "@/theme/tokens";
import { getProfileTheme } from "@/theme/profileTheme";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

const { width } = Dimensions.get("window");

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type ChosenRole = "empregador" | "diarista" | "montador";
type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const empregadorImg = require("../../../assets/images/roles/role_cliente_card.png");
const diaristaImg = require("../../../assets/images/roles/role_diarista_card.png");
const MONTADOR_IMAGE_ASSET = "assets/images/roles/role_montador_card.png";
const montadorImg = require("../../../assets/images/roles/role_montador_card.png");

// Role card accent colors — always use fallback palettes (gender not yet known on this screen)
const PURPLE = getProfileTheme("EMPREGADOR", null).primary;   // #7B5CFA
const PINK   = getProfileTheme("DIARISTA",   null).primary;   // #F7658B  (fallback = Feminino)
const TEAL   = getProfileTheme("MONTADOR",   null).primary;   // #4FA38F  (fallback = Masculino)

const DARK = tc.navyDeep;
const GRAY = tc.grayMid;
const GRAY_MID = tc.grayFeat;
const GRAY_FEAT = tc.grayText;

type Feature = { icon: IoniconsName; text: string };

const empregadorFeatures: Feature[] = [
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

function StepIndicator({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerSide}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={12}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Voltar para onboarding"
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={PURPLE} />
        </TouchableOpacity>
      </View>

      <PageDots total={3} active={0} />

      <View style={styles.headerSide} />
    </View>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

type RoleCardProps = {
  image?: ReturnType<typeof require>;
  fallbackIcon?: IoniconsName;
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
  fallbackIcon,
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
        {image ? (
          <Image source={image} style={styles.cardFullImage} resizeMode="cover" />
        ) : (
          <View
            style={styles.cardFallbackImage}
            accessibilityLabel={`Fallback visual para ${MONTADOR_IMAGE_ASSET}`}
          >
            <Ionicons name={fallbackIcon ?? badgeIcon} size={92} color={accent} />
          </View>
        )}

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <StepIndicator onBack={() => navigation.replace("Start")} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
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
          image={empregadorImg}
          accent={PURPLE}
          bgTop="#EDE9FF"
          bgCard="#F5F3FF"
          borderHex={PURPLE + "4D"}
          title="Empregador"
          description={"Encontre profissionais\nconfiáveis e facilite\nsua rotina."}
          badgeIcon="person-outline"
          features={empregadorFeatures}
          buttonLabel="Sou Empregador"
          onPress={() => chooseRole("empregador")}
        />

        <RoleCard
          image={diaristaImg}
          accent={PINK}
          bgTop="#FFE0EC"
          bgCard="#FFF0F5"
          borderHex={PINK + "4D"}
          title="Diarista"
          description={"Conquiste mais\noportunidades e\naumente sua renda."}
          badgeIcon="briefcase-outline"
          features={diaristaFeatures}
          buttonLabel="Sou Diarista"
          onPress={() => chooseRole("diarista")}
        />

        <RoleCard
          image={montadorImg}
          fallbackIcon="construct-outline"
          accent={TEAL}
          bgTop="#DFF2ED"
          bgCard="#F0FAF8"
          borderHex={TEAL + "4D"}
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
            <Ionicons name="lock-closed" size={18} color="#9A7BE8" />
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
  headerSide: {
    flex: 1,
    minWidth: 72,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tc.white,
    borderWidth: 1,
    borderColor: tc.grayBorder,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 20,
  },
  // Title
  titleBlock: { alignItems: "center", gap: 10 },
  title: {
    ...typography.h1,
    
    fontWeight: "700",
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
    ...typography.bodySm,
    
    color: GRAY,
    textAlign: "center",
    flex: 1,
  },
  subtitleDecL: { ...typography.title, color: PINK, fontWeight: "700" },
  subtitleDecR: { ...typography.title, color: PURPLE, fontWeight: "700" },

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
  cardFallbackImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.16,
  },
  cardTopText: {
    position: "absolute",
    top: 20,
    left: 16,
    zIndex: 2,
  },
  souText: {
    ...typography.title,
    fontWeight: "600",
    color: DARK,
    
  },
  cardTitle: {
    ...typography.h1,
    fontWeight: "700",
    
  },
  cardDesc: {
    ...typography.bodySm,
    color: GRAY_MID,
    
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
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
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
    ...typography.caption,
    color: GRAY_FEAT,
    textAlign: "center",
    
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
    ...typography.bodyMedium,
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
    backgroundColor: "#FCF9FF",
    borderWidth: 1,
    borderColor: "#EFE7FA",
  },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3ECFF",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { flex: 1 },
  footerTitle: {
    ...typography.bodySm,
    fontWeight: "700",
    color: DARK,
    
  },
  footerSubtitle: {
    ...typography.caption,
    color: GRAY,
    
    marginTop: 2,
  },
});
