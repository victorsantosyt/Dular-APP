import { useEffect, useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { ensureLocationPermission } from "@/lib/location";
import { avaliarPosicao, criarConsultaDescartavel, interpretarGeocodificacao } from "@/lib/municipioAtual";
import { epocaSessao } from "@/lib/sessaoAtual";

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

  const consulta = useRef(criarConsultaDescartavel()).current;

  // Cidade e UF só quando a posição é boa e o endereço não é ambíguo
  // (lib/municipioAtual): antes, "Mato Grosso" virava UF por extenso ou cortada.
  // Sem município confiável, ficam vazias e a tela usa o que já tinha.
  const load = useCallback(async () => {
    const valida = consulta.iniciar();
    const epoca = epocaSessao();
    const vigente = () => valida() && epocaSessao() === epoca;
    try {
      setError(null);
      setLoading(true);

      await ensureLocationPermission();
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (!vigente()) return;

      const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCoords(c);
      if (avaliarPosicao(pos, Date.now())) return;

      const r = interpretarGeocodificacao(await Location.reverseGeocodeAsync(c));
      if (!vigente() || !r.ok) return;
      setCidade(r.municipio.cidade);
      setUf(r.municipio.uf);
      setBairro(r.municipio.bairro ?? "");
    } catch (e: any) {
      if (vigente()) setError(e?.message ?? "Falha ao obter localização.");
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [consulta]);

  useEffect(() => {
    load();
    return () => consulta.invalidar();
  }, [load, consulta]);

  return { loading, error, coords, cidade, uf, bairro, refresh: load };
}
