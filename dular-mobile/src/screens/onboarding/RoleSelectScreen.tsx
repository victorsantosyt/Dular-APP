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
import { AppIcon, type AppIconName } from "@/components/ui";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuthStore } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { PageDots } from "@/components/onboarding/PageDots";
import { colors as tc, typography } from "@/theme/tokens";

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR";

const { width } = Dimensions.get("window");

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;
type ChosenRole = "empregador" | "profissional_casa" | "montador";
// Ícones vinham do Ionicons enquanto o resto do app usa o AppIcon (lucide).
// Duas famílias na mesma fileira: o escudo do Ionicons tem traço e geometria
// diferentes dos vizinhos e saltava aos olhos.

const empregadorImg = require("../../../assets/images/roles/role_cliente_card.png");
const diaristaImg = require("../../../assets/images/roles/role_diarista_card.png");
const MONTADOR_IMAGE_ASSET = "assets/images/roles/role_montador_card.png";
const montadorImg = require("../../../assets/images/roles/role_montador_card.png");

// Cores de identidade dos cards de role (preview de onboarding, pré-login).
// FASE 4 — desacopladas do resolvedor de tema, que não infere mais gênero por
// role. Constantes diretas preservam o visual histórico.
const PURPLE = "#7B5CFA";  // Empregador
const PINK   = "#F7658B";  // Profissional (diarista, babá, cozinheira…)
const TEAL   = "#4FA38F";  // Montador

const DARK = tc.navyDeep;
const GRAY = tc.grayMid;
const GRAY_MID = tc.grayFeat;
const GRAY_FEAT = tc.grayText;

type Feature = { icon: AppIconName; text: string };

const empregadorFeatures: Feature[] = [
  { icon: "Search", text: "Profissionais de confiança" },
  { icon: "Calendar", text: "Agende rápido" },
  { icon: "ShieldCheck", text: "Pagamento seguro" },
  { icon: "Star", text: "Avaliações reais" },
];

const diaristaFeatures: Feature[] = [
  { icon: "Star", text: "Apareça na busca" },
  { icon: "Calendar", text: "Agenda na sua região" },
  { icon: "Wallet", text: "Ganhos transparentes" },
  { icon: "BarChart3", text: "Seu desempenho" },
];

const montadorFeatures: Feature[] = [
  { icon: "Wrench", text: "Monte com precisão" },
  { icon: "Calendar", text: "Perto de você" },
  { icon: "Wallet", text: "Ganhos transparentes" },
  { icon: "Star", text: "Construa reputação" },
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
          <AppIcon name="ArrowLeft" size={20} color={PURPLE} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      <PageDots total={2} active={0} />

      <View style={styles.headerSide} />
    </View>
  );
}

// ─── Role Card ────────────────────────────────────────────────────────────────

