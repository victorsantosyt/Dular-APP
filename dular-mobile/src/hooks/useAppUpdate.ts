import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Application from "expo-application";
import API_URL from "@/config/api";
import { ANDROID_PACKAGE, UPDATE_CHECK_INTERVAL_MS, fetchAndroidRelease, openPlayStore, parseInstalledBuild, shouldOfferUpdate, updateStorageKey, type AndroidRelease } from "@/lib/appUpdate";

export function useAppUpdate(enabled: boolean) {
  const [release, setRelease] = useState<AndroidRelease | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === "active");
  const alive = useRef(true);
  const openingRef = useRef(false);
  const dismissalEpoch = useRef(0);
  const lastCheckRef = useRef<number | null>(null);
  const dismissed = useRef(new Map<string, string>());
  const installedBuild = parseInstalledBuild(Application.nativeBuildVersion);
  const eligible = enabled && !__DEV__ && Platform.OS === "android" &&
    Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
    Application.applicationId === ANDROID_PACKAGE && installedBuild !== null;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!eligible || installedBuild === null) {
      setRelease(null);
      return;
    }
    let disposed = false;
    let controller: AbortController | null = null;
    setActive(AppState.currentState === "active");
    const check = async () => {
      const now = Date.now();
      if (disposed || controller || (lastCheckRef.current !== null && now - lastCheckRef.current < UPDATE_CHECK_INTERVAL_MS)) return;
      lastCheckRef.current = now;
      const epoch = dismissalEpoch.current;
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => current.abort(), 5000);
      try {
        const next = await fetchAndroidRelease(API_URL, current.signal);
        if (!next || disposed || current.signal.aborted) return;
        const key = updateStorageKey(API_URL, next.versionCode);
        let saved: string | null = dismissed.current.get(key) ?? null;
        if (saved === null) {
          try { saved = await AsyncStorage.getItem(key); } catch { /* A rede e o armazenamento não bloqueiam a abertura. */ }
        }
        if (disposed || epoch !== dismissalEpoch.current || current.signal.aborted || AppState.currentState !== "active") return;
        if (shouldOfferUpdate(next, installedBuild, saved, Date.now())) {
          setError(null);
          setRelease(next);
        }
      } finally {
        clearTimeout(timeout);
        if (controller === current) controller = null;
      }
    };
    if (AppState.currentState === "active") void check();
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") void check();
      else controller?.abort();
    });
    return () => {
      disposed = true;
      controller?.abort();
      subscription.remove();
    };
  }, [eligible, installedBuild]);

  const dismiss = useCallback(() => {
    if (!release) return;
    const key = updateStorageKey(API_URL, release.versionCode);
    const timestamp = String(Date.now());
    dismissalEpoch.current += 1;
    dismissed.current.set(key, timestamp);
    setRelease(null);
    setError(null);
    void AsyncStorage.setItem(key, timestamp).catch(() => {});
  }, [release]);

  const update = useCallback(async () => {
    if (!release || openingRef.current) return;
    openingRef.current = true;
    setOpening(true);
    setError(null);
    // Linking.openURL é método de classe e usa `this`: passado solto, lança
    // TypeError antes de chegar ao Android e nenhuma das duas URLs abre.
    const opened = await openPlayStore((url) => Linking.openURL(url));
    openingRef.current = false;
    if (!alive.current) return;
    setOpening(false);
    if (opened) dismiss();
    else setError("Não foi possível abrir a Google Play. Tente novamente.");
  }, [dismiss, release]);

  return { release: eligible && active ? release : null, opening, error, dismiss, update };
}
