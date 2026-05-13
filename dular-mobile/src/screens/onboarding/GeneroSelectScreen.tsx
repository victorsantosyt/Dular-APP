import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui";
import { PageDots } from "@/components/onboarding/PageDots";
import { colors, typography } from "@/theme/tokens";
import { useAuthStore } from "@/stores/authStore";
import type { Genero } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";
import { getProfileTheme } from "@/theme/profileTheme";

type Navigation = NativeStackNavigationProp<OnboardingStackParamList>;

type GeneroOptionProps = {
  label: string;
  accent: string;
  softBg: string;
  onPress: () => void;
};

function GeneroOption({ label, accent, softBg, onPress }: GeneroOptionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.option,
        { borderColor: accent + "40" },
        pressed && { backgroundColor: softBg, transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={[s.optionIcon, { backgroundColor: softBg }]}>
        <AppIcon name="User" size={26} color={accent} strokeWidth={2.1} />
      </View>
      <Text style={s.optionLabel}>{label}</Text>
      <AppIcon name="ChevronRight" size={20} color={colors.textMuted} strokeWidth={2.2} />
    </Pressable>
  );
}

export function GeneroSelectScreen() {
  const navigation = useNavigation<Navigation>();
  const selectedRole = useAuthStore((state) => state.selectedRole);
  const setSelectedGenero = useAuthStore((state) => state.setSelectedGenero);

  // Derive the role-specific palette (gender not yet chosen — use fallback)
  const theme = getProfileTheme(selectedRole, null);

  useEffect(() => {
    if (!selectedRole) {
      navigation.replace("RoleSelect");
    }
  }, [navigation, selectedRole]);

  const choose = (genero: Genero) => {
    setSelectedGenero(genero);
    navigation.navigate("Login");
  };

  const handleBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "RoleSelect" }],
    });
  };

  // For DIARISTA the "Mulher" option is the default/fallback palette — use Feminino accent
  // For MONTADOR the "Homem" option is the default/fallback palette — use Masculino accent
  // Both options always show their respective gender accent regardless of role
  const masculinoTheme = getProfileTheme(
    selectedRole === "EMPREGADOR" ? "EMPREGADOR" : "MONTADOR",
    "MASCULINO",
  );
  const femininoTheme = getProfileTheme(
    selectedRole === "EMPREGADOR" ? "EMPREGADOR" : "DIARISTA",
    "FEMININO",
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.headerSide}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={({ pressed }) => [s.backButton, pressed && s.backButtonPressed]}
          >
            <AppIcon name="ArrowLeft" size={20} color={theme.primary} strokeWidth={2.5} />
          </Pressable>
        </View>
        <PageDots total={3} active={1} />
        <View style={s.headerSide} />
      </View>

      <View style={s.content}>
        <Text style={s.title}>Como você quer configurar sua experiência?</Text>
        <Text style={s.subtitle}>
          Isso ajuda o Dular a personalizar cores, comunicação e segurança do seu perfil.
        </Text>

        <View style={s.options}>
          <GeneroOption
            label="Homem"
            accent={masculinoTheme.primary}
            softBg={masculinoTheme.primarySoft}
            onPress={() => choose("MASCULINO")}
          />
          <GeneroOption
            label="Mulher"
            accent={femininoTheme.primary}
            softBg={femininoTheme.primarySoft}
            onPress={() => choose("FEMININO")}
          />
        </View>

        <View style={s.noteRow}>
          <AppIcon name="Lock" size={14} color={colors.textMuted} strokeWidth={2.2} />
          <Text style={s.noteText}>
            Seus dados são protegidos e não são compartilhados.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default GeneroSelectScreen;

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    minHeight: 40,
  },
  headerSide: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    color: colors.textPrimary,
    ...typography.hero,
    
    fontWeight: "700",
    letterSpacing: -0.7,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.bodySmMedium,
    
    fontWeight: "400",
    textAlign: "center",
    marginBottom: 36,
  },
  options: {
    gap: 14,
    marginBottom: 32,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.title,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  noteText: {
    flex: 1,
    color: colors.textMuted,
    ...typography.caption,
    
  },
});
