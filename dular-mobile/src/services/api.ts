import { api } from "@/lib/api";

export interface ApiResponse<T> {
  data: T | null;
}

async function get<T>(path: string, _token?: string | null): Promise<ApiResponse<T>> {
  const response = await api.get<T>(path);
  return { data: response.data };
}

async function post<T>(path: string, body: unknown, _token?: string | null): Promise<ApiResponse<T>> {
  const response = await api.post<T>(path, body);
  return { data: response.data };
}

export const apiService = { get, post };
