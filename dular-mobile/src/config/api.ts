import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

function normalizeHost(host: string) {
  if ((host === "localhost" || host === "127.0.0.1") && Platform.OS === "android") {
    return "10.0.2.2";
  }
  return host;
}

function parseHost(uri: string | null | undefined) {
  if (!uri) return null;
  try {
    const clean = uri.replace(/^(.*:\/\/)/, "").split("/")[0];
    return clean.split(":")[0] || null;
  } catch {
    return null;
  }
}

function resolveExpoDevUrl() {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants.expoConfig as any)?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoClient?.hostUri ||
    (Constants.manifest as any)?.debuggerHost ||
    null;

  const host = parseHost(hostUri) || parseHost((NativeModules as any)?.SourceCode?.scriptURL);
  return host ? `http://${normalizeHost(host)}:3000` : null;
}

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  resolveExpoDevUrl() ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://localhost:3000";

export default BASE_URL;

export const sosWhatsapp: string =
  (Constants.expoConfig?.extra?.sosWhatsapp as string | undefined) ?? "5565999999999";
