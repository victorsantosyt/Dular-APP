import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { colors, radius, shadow, spacing, typography } from "@/theme/tokens";
import { DularLogo } from "@/ui/DularLogo";

type Props = {
  loading?: boolean;
  onEntrar?: (payload: { email: string; senha: string }) => void;
  onForgotPassword?: () => void;
  onCadastro?: () => void;
};

export default function Login({
  loading = false,
  onEntrar,
  onForgotPassword,
  onCadastro,
}: Props) {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [senhaFocused, setSenhaFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleBtn = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleBtn, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleBtn, slideAnim]);

  const handleEntrar = () => {
    onEntrar?.({ email, senha });
  };

  return (
    <LinearGradient
      colors={[colors.greenLight, colors.bg]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={s.root}
    >
      <KeyboardAvoidingView
        style={s.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.header, { paddingTop: insets.top + 48 }]}>
            <DularLogo size="lg" />
            <Text style={s.subtitle}>Bem-vindo de volta!</Text>
          </View>

          <Animated.View
            style={[
              s.formWrap,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={[s.inputWrap, emailFocused && s.inputWrapFocused]}>
              <Ionicons name="mail-outline" size={18} color={colors.sub} style={s.leftIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Seu e-mail"
                placeholderTextColor={colors.sub}
                keyboardType="email-address"
                autoCapitalize="none"
                style={s.input}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={[s.inputWrap, senhaFocused && s.inputWrapFocused]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.sub} style={s.leftIcon} />
              <TextInput
                value={senha}
                onChangeText={setSenha}
                placeholder="Sua senha"
                placeholderTextColor={colors.sub}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                style={s.input}
                onFocus={() => setSenhaFocused(true)}
                onBlur={() => setSenhaFocused(false)}
              />
              <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={12}>
                <Ionicons
                  name={showPwd ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color={colors.sub}
                />
              </Pressable>
            </View>

            <Animated.View style={{ transform: [{ scale: scaleBtn }] }}>
              <Pressable onPress={handleEntrar} disabled={loading} style={({ pressed }) => [pressed && s.pressed]}>
                <LinearGradient
                  colors={[colors.greenDark, colors.green]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={s.loginBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.card} />
                  ) : (
                    <Text style={s.loginText}>Entrar</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Pressable onPress={onForgotPassword} style={s.forgotBtn}>
              <Text style={s.forgotText}>Esqueceu sua senha?</Text>
            </Pressable>

            <View style={s.footerRow}>
              <Text style={s.footerMuted}>Não tem conta?</Text>
              <Pressable onPress={onCadastro}>
                <Text style={s.footerLink}>Cadastre-se</Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    alignItems: "center",
  },
  subtitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
  },
  formWrap: {
    marginTop: 28,
    gap: 12,
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    ...shadow.card,
  },
  inputWrapFocused: {
    borderColor: colors.green,
  },
  leftIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  loginBtn: {
    marginTop: 6,
    height: 54,
    borderRadius: radius.btn,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.greenDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 24,
    elevation: 8,
  },
  loginText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.9,
  },
  forgotBtn: {
    marginTop: 4,
    alignSelf: "center",
  },
  forgotText: {
    ...typography.sub,
  },
  footerRow: {
    marginTop: 32,
    alignItems: "center",
    gap: 6,
  },
  footerMuted: {
    ...typography.sub,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.greenDark,
  },
});
