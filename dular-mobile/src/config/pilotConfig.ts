function boolEnv(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
}

function numberEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listEnv(value: string | undefined, fallback: string[]) {
  if (!value) return fallback;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

export const PILOT_MODE = boolEnv(process.env.EXPO_PUBLIC_PILOT_MODE, false);

export const PILOT = {
  cidade: process.env.EXPO_PUBLIC_PILOT_CITY ?? "Cuiabá",
  uf: process.env.EXPO_PUBLIC_PILOT_UF ?? "MT",
  lat: numberEnv(process.env.EXPO_PUBLIC_PILOT_LAT, -15.601),
  lng: numberEnv(process.env.EXPO_PUBLIC_PILOT_LNG, -56.097),
  bairros: listEnv(process.env.EXPO_PUBLIC_PILOT_BAIRROS, ["Centro", "Santa Rosa", "Jardim Itália"]),
};
