import { useState, useMemo } from "react";
import {
  View,
  Text,
  Alert,
  Pressable,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { api, API_BASE_URL, setAuthToken } from "../lib/api";
import { LoginResponse, RegisterResponse } from "../types/auth";
import { logoSource } from "../lib/logoSource";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
  onAuth: (data: { token: string; role: "CLIENTE" | "DIARISTA" | "ADMIN"; user: LoginResponse["user"] }) => void;
};

export default function AuthScreen({ onAuth }: Props) {
  const [telefone, setTelefone] = useState("65999990001");
  const [senha, setSenha] = useState("cliente123");
  const [nome, setNome] = useState("Cliente Teste");
  const [role, setRole] = useState<"CLIENTE" | "DIARISTA">("CLIENTE");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { width: W, height: H } = Dimensions.get("window");

  async function persistSession(token: string, user?: LoginResponse["user"]) {
    const entries: [string, string][] = [["dular_token", token]];
    if (user) entries.push(["dular_user", JSON.stringify(user)]);
    await AsyncStorage.multiSet(entries);
  }

  async function handleLogin() {
    try {
      setLoading(true);
      const baseURL = (api.defaults.baseURL ?? API_BASE_URL ?? "").replace(/\/$/, "");
      const endpoint = "/api/auth/login";
      const finalURL = baseURL ? `${baseURL}${endpoint}` : endpoint;
      console.log("[LOGIN DEBUG] baseURL:", baseURL || "(vazio)");
      console.log("[LOGIN DEBUG] finalURL:", finalURL);
      console.log("[LOGIN DEBUG] timeout(ms):", api.defaults.timeout);
      console.log("[LOGIN DEBUG] platform:", Platform.OS);

      if (!baseURL) {
        Alert.alert("Erro", "API base URL não configurada.");
        return;
      }

      // Health check rápido para provar acessibilidade antes do login.
      try {
        const health = await api.get("/api/health", { timeout: 5000, validateStatus: () => true });
        if (health.status !== 200) {
          Alert.alert(
            "Erro",
            `Backend não acessível: tente abrir ${baseURL}/api/health no navegador do celular.`
          );
          return;
        }
      } catch {
        Alert.alert(
          "Erro",
          `Backend não acessível: tente abrir ${baseURL}/api/health no navegador do celular.`
        );
        return;
      }

      const res = await api.post<LoginResponse>("/api/auth/login", { login: telefone, senha });
      if (!res.data?.token) throw new Error("Falha ao obter token");
      await persistSession(res.data.token, res.data.user);
      await setAuthToken(res.data.token);
      onAuth({
        token: res.data.token,
        role: res.data.user.role,
        user: res.data.user,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.code;
      console.log("[LOGIN ERROR]", {
        code,
        status,
        message: e?.message,
        data: e?.response?.data,
      });
      if (code === "ECONNABORTED") {
        Alert.alert("Erro", "Timeout ao conectar na API. Verifique a URL e a rede.");
      } else if (code === "ERR_NETWORK" || e?.message === "Network Error") {
        Alert.alert("Erro", "Falha de rede ao conectar na API. Verifique Wi‑Fi e URL.");
      } else if (status) {
        Alert.alert("Erro", `${status} - ${e?.response?.data?.error ?? "Falha ao logar"}`);
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
      const res = await api.post<RegisterResponse>("/api/auth/register", {
        nome,
        telefone,
        senha,
        role,
      });
      if (!res.data?.ok) throw new Error("Registro falhou");
      Alert.alert("Sucesso", "Registro feito. Agora faça login.");
      setMode("login");
    } catch (e: any) {
      Alert.alert("Erro", e?.response?.data?.error ?? e?.message ?? "Falha ao registrar");
    } finally {
      setLoading(false);
    }
  }

  const contentWidth = useMemo(() => Math.round(W * 0.78), [W]);
  const logoWidth = Math.round(contentWidth * 0.62 * 1.2); // +20%

  const isEmailMock = false; // mantenho telefone; se quiser e-mail, troque para true

  return (
    <LinearGradient colors={["#E3EEE5", "#E9F0ED"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, alignItems: "center" }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={{ flex: 1, alignItems: "center", paddingTop: Math.round(H * 0.06) }}>
              {/* Logo */}
              <Image
                source={logoSource}
                resizeMode="contain"
                style={{
                  width: logoWidth,
                  height: Math.round(logoWidth * 0.58),
                  marginBottom: 16,
                }}
              />

              {/* Título */}
              <Text style={{ fontSize: 20, fontWeight: "700", color: "#2B3443", marginBottom: 18 }}>
                Bem-vindo de volta!
              </Text>

              {/* Input 1 */}
              <View style={[styles.inputCard, { width: contentWidth }]}>
                <Ionicons
                  name={isEmailMock ? "mail-outline" : "call-outline"}
                  size={18}
                  color="#A7B3BE"
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={telefone}
                  onChangeText={setTelefone}
                  placeholder={isEmailMock ? "Seu email" : "Seu telefone"}
                  placeholderTextColor="#9AA6B2"
                  keyboardType={isEmailMock ? "email-address" : "phone-pad"}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              {/* Input 2 */}
              <View style={[styles.inputCard, { width: contentWidth, marginTop: 14 }]}>
                <MaterialCommunityIcons name="lock-outline" size={18} color="#A7B3BE" style={{ marginRight: 10 }} />
                <TextInput
                  value={senha}
                  onChangeText={setSenha}
                  placeholder="Sua senha"
                  placeholderTextColor="#9AA6B2"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={16} style={{ paddingLeft: 10, paddingVertical: 6 }}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#A7B3BE" />
                </Pressable>
              </View>

              {/* Botão Entrar */}
              <Pressable
                onPress={mode === "login" ? handleLogin : handleRegister}
                disabled={loading}
                style={{ marginTop: 18, opacity: loading ? 0.75 : 1 }}
              >
                <LinearGradient
                  colors={["#63B19F", "#4FA38F"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.button, { width: contentWidth }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{mode === "login" ? "Entrar" : "Registrar"}</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {/* Links */}
              <Pressable
                style={{ marginTop: 14 }}
                onPress={() => Alert.alert("Recuperar senha", "Fale com o suporte para redefinir a senha.")}
              >
                <Text style={styles.linkMuted}>Esqueceu sua senha?</Text>
              </Pressable>

              <View style={{ marginTop: 28, alignItems: "center" }}>
                <Text style={styles.muted}>Não tem conta?</Text>
                {mode === "login" ? (
                  <Pressable onPress={() => setMode("register")} style={{ marginTop: 6 }}>
                    <Text style={styles.linkPrimary}>Cadastre-se</Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setMode("login")} style={{ marginTop: 6 }}>
                    <Text style={styles.linkPrimary}>Já tenho conta</Text>
                  </Pressable>
                )}
                {mode === "register" && (
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <Pressable
                      onPress={() => setRole("CLIENTE")}
                      style={[
                        styles.rolePill,
                        { backgroundColor: role === "CLIENTE" ? "rgba(79,163,143,0.15)" : "#fff" },
                      ]}
                    >
                      <Text style={{ color: "#2B3443", fontWeight: "700" }}>Cliente</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setRole("DIARISTA")}
                      style={[
                        styles.rolePill,
                        { backgroundColor: role === "DIARISTA" ? "rgba(79,163,143,0.15)" : "#fff" },
                      ]}
                    >
                      <Text style={{ color: "#2B3443", fontWeight: "700" }}>Prestador</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EEF0",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1F2A37",
  },
  button: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  muted: {
    color: "#8E9AA6",
    fontSize: 14,
  },
  linkMuted: {
    color: "#8E9AA6",
    fontSize: 14,
  },
  linkPrimary: {
    color: "#4FA38F",
    fontSize: 14,
    fontWeight: "700",
  },
  rolePill: {
    borderWidth: 1,
    borderColor: "#E8EEF0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
