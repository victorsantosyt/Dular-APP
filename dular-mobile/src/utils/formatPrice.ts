export function formatPrice(centavos: number): string {
  const value = Number.isFinite(centavos) ? centavos : 0;
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parsePriceToCents(value: string | number): number {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace("R$", "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : NaN;
}
