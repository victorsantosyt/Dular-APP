import { useRef, useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";

import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { DularLogo } from "@/ui/DularLogo";
import { AUTH_ROUTES } from "@/navigation/routes";

type Role = "CLIENTE" | "DIARISTA";

type AuthParamList = {
  [AUTH_ROUTES.ROLE_SELECT]: undefined;
  [AUTH_ROUTES.OAUTH_LOGIN]: { role: Role };
};

const OPTIONS: { role: Role; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  {
    role: "CLIENTE",
    label: "Sou Cliente",
    description: "Quero encontrar uma diarista de confiança para minha casa.",
    icon: "home-outline",
  },
  {
    role: "DIARISTA",
    label: "Sou Diarista",
    description: "Quero oferecer meus serviços e receber novos clientes.",
    icon: "sparkles-outline",
  },
];

export default function RoleSelect() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthParamList>>();
  const [selected, setSelected] = useState<Role | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 440,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  function handleContinue() {
    if (!selected) return;
    navigation.navigate(AUTH_ROUTES.OAUTH_LOGIN, { role: selected });
  }

  return (
    <LinearGradient
      colors={[colors.greenLight, colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.root}
    >
      <View style={[s.inner, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>

        <Animated.View
          style={[s.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <DularLogo size="lg" />
          <Text style={s.title}>Como você vai usar o Dular?</Text>
          <Text style={s.subtitle}>Escolha seu perfil para continuar</Text>
        </Animated.View>

        <Animated.View
          style={[s.cards, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {OPTIONS.map((opt) => {
            const active = selected === opt.role;
            return (
              <Pressable
                key={opt.role}
                onPress={() => setSelected(opt.role)}
                style={({ pressed }) => [
                  s.card,
                  active && s.cardActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={[s.iconBox, active && s.iconBoxActive]}>
                  <Ionicons
                    name={opt.icon}
                    size={26}
                    color={active ? colors.card : colors.green}
                  />
                </View>

                <View style={s.cardText}>
                  <Text style={[s.cardLabel, active && s.cardLabelActive]}>{opt.label}</Text>
                  <Text style={s.cardDesc}>{opt.description}</Text>
                </View>

                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
          <Pressable
            onPress={handleContinue}
            disabled={!selected}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={selected ? [colors.greenDark, colors.green] : [colors.stroke, colors.stroke]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[s.btn, !selected && s.btnDisabled]}
            >
              <Text style={[s.btnText, !selected && s.btnTextDisabled]}>Continuar</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.h1,
    textAlign: "center",
    marginTop: 12,
  },
  subtitle: {
    ...typography.sub,
    textAlign: "center",
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardActive: {
    borderColor: colors.green,
    backgroundColor: "#F0FAF4",
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "#EDF7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxActive: {
    backgroundColor: colors.green,
  },
  cardText: {
    flex: 1,
    gap: 4,
  },
  cardLabel: {
    ...typography.h2,
  },
  cardLabelActive: {
    color: colors.greenDark,
  },
  cardDesc: {
    ...typography.sub,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.stroke,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.green,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
  },
  footer: {},
  btn: {
    height: 54,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.greenDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  btnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  btnText: {
    ...typography.btn,
    fontSize: 16,
  },
  btnTextDisabled: {
    color: colors.sub,
  },
});
