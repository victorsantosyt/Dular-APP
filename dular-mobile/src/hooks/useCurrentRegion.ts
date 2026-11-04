import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { obterMunicipioAtual } from "@/lib/location";
import { criarConsultaDescartavel, mensagemSemMunicipio } from "@/lib/municipioAtual";
import { epocaSessao } from "@/lib/sessaoAtual";

export type CurrentRegion = {
  latitude?: number;
  longitude?: number;
  cidade: string;
  uf: string;
  bairro: string;
};

type PermissionStatus = "unknown" | "granted" | "denied";

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

  // Só a última consulta vale; desmontar ou trocar de conta descarta a resposta.
  const consulta = useRef(criarConsultaDescartavel()).current;
  useEffect(() => () => consulta.invalidar(), [consulta]);

  // Município e UF pela regra única de lib/municipioAtual. Sem resultado
  // confiável devolve null com a mensagem do motivo — quem chamou mantém os
  // campos como estavam.
  const requestRegion = useCallback(async (): Promise<CurrentRegion | null> => {
    const valida = consulta.iniciar();
    const epoca = epocaSessao();
    const vigente = () => valida() && epocaSessao() === epoca;
    setLoading(true);
    setError(null);
    try {
      const r = await obterMunicipioAtual();
      if (!vigente()) return null;
      if (!r.ok) {
        setError(mensagemSemMunicipio(r.motivo));
        if (r.motivo === "permissao-negada") setPermissionStatus("denied");
        return null;
      }
      const next: CurrentRegion = {
        latitude: r.coords.latitude,
        longitude: r.coords.longitude,
        cidade: r.municipio.cidade,
        uf: r.municipio.uf,
        bairro: r.municipio.bairro ?? "",
      };
      setRegion(next);
      setPermissionStatus("granted");
      return next;
    } finally {
      if (vigente()) setLoading(false);
    }
  }, [consulta]);

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
