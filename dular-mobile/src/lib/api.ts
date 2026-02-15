import axios from "axios";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

const TOKEN_KEYS = ["dular_token", "token"] as const;

// Tenta descobrir automaticamente o IP do host do Expo dev server para evitar editar manualmente.
function resolveDevHost(): string | null {
  // hostUri costuma vir como "192.168.0.123:8081" ou "exp://192.168.0.123:8081".
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants.expoConfig as any)?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
    (Constants.manifest as any)?.debuggerHost ||
    null;

  const parseHost = (uri: string | null) => {
    if (!uri) return null;
    try {
      const clean = uri.replace(/^(.*:\/\/)/, "").split("/")[0];
      const host = clean.split(":")[0];
      return host || null;
    } catch {
      return null;
    }
  };

  const normalizeHost = (host: string) => {
    if ((host === "localhost" || host === "127.0.0.1") && Platform.OS === "android") {
      // Android emulator: localhost aponta para o próprio device
      return "10.0.2.2";
    }
    return host;
  };

  // 1) tenta hostUri/debuggerHost
  const fromHostUri = parseHost(hostUri);
  if (fromHostUri) return `http://${normalizeHost(fromHostUri)}:3000`;

  // 2) fallback: SourceCode.scriptURL (bundle URL do Metro/Expo)
  const scriptURL = (NativeModules as any)?.SourceCode?.scriptURL as string | undefined;
  const fromScript = parseHost(scriptURL ?? null);
  if (fromScript) return `http://${normalizeHost(fromScript)}:3000`;

  return null;
}

// Ordem de prioridade da baseURL:
// 1) EXPO_PUBLIC_API_BASE_URL
// 2) app.json extra.apiBaseUrl
// 3) app.json extra.apiUrl (compat)
// 4) IP detectado do host do Expo (resolveDevHost)
// 5) fallback manual
export const API_BASE_URL: string | null =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as any)?.apiBaseUrl ??
  (Constants.expoConfig?.extra as any)?.apiUrl ??
  resolveDevHost() ??
  null;

if (!API_BASE_URL) {
  console.error(
    "[API] API base URL não configurada. Defina EXPO_PUBLIC_API_BASE_URL ou extra.apiBaseUrl."
  );
} else {
  console.log("[API] baseURL selecionada:", API_BASE_URL);
}

async function getStoredToken(): Promise<string | null> {
  const pairs = await AsyncStorage.multiGet(TOKEN_KEYS as unknown as string[]);
  for (const [, val] of pairs) if (val) return val;
  return null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const api = axios.create({
  baseURL: API_BASE_URL ?? undefined,
  timeout: 20000,
});

export async function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Interceptor async para inserir Authorization
api.interceptors.request.use(async (config) => {
  const auth = await getAuthHeaders();
  config.headers = { ...(config.headers || {}), ...auth };
  return config;
});

// Wrapper fetch opcional (se você ainda usar fetch em alguns pontos)
export async function apiFetch(path: string, options: RequestInit = {}) {
  if (!API_BASE_URL) {
    throw new Error("API base URL não configurada");
  }
  const headers = new Headers(options.headers || {});
  const auth = await getAuthHeaders();
  Object.entries(auth).forEach(([k, v]) => headers.set(k, v));

  // Se body é objeto, padroniza JSON (sem estragar FormData)
  if (
    !headers.has("Content-Type") &&
    options.body &&
    typeof options.body === "object" &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(API_BASE_URL + path, { ...options, headers });
}
