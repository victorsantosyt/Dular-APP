import * as Location from "expo-location";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      "Usamos sua localização para sugerir diaristas e serviços próximos. Deseja permitir agora?",
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
  } catch (e) {
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
