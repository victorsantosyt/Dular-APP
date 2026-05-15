import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "dular_auth_token";
const REFRESH_KEY = "dular_refresh_token";
const USER_KEY = "dular_user_data";

// Hotfix: o SecureStore do expo-secure-store avisa quando o valor passa de
// 2048 bytes (limite seguro do Keychain/Keystore). Persistimos apenas os
// campos mínimos para identificar o usuário hidratado; campos pesados como
// bairros, agenda, servicosOferecidos, habilidades, etc., ficam fora — eles
// são recarregados de /api/me / /api/diarista/me quando a sessão hidrata.
const PERSISTED_USER_FIELDS = [
  "id",
  "nome",
  "email",
  "role",
  "genero",
  "avatarUrl",
  "telefone",
  "bio",
] as const;

function partializeUser(user: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!user || typeof user !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const key of PERSISTED_USER_FIELDS) {
    const value = (user as Record<string, unknown>)[key];
    if (value === undefined) continue;
    // Não persistir data URLs no SecureStore (podem ter 100KB+). O avatar real
    // vem como https URL do backend; se ainda for data URL é porque o upload
    // não retornou link permanente — descartar para evitar o warning > 2048 bytes.
    if (key === "avatarUrl" && typeof value === "string" && value.startsWith("data:")) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

export const SecureStorage = {
  async saveToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async saveRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async saveUser(user: object): Promise<void> {
    // partialize: só persiste campos mínimos para ficar < 2048 bytes.
    const slim = partializeUser(user as Record<string, unknown>);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(slim));
  },

  async getUser<T>(): Promise<T | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  },

  async clearAll(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