type RoleCardProps = {
  image?: ReturnType<typeof require>;
  fallbackIcon?: AppIconName;
  accent: string;
  bgTop: string;
  bgCard: string;
  borderHex: string;
  title: string;
  description: string;
  badgeIcon: AppIconName;
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
  // Proporção real da arte, lida do próprio asset. A caixa tinha altura fixa
  // (220) e o `cover` recortava pelo centro para caber — como a cabeça das
  // pessoas fica junto da borda de cima, o corte comia o topo (o boné do
  // montador aparecia cortado). Com a caixa na proporção da imagem, nada é
  // cortado, em qualquer largura de tela, e trocar a arte não exige recalibrar
  // altura nenhuma.
  const fonte = image ? Image.resolveAssetSource(image) : null;
  const proporcaoArte =
    fonte?.width && fonte?.height ? fonte.width / fonte.height : 16 / 10;

  return (
    <View style={[styles.card, { borderColor: borderHex, backgroundColor: bgCard }]}>
      {/* ── Top photo area ── */}
      <View style={[styles.cardTop, { backgroundColor: bgTop, aspectRatio: proporcaoArte }]}>
        {image ? (
          <Image source={image} style={styles.cardFullImage} resizeMode="cover" />
        ) : (
          <View
            style={styles.cardFallbackImage}
            accessibilityLabel={`Fallback visual para ${MONTADOR_IMAGE_ASSET}`}
          >
            <AppIcon name={fallbackIcon ?? badgeIcon} size={92} color={accent} strokeWidth={1.6} />
          </View>
        )}

        <View style={styles.cardTopText}>
          <Text allowFontScaling={false} style={styles.souText}>Sou</Text>
          <Text allowFontScaling={false} style={[styles.cardTitle, { color: accent }]}>{title}</Text>
          <Text allowFontScaling={false} style={styles.cardDesc}>{description}</Text>
        </View>
      </View>

      <View style={[styles.cardBadge, { backgroundColor: accent }]}>
        <AppIcon name={badgeIcon} size={22} color={tc.white} strokeWidth={2.2} />
      </View>

      {/* ── Bottom features + button ── */}
      <View style={styles.cardBottom}>
        <View style={styles.featuresRow}>
          {features.map((f) => (
            <View key={f.text} style={styles.featureItem}>
              <AppIcon name={f.icon} size={22} color={accent} strokeWidth={2.1} />
              <Text
                allowFontScaling={false}
                numberOfLines={2}
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
    const mapped: Role = role === "empregador" ? "EMPREGADOR" : role === "profissional_casa" ? "DIARISTA" : "MONTADOR";
    const auth = useAuthStore.getState();
    auth.setSelectedRole(mapped);
    // FASE 3 — gênero é coletado pós-login (GeneroGate). Os serviços oferecidos da
    // profissional de casa também são coletados pós-login (NichosGate), gravando
    // direto no backend. Todos os perfis seguem direto ao Login.
    navigation.navigate("Login");
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
          {/* Sem o "\n" fixo: a quebra era cravada no texto e não tinha
              como caber em uma linha. Encurtado para seguir a regra das
              telas anteriores — o subtítulo abaixo já explica o resto. */}
          <Text allowFontScaling={false} style={styles.title} numberOfLines={1}>
            Escolha seu <Text style={styles.titleAccent}>perfil</Text>
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
          badgeIcon="UserRound"
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
          // "Casa" ao lado de "Empregador" e "Montador" lia como um lugar, não
          // como alguém. E este perfil não é só diarista: guarda babá,
          // cozinheira, cuidadora, passadeira, lavadeira — "Profissional"
          // cobre todas sem eleger uma.
          title="Profissional"
          description={"Conquiste mais\noportunidades e\naumente sua renda."}
          badgeIcon="BriefcaseBusiness"
          features={diaristaFeatures}
          buttonLabel="Sou Profissional"
          onPress={() => chooseRole("profissional_casa")}
        />

        <RoleCard
          image={montadorImg}
          fallbackIcon="Wrench"
          accent={TEAL}
          bgTop="#DFF2ED"
          bgCard="#F0FAF8"
          borderHex={TEAL + "4D"}
          title="Montador"
          description={"Instale e monte\ncom qualidade e\nprecisão."}
          badgeIcon="Wrench"
          features={montadorFeatures}
          buttonLabel="Sou Montador"
          onPress={() => chooseRole("montador")}
        />

        {/* Security footer */}
        <View style={styles.footer}>
          <View style={styles.footerIcon}>
            <AppIcon name="Lock" size={18} color="#9A7BE8" strokeWidth={2.2} />
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
    // Mesmo token das telas de onboarding.
    ...typography.onboardingTitle,
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
    // Altura vem do `aspectRatio` da arte, aplicado no componente.
    width: "100%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
  },
  cardFullImage: {
    // Preenche a caixa inteira; como a caixa já está na proporção da arte,
    // o "cover" não tem nada para cortar.
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
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
    ...typography.caption,
    fontWeight: "700",
    color: GRAY_MID,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  cardTitle: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.5,
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
    // Duas linhas reservadas em todas as colunas (caption tem lineHeight 16):
    // sem isso cada rótulo quebrava num número diferente de linhas e a fileira
    // ficava irregular, com ícones alinhados e textos desencontrados.
    minHeight: 32,
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
