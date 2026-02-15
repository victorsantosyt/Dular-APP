import { api } from "../lib/api";

export type CatalogoCategoria = { categoria: string; label: string };
export type CatalogoTipo = { tipo: string; label: string; categorias: CatalogoCategoria[] };

export async function getCatalogoServicos(): Promise<{ tipos: CatalogoTipo[] }> {
  const res = await api.get("/api/catalogo/servicos");
  return res.data;
}
