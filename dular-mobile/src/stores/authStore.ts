import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { api, setAuthToken, registerClearSession } from "@/lib/api";
import { SecureStorage } from "@/services/secureStorage";
import { useThemeStore } from "@/stores/useThemeStore";
import { limparCacheMensagens } from "@/hooks/useMensagens";
import { limparCacheNotificacoes } from "@/hooks/useNotificacoes";
import { limparCachesCompartilhados } from "@/api/sharedFetcher";
import { encerrarPushDaSessao } from "@/lib/pushCicloDeVida";
import { definirSessaoAtual } from "@/lib/sessaoAtual";
import { limparAgrupamentoDePopups } from "@/lib/pushPrimeiroPlano";
import { useNotificacaoPopup } from "@/stores/notificacaoPopupStore";
import type { ServicoOferecido } from "@/types/diarista";
import {
  classifyBootstrapFailure,
  type AuthBootstrapStatus,
} from "@/stores/authBootstrap";

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
  email?: string | null;
  telefone?: string;
  cpf?: string | null;
  dataNascimento?: string | null;
  /** Nome como no documento, para a verificação. `nome` é o de exibição. */
  nomeCompleto?: string | null;
  role: Role;
  genero?: "MASCULINO" | "FEMININO" | null;
  status?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt?: string | null;
  cidade?: string | null;
  estado?: string | null;
  uf?: string | null;
  bairro?: string | null;
  cidadeAtual?: string | null;
  estadoAtual?: string | null;
  bairroAtual?: string | null;
  localizacaoPermitida?: boolean;
  localizacaoAtualizadaEm?: string | null;
  servicosOferecidos?: ServicoOferecido[];
  especialidades?: string[];
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
  servicosOferecidos: ServicoOferecido[];
  bootstrapStatus: AuthBootstrapStatus;
  bootstrapError: string | null;
  // Mantido por compatibilidade com consumidores existentes. Gates e
  // navegação devem usar bootstrapStatus, pois `hydrated` não prova que o
  // usuário canônico foi carregado.
  hydrated: boolean;
  isAuthenticated: boolean;
  setSelectedRole: (role: Role) => void;
  setServicosOferecidos: (servicos: ServicoOferecido[]) => Promise<void>;
  setSession: (data: { token: string; role: Role; user?: User | null }) => Promise<void>;
  clearSession: () => Promise<void>;
  /** Logout pedido pela pessoa: desassocia o push deste aparelho e limpa a sessão. */
  sair: () => Promise<void>;
  hydrate: () => Promise<void>;
  setUser: (next: User | null | ((prev: User | null) => User | null)) => void;
};

// Non-sensitive keys that stay in AsyncStorage
const ASYNC_KEYS = ["role", "dular_role", "userName", "userId", "genero", "servicosOferecidos"] as const;

function normalizeRole(value: string | null | undefined): Role | null {
  if (value === "EMPREGADOR" || value === "DIARISTA" || value === "MONTADOR" || value === "ADMIN") {
    return value;
  }
  return null;
}

function normalizeServicosOferecidos(value: unknown): ServicoOferecido[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = raw.filter(
    (item): item is ServicoOferecido =>
      item === "DIARISTA" ||
      item === "BABA" ||
      item === "COZINHEIRA" ||
      item === "PASSADEIRA" ||
      item === "LAVADEIRA" ||
      item === "CUIDADORA",
  );
  return Array.from(new Set(normalized));
}

async function fetchCanonicalSessionUser(): Promise<User> {
  const res = await api.get<{ user?: User } | User>("/api/me");
  const payload = res.data as { user?: User };
  const user = payload.user ?? (res.data as User);
  if (!user || typeof user !== "object" || !user.id) {
    throw new Error("Resposta de sessão sem usuário canônico.");
  }
  return user;
}

function canonicalizeUser(apiUser: User): { user: User; role: Role; servicosOferecidos: ServicoOferecido[] } {
  const role = normalizeRole(apiUser.role);
  if (!role) {
    throw new Error("Resposta de sessão com papel inválido.");
  }

  const servicosOferecidos = normalizeServicosOferecidos(apiUser.servicosOferecidos);
  return {
    role,
    servicosOferecidos,
    user: {
      ...apiUser,
      role,
      servicosOferecidos,
    },
  };
}

async function persistCanonicalSession(user: User, role: Role): Promise<void> {
  await SecureStorage.saveUser(user);

  const entries: [string, string][] = [
    ["role", role],
    ["servicosOferecidos", (user.servicosOferecidos ?? []).join(",")],
  ];
  if (user.nome) entries.push(["userName", user.nome]);
  if (user.id) entries.push(["userId", user.id]);
  if (user.genero) entries.push(["genero", user.genero]);
  await AsyncStorage.multiSet(entries);
}

