export const ANDROID_PACKAGE = "br.com.dular.app";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
export const UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;
export const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export type AndroidRelease = {
  versionCode: number;
  versionName: string;
  notes: string[];
  packageName: typeof ANDROID_PACKAGE;
  storeUrl: typeof PLAY_STORE_URL;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseInstalledBuild(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const build = Number(value);
  return Number.isInteger(build) && build <= 2100000000 ? build : null;
}

export function parseAndroidRelease(value: unknown): AndroidRelease | null {
  if (!record(value) || !record(value.android)) return null;
  const release = value.android;
  if (
    typeof release.versionCode !== "number" || !Number.isInteger(release.versionCode) ||
    release.versionCode < 1 || release.versionCode > 2100000000 ||
    typeof release.versionName !== "string" || release.versionName.trim() !== release.versionName ||
    release.versionName.length < 1 || release.versionName.length > 30 ||
    !Array.isArray(release.notes) || release.notes.length > 5 ||
    !release.notes.every((note) => typeof note === "string" && note.trim() === note && note.length >= 1 && note.length <= 180) ||
    release.packageName !== ANDROID_PACKAGE || release.storeUrl !== PLAY_STORE_URL
  ) return null;
  return release as AndroidRelease;
}

export function updateStorageKey(apiUrl: string, build: number): string {
  return `dular:app-update:${encodeURIComponent(new URL(apiUrl).origin)}:${build}`;
}

export function shouldOfferUpdate(release: AndroidRelease, installedBuild: number, dismissedAt: string | null, now: number): boolean {
  if (release.versionCode <= installedBuild) return false;
  if (dismissedAt === null) return true;
  const timestamp = Number(dismissedAt);
  return !Number.isFinite(timestamp) || timestamp <= 0 || timestamp > now || now - timestamp >= UPDATE_SNOOZE_MS;
}

/** Primeira nova tentativa depois de uma consulta sem resposta; dobra até o intervalo normal. */
export const UPDATE_RETRY_BASE_MS = 30 * 1000;

/**
 * Resultado da consulta do anúncio. `ok: false` é "não deu para saber" (sem
 * rede, tempo esgotado, servidor 5xx/429/408): vale tentar de novo logo.
 * `ok: true` com `release: null` é resposta definitiva sem anúncio válido.
 */
export type ConsultaDeVersao = { ok: true; release: AndroidRelease | null } | { ok: false };

export async function consultarVersaoAndroid(apiUrl: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<ConsultaDeVersao> {
  let response: Response;
  try {
    const url = new URL("/api/app/version", apiUrl);
    response = await request(url.toString(), { signal, credentials: "omit", headers: { Accept: "application/json" } });
  } catch {
    return { ok: false };
  }
  if (response.status >= 500 || response.status === 429 || response.status === 408) return { ok: false };
  if (!response.ok) return { ok: true, release: null };
  try {
    return { ok: true, release: parseAndroidRelease(await response.json()) };
  } catch {
    return { ok: true, release: null };
  }
}

export async function fetchAndroidRelease(apiUrl: string, signal: AbortSignal, request: typeof fetch = fetch): Promise<AndroidRelease | null> {
  const r = await consultarVersaoAndroid(apiUrl, signal, request);
  return r.ok ? r.release : null;
}

export async function openPlayStore(openURL: (url: string) => Promise<unknown>): Promise<boolean> {
  try {
    await openURL(`market://details?id=${ANDROID_PACKAGE}`);
    return true;
  } catch {
    try {
      await openURL(PLAY_STORE_URL);
      return true;
    } catch {
      return false;
    }
  }
}
