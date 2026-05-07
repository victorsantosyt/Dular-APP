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

export const api = axios.create({
  baseURL: API_BASE_URL,
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
  config.headers = { ...(config.headers || {}), ...auth } as any;
  return config;
});

// Interceptor de resposta: limpa sessão em 401 ou "jwt expired"
api.interceptors.response.use(
  (response) => response,
  async (error) => {
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
