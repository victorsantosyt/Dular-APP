import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { requestLocationWithAddress } from "@/lib/location";

export type CurrentRegion = {
  latitude?: number;
  longitude?: number;
  cidade: string;
  uf: string;
  bairro: string;
};

type PermissionStatus = "unknown" | "granted" | "denied";

const UF_BY_STATE: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amapá: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  ceará: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  "espírito santo": "ES",
  goias: "GO",
  goiás: "GO",
  maranhao: "MA",
  maranhão: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  pará: "PA",
  paraiba: "PB",
  paraíba: "PB",
  parana: "PR",
  paraná: "PR",
  pernambuco: "PE",
  piaui: "PI",
  piauí: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  rondônia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  "são paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function toUf(address: Location.LocationGeocodedAddress | null) {
  const raw = (address as any)?.region_code || address?.region || "";
  const value = String(raw).trim();
  if (value.length === 2) return value.toUpperCase();
  return UF_BY_STATE[normalize(value)] ?? value.slice(0, 2).toUpperCase();
}

function toRegion(data: Awaited<ReturnType<typeof requestLocationWithAddress>>): CurrentRegion {
  const address = data.address;
  return {
    latitude: data.coords.latitude,
    longitude: data.coords.longitude,
    cidade: address?.city || address?.subregion || address?.region || "",
    uf: toUf(address),
    bairro: address?.district || address?.subregion || "",
  };
}

export function useCurrentRegion() {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unknown");
  const [region, setRegion] = useState<CurrentRegion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!active) return;
        setPermissionStatus(permission.status === "granted" ? "granted" : permission.status === "denied" ? "denied" : "unknown");
      })
      .catch(() => {
        if (active) setPermissionStatus("unknown");
      });
    return () => {
      active = false;
    };
  }, []);

  const requestRegion = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = toRegion(await requestLocationWithAddress());
      setRegion(next);
      setPermissionStatus("granted");
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível obter sua localização.";
      setError(message);
      setPermissionStatus("denied");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    latitude: region?.latitude,
    longitude: region?.longitude,
    cidade: region?.cidade ?? "",
    uf: region?.uf ?? "",
    bairro: region?.bairro ?? "",
    permissionStatus,
    loading,
    error,
    region,
    setRegion,
    requestRegion,
  };
}
