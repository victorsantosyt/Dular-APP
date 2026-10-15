export type AndroidAppRelease = {
  versionCode: number;
  versionName: string;
  notes: string[];
  packageName: "br.com.dular.app";
  storeUrl: "https://play.google.com/store/apps/details?id=br.com.dular.app";
};

export function parseAndroidAppRelease(raw: string | undefined): AndroidAppRelease | null {
  if (!raw) return null;

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;

    const release = value as Record<string, unknown>;
    const keys = Object.keys(release);
    if (keys.length !== 3 || keys.some((key) => !["versionCode", "versionName", "notes"].includes(key))) return null;
    if (typeof release.versionCode !== "number" || !Number.isSafeInteger(release.versionCode) || release.versionCode <= 0 || release.versionCode > 2_100_000_000) return null;
    if (typeof release.versionName !== "string") return null;
    const versionName = release.versionName.trim();
    if (!versionName || versionName.length > 30) return null;
    if (!Array.isArray(release.notes) || release.notes.length > 5) return null;

    const notes: string[] = [];
    for (const note of release.notes) {
      if (typeof note !== "string") return null;
      const text = note.trim();
      if (!text || text.length > 180) return null;
      notes.push(text);
    }

    return {
      versionCode: release.versionCode,
      versionName,
      notes,
      packageName: "br.com.dular.app",
      storeUrl: "https://play.google.com/store/apps/details?id=br.com.dular.app",
    };
  } catch {
    return null;
  }
}
