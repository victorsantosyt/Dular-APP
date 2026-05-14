import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { api, setAuthToken, registerClearSession } from "@/lib/api";
import { SecureStorage } from "@/services/secureStorage";
import { useThemeStore } from "@/stores/useThemeStore";

function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "==".slice(0, (4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === "number" && payload.exp < Date.now() / 1000;
  } catch {
    return false;
  }
}

type Role = "EMPREGADOR" | "DIARISTA" | "MONTADOR" | "ADMIN";
export type Genero = "MASCULINO" | "FEMININO";

type User = {
  id: string;
  nome: string;
  telefone?: string;
  role: Role;
  genero?: "MASCULINO" | "FEMININO" | null;
  avatarUrl?: string | null;
  bio?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cidadeAtual?: string | null;
  estadoAtual?: string | null;
  bairroAtual?: string | null;
  localizacaoPermitida?: boolean;
  localizacaoAtualizadaEm?: string | null;
  verificado?: boolean;
  docEnviado?: boolean;
  verificacao?: {
    status: "NAO_ENVIADO" | "PENDENTE" | "APROVADO" | "REPROVADO";
    updatedAt?: string;
    motivo?: string | null;
  } | null;
};

type AuthState = {
  user: User | null;
  token: string | null;
  role: Role | null;
  selectedRole: Role | null;
  selectedGenero: Genero | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  setSelectedRole: (role: Role) => void;
  setSelectedGenero: (genero: Genero) => void;
  setSession: (data: { token: string; role: Role; user?: User | null }) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (next: User | null | ((prev: User | null) => User | null)) => void;
};

// Non-sensitive keys that stay in AsyncStorage
const ASYNC_KEYS = ["role", "dular_role", "userName", "userId", "genero"] as const;

function normalizeRole(value: string | null | undefined): Role | null {
  if (value === "EMPREGADOR" || value === "DIARISTA" || value === "MONTADOR" || value === "ADMIN") {
    return value;
  }
  return null;
}

function normalizeGenero(value: string | null | undefined): Genero | null {
  if (value === "MASCULINO" || value === "FEMININO") return value;
  return null;
}

async function fetchSessionUser(): Promise<User | null> {
  try {
    const res = await api.get<{ user?: User } | User>("/api/me");
    const payload = res.data as { user?: User };
    return payload.user ?? (res.data as User);
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  role: null,
  selectedRole: null,
  selectedGenero: null,
  hydrated: false,
  isAuthenticated: false,
  setSelectedRole: (role) => set({ selectedRole: role }),
  setSelectedGenero: (genero) => set({ selectedGenero: genero }),

  async setSession(data) {
    const { token, role, user } = data;
    await setAuthToken(token);
    await SecureStorage.saveToken(token);

    const selectedGenero = get().selectedGenero;
    const apiUser = await fetchSessionUser();
    const reconciledUser: User = {
      ...(user ?? apiUser ?? { id: "", nome: "", role }),
      ...(apiUser ?? {}),
      role: (apiUser?.role ?? user?.role ?? role) as Role,
      genero: apiUser?.genero ?? user?.genero ?? selectedGenero ?? null,
    };

    await SecureStorage.saveUser(reconciledUser);

    // Non-sensitive: store in AsyncStorage
    const entries: [string, string][] = [["role", role]];
    if (reconciledUser.nome) entries.push(["userName", reconciledUser.nome]);
    if (reconciledUser.id) entries.push(["userId", reconciledUser.id]);
    if (reconciledUser.genero) entries.push(["genero", reconciledUser.genero]);
    await AsyncStorage.multiSet(entries);

    set({
      token,
      role: reconciledUser.role ?? role,
      user: reconciledUser,
      selectedGenero: reconciledUser.genero ?? selectedGenero,
      isAuthenticated: true,
    });
  },

  async clearSession() {
    await setAuthToken(null);
    await SecureStorage.clearAll();
    await AsyncStorage.multiRemove(ASYNC_KEYS as unknown as string[]);
    // Reseta o tema para "light" — onboarding/login devem nascer claros pro
    // próximo usuário (também garantido pelo ThemeScope forceLight, mas
    // limpar o store evita que o próximo login herde o dark mode anterior).
    useThemeStore.getState().setTheme("light");
    set({ token: null, role: null, user: null, isAuthenticated: false, selectedRole: null, selectedGenero: null });
  },

  async hydrate() {
    // Sensitive: read from SecureStore
    const token = await SecureStorage.getToken();
    const userFromSecure = await SecureStorage.getUser<User>();

    // Non-sensitive: read from AsyncStorage
    const pairs = await AsyncStorage.multiGet(ASYNC_KEYS as unknown as string[]);
    const map = Object.fromEntries(pairs);
    const role = normalizeRole(map["role"] || map["dular_role"]);
    const genero = normalizeGenero(map["genero"]);
    const userName = map["userName"];
    const userId = map["userId"];

    if (token && role) {
      if (isJwtExpired(token)) {
        await setAuthToken(null);
        await SecureStorage.clearAll();
        await AsyncStorage.multiRemove(ASYNC_KEYS as unknown as string[]);
        set({ token: null, role: null, user: null, hydrated: true, isAuthenticated: false });
        return;
      }

      let userObj: User | null = userFromSecure
        ? { ...userFromSecure, role, genero: userFromSecure.genero ?? genero }
        : null;
      if (!userObj && (userName || userId)) {
        userObj = { id: userId || "", nome: userName || "", role, genero };
      }

      await setAuthToken(token);
      set({ token, role, user: userObj, selectedGenero: userObj?.genero ?? genero, hydrated: true, isAuthenticated: true });
      return;
    }
    set({ hydrated: true, isAuthenticated: false });
  },

  setUser(next) {
    set((state) => {
      const resolved = typeof next === "function" ? (next as any)(state.user) : next;
      return { ...state, user: resolved ?? null };
    });
  },
}));

export const useAuthStore = useAuth;

// Registra clearSession no cliente HTTP para limpeza automática em 401/jwt-expired
registerClearSession(() => useAuth.getState().clearSession());
