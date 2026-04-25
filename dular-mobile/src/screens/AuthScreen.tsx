/**
 * AuthScreen — Tela de autenticação Dular
 *
 * Identidade visual 100% alinhada com os tokens validados.
 * Lógica de negócio e debug preservados integralmente.
 */

import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, API_BASE_URL, setAuthToken } from "@/lib/api";
import { logoSource } from "@/lib/logoSource";
import { LoginResponse, RegisterResponse } from "@/types/auth";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Props = {
  onAuth: (data: {
    token: string;
    role: "CLIENTE" | "DIARISTA" | "ADMIN";
    user: LoginResponse["user"];
  }) => void;
};

const { width: W, height: H } = Dimensions.get("window");

export default function AuthScreen({ onAuth }: Props) {
  const [telefone, setTelefone] = useState("65999990001");
  const [senha, setSenha]       = useState("cliente123");
  const [nome, setNome]         = useState("Cliente Teste");
  const [role, setRole]         = useState<"CLIENTE" | "DIARISTA">("CLIENTE");
  const [mode, setMode]         = useState<"login" | "register">("login");
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);

  const contentW = useMemo(() => Math.round(W * 0.82), []);

  async function persistSession(token: string, user?: LoginResponse["user"]) {
    const entries: [string, string][] = [["dular_token", token]];
    if (user) entries.push(["dular_user", JSON.stringify(user)]);
    await AsyncStorage.multiSet(entries);
  }

  async function handleLogin() {
    try {
      setLoading(true);
      const baseURL  = (api.defaults.baseURL ?? API_BASE_URL ?? "").replace(/\/$/, "");
      const finalURL = baseURL ? `${baseURL}/api/auth/login` : "/api/auth/login";

      console.log("[LOGIN] baseURL:", baseURL || "(vazio)");
      console.log("[LOGIN] finalURL:", finalURL);
      console.log("[LOGIN] platform:", Platform.OS);

      if (!baseURL) {
        Alert.alert("Erro", "API base URL não configurada.");
        return;
      }

      // Health check rápido
      try {
        const health = await api.get("/api/health", { timeout: 5000, validateStatus: () => true });
        if (health.status !== 200) {
          Alert.alert("Erro", `Backend não acessível: tente abrir ${baseURL}/api/health no navegador.`);
          return;
        }
      } catch {
        Alert.alert("Erro", `Backend não acessível: tente abrir ${baseURL}/api/health no navegador.`);
        return;
      }

      const res = await api.post<LoginResponse>("/api/auth/login", { login: telefone, senha });
      if (!res.data?.token) throw new Error("Falha ao obter token");
      await persistSession(res.data.token, res.data.user);
      await setAuthToken(res.data.token);
      onAuth({ token: res.data.token, role: res.data.user.role, user: res.data.user });
    } catch (e: any) {
      const status = e?.response?.status;
      const code   = e?.code;
      console.log("[LOGIN ERROR]", { code, status, message: e?.message, data: e?.response?.data });
      if (code === "ECONNABORTED") {
        Alert.alert("Erro", "Timeout ao conectar na API. Verifique a URL e a rede.");
      } else if (code === "ERR_NETWORK" || e?.message === "Network Error") {
        Alert.alert("Erro", "Falha de rede. Verifique Wi‑Fi e URL.");
      } else {
        Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao logar");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    try {
      setLoading(true);
      const res = await api.post<RegisterResponse>("/api/auth/register", { nome, telefone, senha, role });
      if (!res.data?.ok) throw new Error("Registro falhou");
      Alert.alert("Sucesso", "Registro feito. Agora faça login.");
      setMode("login");
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={[s.inner, { paddingTop: Math.round(H * 0.06) }]}>

              {/* ── Logo ── */}
              <View style={s.logoWrap}>
                <Image source={logoSource} style={s.logo} resizeMode="contain" />
              </View>

              {/* ── Título ── */}
              <Text style={s.title}>
                {mode === "login" ? "Bem-vindo de volta!" : "Crie sua conta"}
              </Text>

              {/* ── Nome (só no cadastro) ── */}
              {mode === "register" && (
                <View style={[s.inputBox, { width: contentW }]}>
                  <Ionicons name="person-outline" size={18} color={colors.sub} style={s.inputIcon} />
                  <TextInput
                    value={nome}
                    onChangeText={setNome}
                    placeholder="Seu nome"
                    placeholderTextColor={colors.sub}
                    autoCapitalize="words"
                    style={s.input}
                  />
                </View>
              )}

              {/* ── Telefone ── */}
              <View style={[s.inputBox, { width: contentW }]}>
                <Ionicons name="call-outline" size={18} color={colors.sub} style={s.inputIcon} />
                <TextInput
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder="Seu telefone"
                  placeholderTextColor={colors.sub}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  style={s.input}
                />
              </View>

              {/* ── Senha ── */}
              <View style={[s.inputBox, { width: contentW, marginTop: 12 }]}>
                <MaterialCommunityIcons name="lock-outline" size={18} color={colors.sub} style={s.inputIcon} />
                <TextInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  placeholderTextColor={colors.sub}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  style={s.input}
                />
                <Pressable onPress={() => setShowPwd((v) => !v)} hitSlop={16}>
                  <Ionicons
                    name={showPwd ? "eye-outline" : "eye-off-outline"}
                    size={18}
                    color={colors.sub}
                  />
                </Pressable>
              </View>

              {/* ── Botão principal ── */}
              <Pressable
                onPress={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                style={({ pressed }) => [
                  s.btn,
                  { width: contentW, marginTop: 20 },
                  (loading || pressed) && { opacity: 0.8 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.btnText}>
                    {mode === "login" ? "Entrar" : "Criar conta"}
                  </Text>
                )}
              </Pressable>

              {/* ── Esqueci senha ── */}
              {mode === "login" && (
                <Pressable
                  style={{ marginTop: 14 }}
                  onPress={() => Alert.alert("Recuperar senha", "Fale com o suporte para redefinir a senha.")}
                >
                  <Text style={s.linkMuted}>Esqueceu sua senha?</Text>
                </Pressable>
              )}

              {/* ── Alternar modo ── */}
              <View style={s.switchRow}>
                <Text style={s.mutedText}>
                  {mode === "login" ? "Não tem conta?" : "Já tem conta?"}
                </Text>
                <Pressable
                  onPress={() => setMode(mode === "login" ? "register" : "login")}
                  style={{ marginTop: 6 }}
                >
                  <Text style={s.linkGreen}>
                    {mode === "login" ? "Cadastre-se" : "Fazer login"}
                  </Text>
                </Pressable>
              </View>

              {/* ── Seleção de role (só no cadastro) ── */}
              {mode === "register" && (
                <View style={s.roleRow}>
                  {(["CLIENTE", "DIARISTA"] as const).map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      style={[s.rolePill, role === r && s.rolePillOn]}
                    >
                      <Text style={[s.rolePillText, role === r && s.rolePillTextOn]}>
                        {r === "CLIENTE" ? "Cliente" : "Prestador"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg, // #E6EDEA — identidade validada
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 40,
  },
  logoWrap: {
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 170,
    height: 88,
  },

  title: {
    ...typography.h1,
    marginBottom: 22,
    textAlign: "center",
  },

  // Inputs
  inputBox: {
    height: 52,
    borderRadius: radius.md,       // 14px — identidade validada
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    // Sombra card
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    paddingVertical: 0,
  },

  // Botão principal
  btn: {
    height: 52,
    borderRadius: radius.btn,      // 22px — pill, identidade validada
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green, // #3DC87A
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // Links
  linkMuted: {
    fontSize: 13,
    color: colors.sub,
  },
  linkGreen: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.green,
  },
  mutedText: {
    fontSize: 13,
    color: colors.sub,
  },
  switchRow: {
    marginTop: 28,
    alignItems: "center",
  },

  // Role selector
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  rolePill: {
    borderWidth: 1.5,
    borderColor: colors.stroke,
    borderRadius: radius.btn,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.card,
  },
  rolePillOn: {
    borderColor: colors.green,
    backgroundColor: colors.greenLight,
  },
  rolePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.ink,
  },
  rolePillTextOn: {
    color: colors.greenDark,
  },
});
