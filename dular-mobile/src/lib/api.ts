import axios from "axios";
import BASE_URL from "@/config/api";
import { SecureStorage } from "@/services/secureStorage";

export const API_BASE_URL = BASE_URL;

type ClearSessionFn = () => Promise<void>;
let _clearSession: ClearSessionFn | null = null;

export function registerClearSession(fn: ClearSessionFn) {
  _clearSession = fn;
}

async function getStoredToken(): Promise<string | null> {
  return SecureStorage.getToken();
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const REQUEST_TIMEOUT_MS = 20000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

export async function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : false;

// Interceptor async para inserir Authorization + timing DEV
api.interceptors.request.use(async (config) => {
  const auth = await getAuthHeaders();
  config.headers = { ...(config.headers || {}), ...auth } as any;
  if (IS_DEV) {
    (config as any).metadata = { startedAt: Date.now() };
  }
  return config;
});

// Interceptor de resposta: timing DEV + limpa sessão em 401/"jwt expired"
api.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      const started = (response.config as any)?.metadata?.startedAt as number | undefined;
      const elapsed = started ? Date.now() - started : 0;
      const method = (response.config.method ?? "GET").toUpperCase();
      const url = response.config.url ?? "";
      console.log(`[api] ${method} ${url} ${response.status} ${elapsed}ms`);
    }
    return response;
  },
  async (error) => {
    if (IS_DEV) {
      const started = (error?.config as any)?.metadata?.startedAt as number | undefined;
      const elapsed = started ? Date.now() - started : 0;
      const method = ((error?.config?.method as string) ?? "GET").toUpperCase();
      const url = (error?.config?.url as string) ?? "";
      const status = error?.response?.status ?? "ERR";
      const isTimeout = error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message ?? ""));
      const tag = isTimeout ? `TIMEOUT ${REQUEST_TIMEOUT_MS}ms` : `${status} ${elapsed}ms`;
      console.log(`[api] ${method} ${url} ${tag}${error?.message ? ` — ${error.message}` : ""}`);
    }

    const status = error?.response?.status;
    const message: string = error?.response?.data?.message ?? error?.message ?? "";
    const isExpired =
      status === 401 || message.toLowerCase().includes("jwt expired");

    if (isExpired && _clearSession) {
      await _clearSession();
    }

    return Promise.reject(error);
  }
);

// Wrapper fetch opcional (se você ainda usar fetch em alguns pontos)
export async function apiFetch(path: string, options: RequestInit = {}) {
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
