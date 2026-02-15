import { useEffect, useState, useCallback } from "react";
import * as Location from "expo-location";
import { ensureLocationPermission } from "../lib/location";

type GeoDefaults = {
  loading: boolean;
  error: string | null;
  coords: { latitude: number; longitude: number } | null;
  cidade: string;
  uf: string;
  bairro: string;
  refresh: () => Promise<void>;
};

export function useGeoDefaults(): GeoDefaults {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<GeoDefaults["coords"]>(null);
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [bairro, setBairro] = useState("");

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      await ensureLocationPermission();
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);

      const rev = await Location.reverseGeocodeAsync(c);
      const r = rev?.[0];
      const city = r?.city || r?.subregion || r?.region || "";
      const state = (r as any)?.region_code || r?.region || r?.isoCountryCode || "";
      const district = r?.district || r?.subregion || "";

      setCidade(city);
      setUf(state.length === 2 ? state : state || r?.region || "");
      setBairro(district);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao obter localização.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, coords, cidade, uf, bairro, refresh: load };
}
