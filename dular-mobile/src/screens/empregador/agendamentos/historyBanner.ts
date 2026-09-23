import type { CategoriaFiltro, StatusFiltro } from "./components";

export function shouldShowHistoryBanner({
  category,
  status,
  resultCount,
}: {
  category: CategoriaFiltro;
  status: StatusFiltro;
  resultCount: number;
}): boolean {
  return category === "todas" && status === "aceitas" && resultCount > 0;
}
