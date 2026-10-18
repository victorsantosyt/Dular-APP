import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Application from "expo-application";
import API_URL from "@/config/api";
import { ANDROID_PACKAGE, UPDATE_CHECK_INTERVAL_MS, UPDATE_RETRY_BASE_MS, consultarVersaoAndroid, openPlayStore, parseInstalledBuild, shouldOfferUpdate, updateStorageKey, type AndroidRelease } from "@/lib/appUpdate";

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
    // Fora do estado pronto (login, troca de conta, bootstrap) só não consulta:
    // o aviso já obtido é da versão do app, não da conta, e volta a aparecer
    // para o perfil seguinte. Quem esconde é `eligible` no retorno.
    if (!eligible || installedBuild === null) return;
    let disposed = false;
    let controller: AbortController | null = null;
    // Consulta em andamento: marca do intervalo que ela reservou, para devolver
    // na hora se a troca de conta (ou o fim do efeito) a interromper.
    let reserva: { em: number; anterior: number | null } | null = null;
    // Reavaliação com o app aberto: depois de consulta concluída, no fim do
    // intervalo (anúncio novo, adiamento vencido); depois de consulta sem
    // resposta, em 30 s, 60 s, 120 s… até o intervalo — sem exigir reinício.
    let proxima: ReturnType<typeof setTimeout> | null = null;
    let falhasSeguidas = 0;
    const agendar = (ms: number) => {
      if (proxima) clearTimeout(proxima);
      proxima = setTimeout(() => { proxima = null; void check(); }, Math.max(0, ms));
    };
    const cancelarAgenda = () => {
      if (proxima) clearTimeout(proxima);
      proxima = null;
    };
    setActive(AppState.currentState === "active");
    const check = async () => {
      const now = Date.now();
      if (disposed || controller) return;
      if (lastCheckRef.current !== null && now - lastCheckRef.current < UPDATE_CHECK_INTERVAL_MS) {
        if (!proxima && AppState.currentState === "active") agendar(lastCheckRef.current + UPDATE_CHECK_INTERVAL_MS - now);
        return;
      }
      const anterior = lastCheckRef.current;
      lastCheckRef.current = now;
      reserva = { em: now, anterior };
      // Consulta interrompida (troca de conta, app em segundo plano) não conta
      // para o intervalo: o próximo perfil ou a volta ao app consultam de novo.
      let concluida = false;
      let semResposta = false;
      let tempoEsgotado = false;
      const epoch = dismissalEpoch.current;
      const current = new AbortController();
      controller = current;
      const timeout = setTimeout(() => { tempoEsgotado = true; current.abort(); }, 5000);
      try {
        const consulta = await consultarVersaoAndroid(API_URL, current.signal);
        if (disposed || (current.signal.aborted && !tempoEsgotado)) return;
        if (!consulta.ok || tempoEsgotado) { semResposta = true; return; }
        const next = consulta.release;
        if (!next) { concluida = true; return; }
        const key = updateStorageKey(API_URL, next.versionCode);
        let saved: string | null = dismissed.current.get(key) ?? null;
        if (saved === null) {
          try { saved = await AsyncStorage.getItem(key); } catch { /* A rede e o armazenamento não bloqueiam a abertura. */ }
        }
        if (epoch !== dismissalEpoch.current) { concluida = true; return; }
        if (disposed || current.signal.aborted || AppState.currentState !== "active") return;
        concluida = true;
        if (shouldOfferUpdate(next, installedBuild, saved, Date.now())) {
          setError(null);
          setRelease(next);
        }
      } finally {
        clearTimeout(timeout);
        if (reserva?.em === now) reserva = null;
        if (!concluida && lastCheckRef.current === now) lastCheckRef.current = anterior;
        if (controller === current) controller = null;
        if (!disposed && AppState.currentState === "active") {
          if (concluida) {
            falhasSeguidas = 0;
            agendar(UPDATE_CHECK_INTERVAL_MS);
          } else if (semResposta) {
            falhasSeguidas += 1;
            agendar(Math.min(UPDATE_RETRY_BASE_MS * 2 ** (falhasSeguidas - 1), UPDATE_CHECK_INTERVAL_MS));
          }
        }
      }
    };
    if (AppState.currentState === "active") void check();
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") void check();
      else {
        controller?.abort();
        cancelarAgenda();
      }
    });
    return () => {
      disposed = true;
      // A consulta interrompida não conta para o intervalo: o próximo efeito
      // (outro perfil, app pronto de novo) consulta já, sem esperar a resposta
      // antiga — que, quando chegar, é descartada.
      if (reserva && lastCheckRef.current === reserva.em) lastCheckRef.current = reserva.anterior;
      reserva = null;
      controller?.abort();
      cancelarAgenda();
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
