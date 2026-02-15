export function apiMsg(e: any, fallback: string) {
  const st = e?.response?.status;
  if (st === 404 || st === 501) return "Em breve.";
  return e?.response?.data?.error ?? e?.message ?? fallback;
}
