import { api } from "./api";

// Wrapper simples em cima do axios configurado
export async function apiFetch<T = any>(path: string, options: { method?: string; data?: any; params?: any; signal?: AbortSignal } = {}): Promise<T> {
  const { method = "GET", data, params, signal } = options;
  const res = await api.request<T>({ url: path, method, data, params, signal });
  return res.data as T;
}
