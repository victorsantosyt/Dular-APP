import * as Location from "expo-location";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  avaliarPosicao,
  interpretarGeocodificacao,
  type MotivoSemMunicipio,
  type MunicipioResolvido,
} from "@/lib/municipioAtual";

export type CurrentAddress = {
  coords: { latitude: number; longitude: number };
  address: Location.LocationGeocodedAddress | null;
};
export type LocationUpdate = CurrentAddress;

const CONSENT_KEY = "location_consent_ack_v1";

async function hasConsentAck() {
  return (await AsyncStorage.getItem(CONSENT_KEY)) === "yes";
}

async function setConsentAck() {
  await AsyncStorage.setItem(CONSENT_KEY, "yes");
}

/**
 * Mostra um aviso em português antes de abrir o prompt nativo, apenas na primeira vez.
 */
export async function confirmLocationPermission(): Promise<boolean> {
  if (await hasConsentAck()) return true;

  return new Promise((resolve) => {
    Alert.alert(
      "Permitir localização",
      "Usamos sua localização para sugerir profissionais e serviços próximos. Deseja permitir agora?",
      [
        { text: "Recusar", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Permitir",
          style: "default",
          onPress: async () => {
            await setConsentAck();
            resolve(true);
          },
        },
      ],
      { cancelable: true }
    );
  });
}

/**
 * Garante permissão de localização (mostra aviso customizado só na primeira vez).
 * Lança erro se não conceder.
 */
export async function ensureLocationPermission(): Promise<Location.LocationPermissionResponse> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.status === "granted") {
    await setConsentAck();
    return existing;
  }

  const ok = await confirmLocationPermission();
  if (!ok) {
    throw new Error("Permissão de localização não concedida.");
  }

  const res = await Location.requestForegroundPermissionsAsync();
  if (res.status !== "granted") {
    throw new Error("Permissão de localização não concedida.");
  }
  await setConsentAck();
  return res;
}

/**
 * Pede permissão de localização e retorna coordenadas + endereço (quando disponível).
 * Lança erro se a permissão for negada.
 */
export async function requestLocationWithAddress(): Promise<CurrentAddress> {
  await ensureLocationPermission();

  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;

  let address: Location.LocationGeocodedAddress | null = null;
  try {
    const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
    address = geo?.[0] ?? null;
  } catch {
    // silêncio: sem endereço, apenas coords
    address = null;
  }

  return { coords: { latitude, longitude }, address };
}

/**
 * Inicia um watcher de localização e chama onUpdate a cada ping.
 */
export async function startLocationWatcher(
  onUpdate: (data: LocationUpdate) => void,
  options: { timeIntervalMs?: number; distanceIntervalM?: number } = {}
): Promise<Location.LocationSubscription> {
  await ensureLocationPermission();
  const { timeIntervalMs = 60000, distanceIntervalM = 30 } = options;
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: timeIntervalMs,
      distanceInterval: distanceIntervalM,
    },
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      let address: Location.LocationGeocodedAddress | null = null;
      try {
        const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = geo?.[0] ?? null;
      } catch {
        address = null;
      }
      onUpdate({ coords: { latitude, longitude }, address });
    }
  );
}

/**
 * Município e UF da posição atual, para preencher formulários de área. Recusa
 * (sem preencher nada) posição imprecisa, antiga, fora do Brasil ou com
 * endereço ambíguo — a decisão fica em lib/municipioAtual. Nada daqui vai para
 * log: coordenadas e endereço são dado pessoal.
 */
export async function obterMunicipioAtual(): Promise<
  | { ok: true; municipio: MunicipioResolvido; coords: { latitude: number; longitude: number } }
  | { ok: false; motivo: MotivoSemMunicipio }
> {
  try {
    await ensureLocationPermission();
  } catch {
    return { ok: false, motivo: "permissao-negada" };
  }
  let pos: Location.LocationObject;
  try {
    pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
  const problema = avaliarPosicao(pos, Date.now());
  if (problema) return { ok: false, motivo: problema };

  const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  let resultados: Location.LocationGeocodedAddress[];
  try {
    resultados = await Location.reverseGeocodeAsync(coords);
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
  const r = interpretarGeocodificacao(resultados);
  return r.ok ? { ok: true, municipio: r.municipio, coords } : r;
}
