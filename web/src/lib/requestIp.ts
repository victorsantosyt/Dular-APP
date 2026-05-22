// Extração defensiva do IP do cliente.
//
// Limitação conhecida: em Next.js App Router não temos acesso direto ao
// `remoteAddress` da conexão; dependemos dos headers de proxy. Esses
// headers só são confiáveis quando o proxy/edge (Vercel, Cloudflare, nginx)
// SOBRESCREVE x-forwarded-for / x-real-ip — se o app ficar exposto direto
// na internet, esses valores são forjáveis pelo cliente. Validar a borda.
//
// Estratégia:
//   1. x-forwarded-for: pega o primeiro IP da lista (cliente original) e
//      valida formato mínimo (IPv4 ou IPv6).
//   2. x-real-ip: idem, sem split.
//   3. Fallback para "unknown".

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function isValidIp(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 45) return false;
  if (IPV4_RE.test(v)) {
    return v.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  if (IPV6_RE.test(v) && v.includes(":")) return true;
  return false;
}

function firstValidFromList(raw: string | null): string | null {
  if (!raw) return null;
  for (const candidate of raw.split(",")) {
    const trimmed = candidate.trim();
    if (isValidIp(trimmed)) return trimmed;
  }
  return null;
}

export function getRequestIp(req: Request): string {
  const xff = firstValidFromList(req.headers.get("x-forwarded-for"));
  if (xff) return xff;

  const xr = req.headers.get("x-real-ip");
  if (xr && isValidIp(xr.trim())) return xr.trim();

  return "unknown";
}
