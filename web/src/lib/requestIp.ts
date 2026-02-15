export function getRequestIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();

  return "unknown";
}
