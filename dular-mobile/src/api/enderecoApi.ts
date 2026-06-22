import { api } from "@/lib/api";

// TipoEndereco SEM acento (espelha o enum do Prisma).
export type TipoEndereco = "RESIDENCIAL" | "EMPRESARIAL";

export type Endereco = {
  id: string;
  userId: string;
  tipo: TipoEndereco;
  cep: string;
  rua: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  pontoReferencia?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EnderecoPayload = {
  tipo: TipoEndereco;
  cep: string;
  rua: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  pontoReferencia?: string | null;
};

export async function fetchEnderecos(): Promise<Endereco[]> {
  const res = await api.get<{ ok?: boolean; enderecos?: Endereco[] }>("/api/me/enderecos");
  return res.data?.enderecos ?? [];
}

export async function salvarEndereco(payload: EnderecoPayload): Promise<Endereco> {
  const res = await api.post<{ ok?: boolean; endereco: Endereco }>("/api/me/enderecos", payload);
  return res.data.endereco;
}

export async function atualizarEndereco(id: string, payload: EnderecoPayload): Promise<Endereco> {
  const res = await api.patch<{ ok?: boolean; endereco: Endereco }>(
    `/api/me/enderecos/${encodeURIComponent(id)}`,
    payload,
  );
  return res.data.endereco;
}

/** Monta a string de endereço para o `enderecoCompleto` do Serviço (Fase 3d). */
export function formatEnderecoCompleto(e: Endereco | EnderecoPayload): string {
  const compl = e.complemento ? `, ${e.complemento}` : "";
  return `${e.rua}, ${e.numero}${compl} — ${e.bairro}, ${e.cidade}/${e.uf}`;
}

// ── ViaCEP ──────────────────────────────────────────────────────────────────
type ViaCepResult = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

/** Consulta ViaCEP. `null` quando CEP inválido/não encontrado ou falha de rede. */
export async function buscarCep(cepDigits: string): Promise<{
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
} | null> {
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = (await r.json()) as ViaCepResult;
    if (!data || data.erro) return null;
    return {
      rua: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}
