import { useState } from "react";
import { Linking } from "react-native";
import Constants from "expo-constants";
import * as Location from "expo-location";

import { api } from "@/lib/api";

export interface UseSegurancaReturn {
  checkInRealizado: boolean;
  checkInLoading: boolean;
  sosEnviado: boolean;
  protocolo: string | null;
  fazerCheckIn: (servicoId: string) => Promise<void>;
  acionarSOS: (servicoId: string, mensagem?: string) => Promise<void>;
}

async function tryGetCoords(
  timeoutMs = 5000,
): Promise<{ latitude: number; longitude: number } | undefined> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return undefined;

    const timeoutPromise = new Promise<undefined>((resolve) =>
      setTimeout(() => resolve(undefined), timeoutMs),
    );
    const locPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    }).then((pos) => ({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    }));

    return await Promise.race([locPromise, timeoutPromise]);
  } catch {
    return undefined;
  }
}

export function useSeguranca(): UseSegurancaReturn {
  const [checkInRealizado, setCheckInRealizado] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [sosEnviado, setSosEnviado] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);

  const fazerCheckIn = async (servicoId: string): Promise<void> => {
    setCheckInLoading(true);
    try {
      const coords = await tryGetCoords();
      await api.post("/api/seguranca/checkin", {
        servicoId,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
      setCheckInRealizado(true);
    } catch (err) {
      console.error("[CheckIn] falha:", err);
      setCheckInRealizado(false);
    } finally {
      setCheckInLoading(false);
    }
  };

  const acionarSOS = async (servicoId: string, mensagem?: string): Promise<void> => {
    // PASSO 1 — WhatsApp abre ANTES de qualquer await
    const numero: string =
      (Constants.expoConfig?.extra?.sosWhatsapp as string | undefined) ?? "5565999999999";
    const texto = encodeURIComponent(mensagem ?? "EMERGÊNCIA: Preciso de ajuda agora!");
    Linking.openURL(`https://wa.me/${numero}?text=${texto}`);

    // PASSO 2 — fire-and-forget: localização + backend
    try {
      const coords = await tryGetCoords();
      const res = await api.post<{ ok: boolean; protocolo: string }>("/api/seguranca/sos", {
        servicoId,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
        mensagem,
      });
      setSosEnviado(true);
      setProtocolo(res.data.protocolo ?? null);
    } catch (err) {
      console.error("[SOS] falha ao registrar no backend:", err);
      setSosEnviado(true);
      setProtocolo(null);
    }

    // PASSO 3 — garantia: sempre marcado como enviado
    setSosEnviado(true);
  };

  return {
    checkInRealizado,
    checkInLoading,
    sosEnviado,
    protocolo,
    fazerCheckIn,
    acionarSOS,
  };
}