function bootstrapRetryMessage(): string {
  return "Não foi possível restaurar sua sessão. Verifique sua conexão e tente novamente.";
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  role: null,
  selectedRole: null,
  servicosOferecidos: [],
  bootstrapStatus: "bootstrapping",
  bootstrapError: null,
  hydrated: false,
  isAuthenticated: false,
  setSelectedRole: (role) => set({ selectedRole: role }),
  setServicosOferecidos: async (servicos) => {
    const normalized = normalizeServicosOferecidos(servicos);
    await AsyncStorage.setItem("servicosOferecidos", normalized.join(","));
    const currentUser = get().user;
    const nextUser = currentUser ? { ...currentUser, servicosOferecidos: normalized } : currentUser;
    if (nextUser) await SecureStorage.saveUser(nextUser);
    set({ servicosOferecidos: normalized, user: nextUser });
  },

  async setSession(data) {
    const { token, role } = data;
    set({ bootstrapStatus: "bootstrapping", bootstrapError: null, isAuthenticated: false, user: null });
    await setAuthToken(token);
    await SecureStorage.saveToken(token);

    try {
      const canonical = canonicalizeUser(await fetchCanonicalSessionUser());
      try {
        await persistCanonicalSession(canonical.user, canonical.role);
      } catch {
        // A sessão canônica já foi obtida; falhar ao renovar cache não pode
        // reclassificar a conta como incompleta nem derrubar o login atual.
      }
      set({
        token,
        role: canonical.role,
        user: canonical.user,
        servicosOferecidos: canonical.servicosOferecidos,
        hydrated: true,
        isAuthenticated: true,
        bootstrapStatus: "authenticated",
        bootstrapError: null,
      });
    } catch (error) {
      if (classifyBootstrapFailure(error) === "invalid-session") {
        await get().clearSession();
        return;
      }
      set({
        token,
        role,
        user: null,
        servicosOferecidos: [],
        hydrated: true,
        isAuthenticated: false,
        bootstrapStatus: "error",
        bootstrapError: bootstrapRetryMessage(),
      });
    }
  },

  async sair() {
    // Antes de apagar o JWT: a rota exige a sessão que está saindo. O
    // coordenador espera um registro em voo (até 2,5 s), manda o DELETE e
    // respeita um prazo — o logout local nunca fica preso na rede. Limites
    // em lib/registroPush.
    if (get().token) await encerrarPushDaSessao();
    await get().clearSession();
  },

  async clearSession() {
    // A lista de conversas e os avisos ficam em cache de módulo: sem limpar, a
    // próxima conta veria os da anterior (e o contador dela) até o 1º fetch.
    limparCacheMensagens();
    limparCacheNotificacoes();
    limparCachesCompartilhados();
    useNotificacaoPopup.getState().limpar();
    limparAgrupamentoDePopups();
    await setAuthToken(null);
    await SecureStorage.clearAll();
    await AsyncStorage.multiRemove(ASYNC_KEYS as unknown as string[]);
    // Reseta o tema para "light" — onboarding/login devem nascer claros pro
    // próximo usuário (também garantido pelo ThemeScope forceLight, mas
    // limpar o store evita que o próximo login herde o dark mode anterior).
    useThemeStore.getState().setTheme("light");
    set({
      token: null,
      role: null,
      user: null,
      isAuthenticated: false,
      selectedRole: null,
      servicosOferecidos: [],
      hydrated: true,
      bootstrapStatus: "unauthenticated",
      bootstrapError: null,
    });
  },

  async hydrate() {
    set({ bootstrapStatus: "bootstrapping", bootstrapError: null, isAuthenticated: false, user: null });

    let token: string | null;
    try {
      token = await SecureStorage.getToken();
    } catch {
      set({
        token: null,
        role: null,
        user: null,
        servicosOferecidos: [],
        hydrated: true,
        isAuthenticated: false,
        bootstrapStatus: "error",
        bootstrapError: bootstrapRetryMessage(),
      });
      return;
    }

    if (!token) {
      set({
        token: null,
        role: null,
        user: null,
        servicosOferecidos: [],
        hydrated: true,
        isAuthenticated: false,
        bootstrapStatus: "unauthenticated",
        bootstrapError: null,
      });
      return;
    }

    if (isJwtExpired(token)) {
      await get().clearSession();
      return;
    }

    try {
      await setAuthToken(token);
      const canonical = canonicalizeUser(await fetchCanonicalSessionUser());
      try {
        await persistCanonicalSession(canonical.user, canonical.role);
      } catch {
        // Cache é apenas uma otimização. A resposta canônica já basta para
        // decidir gates de forma segura neste processo.
      }
      set({
        token,
        role: canonical.role,
        user: canonical.user,
        servicosOferecidos: canonical.servicosOferecidos,
        hydrated: true,
        isAuthenticated: true,
        bootstrapStatus: "authenticated",
        bootstrapError: null,
      });
    } catch (error) {
      if (classifyBootstrapFailure(error) === "invalid-session") {
        await get().clearSession();
        return;
      }
      set({
        token,
        role: null,
        user: null,
        servicosOferecidos: [],
        hydrated: true,
        isAuthenticated: false,
        bootstrapStatus: "error",
        bootstrapError: bootstrapRetryMessage(),
      });
    }
  },

  setUser(next) {
    set((state) => {
      const resolved = typeof next === "function" ? (next as any)(state.user) : next;
      // Resposta atrasada de outra conta (ou de depois do logout) não altera a
      // sessão atual: só vale atualização da MESMA conta. Limpar (null) vale.
      if (resolved && (!state.user || resolved.id !== state.user.id)) return state;
      if (resolved) void SecureStorage.saveUser(resolved);
      return { ...state, user: resolved ?? null };
    });
  },
}));

export const useAuthStore = useAuth;

// Registra clearSession no cliente HTTP para limpeza automática em 401/jwt-expired
registerClearSession(() => useAuth.getState().clearSession());

// Conta autenticada para caches e listeners conferirem (lib/sessaoAtual). Só
// com a sessão canônica carregada: durante o bootstrap não há dono.
function sincronizarSessaoAtual(s: AuthState) {
  definirSessaoAtual(s.isAuthenticated ? s.user?.id ?? null : null);
}
sincronizarSessaoAtual(useAuth.getState());
useAuth.subscribe(sincronizarSessaoAtual);
