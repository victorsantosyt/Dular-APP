import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIcon } from "@/components/ui";
import { colors } from "@/theme/tokens";
import { useAuthStore } from "@/stores/authStore";
import type { Genero } from "@/stores/authStore";
import type { OnboardingStackParamList } from "@/navigation/OnboardingNavigator";

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
  const setSelectedGenero = useAuthStore((state) => state.setSelectedGenero);

  const choose = (genero: Genero) => {
    setSelectedGenero(genero);
    navigation.navigate("Login");
  };

  return (
    <SafeAreaView style={s.safe}>
      {/* Botão de voltar — permite retornar à seleção de perfil */}
      <Pressable style={s.backRow} onPress={() => navigation.goBack()}>
        <AppIcon name="ArrowLeft" size={20} color={colors.primary} strokeWidth={2.5} />
        <Text style={s.backText}>Voltar</Text>
      </Pressable>

      <View style={s.content}>
        {/* Step indicator: passo 2 de 3 */}
        <View style={s.stepWrap}>
          <View style={s.stepRow}>
            <View style={[s.step, s.stepDone]}>
              <AppIcon name="Check" size={13} color={colors.white} strokeWidth={3} />
            </View>
            <View style={[s.stepLine, s.stepLineDone]} />
            <View style={[s.step, s.stepActive]}>
              <Text style={s.stepActiveNum}>2</Text>
            </View>
            <View style={[s.stepLine, s.stepLineIdle]} />
            <View style={[s.step, s.stepIdle]}>
              <Text style={s.stepIdleNum}>3</Text>
            </View>
          </View>
          <Text style={s.stepCaption}>2 de 3</Text>
        </View>

        <Text style={s.title}>Você é?</Text>
        <Text style={s.subtitle}>
          Queremos personalizar sua experiência{"\n"}no Dular.
        </Text>

        <View style={s.options}>
          <GeneroOption
            label="Homem"
            accent={colors.primary}
            softBg={colors.lavender}
            onPress={() => choose("MASCULINO")}
          />
          <GeneroOption
            label="Mulher"
            accent={colors.notification}
            softBg={colors.dangerSoft}
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
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    minHeight: 44,
  },
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  stepWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  step: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDone: {
    backgroundColor: colors.primary,
  },
  stepActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  stepIdle: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepLine: {
    width: 48,
    height: 2,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: colors.primary,
  },
  stepLineIdle: {
    backgroundColor: colors.border,
  },
  stepActiveNum: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  stepIdleNum: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  stepCaption: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 7,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -0.7,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
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
    fontSize: 18,
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
    fontSize: 12,
    lineHeight: 17,
  },
});
