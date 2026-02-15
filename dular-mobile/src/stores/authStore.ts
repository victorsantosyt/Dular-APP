import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { setAuthToken } from "../lib/api";

type Role = "CLIENTE" | "DIARISTA" | "ADMIN";

type User = {
  id: string;
  nome: string;
  telefone?: string;
  role: Role;
  avatarUrl?: string | null;
};

type AuthState = {
  user: User | null;
  token: string | null;
  role: Role | null;
  hydrated: boolean;
  setSession: (data: { token: string; role: Role; user?: User | null }) => Promise<void>;
  clearSession: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (next: User | null | ((prev: User | null) => User | null)) => void;
};

const STORAGE_KEYS = ["dular_token", "token", "role", "userName", "userId", "dular_user"] as const;

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  role: null,
  hydrated: false,

  async setSession(data) {
    const { token, role, user } = data;
    await setAuthToken(token);
    const entries: [string, string][] = [
      ["dular_token", token],
      ["token", token], // compat
      ["role", role],
    ];
    if (user?.nome) entries.push(["userName", user.nome]);
    if (user?.id) entries.push(["userId", user.id]);
    if (user) entries.push(["dular_user", JSON.stringify(user)]);
    await AsyncStorage.multiSet(entries);
    set({ token, role, user: user ?? null });
  },

  async clearSession() {
    await setAuthToken(null);
    await AsyncStorage.multiRemove(STORAGE_KEYS as unknown as string[]);
    set({ token: null, role: null, user: null });
  },

  async hydrate() {
    const pairs = await AsyncStorage.multiGet(STORAGE_KEYS as unknown as string[]);
    const map = Object.fromEntries(pairs);
    const token = map["dular_token"] || map["token"] || null;
    const role = map["role"] as Role | null;
    const userJson = map["dular_user"];
    const userName = map["userName"];
    const userId = map["userId"];

    if (token && role) {
      let userObj: User | null = null;
      if (userJson) {
        try {
          userObj = JSON.parse(userJson);
        } catch {
          userObj = null;
        }
      }
      if (!userObj && (userName || userId)) {
        userObj = {
          id: userId || "",
          nome: userName || "",
          role,
        };
      }

      await setAuthToken(token);
      set({
        token,
        role,
        user: userObj,
        hydrated: true,
      });
      return;
    }
    set({ hydrated: true });
  },

  setUser(next) {
    set((state) => {
      const resolved = typeof next === "function" ? (next as any)(state.user) : next;
      return { ...state, user: resolved ?? null };
    });
  },
}));
