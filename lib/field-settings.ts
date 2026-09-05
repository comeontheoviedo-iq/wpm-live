/** Pitch card Field Settings — SportsCom-style marker controls (localStorage). */

export type FieldSettingsTab = "player" | "keeper" | "coach" | "referee";

export type FieldSettings = {
  /** Marker size percent offset: -40 … +40 */
  markerSizePct: number;
  /** Name text size percent offset: -40 … +40 */
  nameSizePct: number;
  /** Stat rows under the name */
  dataRows: 1 | 2;
  /** Stat cells per row */
  fieldsPerRow: 3 | 4 | 5;
  /** True once user moves any slider (stops auto fullscreen bump) */
  userAdjusted: boolean;
};

export const FIELD_SETTINGS_STORAGE_KEY = "pitchline.fieldSettings.v1";

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  markerSizePct: 0,
  nameSizePct: 0,
  dataRows: 2,
  fieldsPerRow: 4,
  userAdjusted: false,
};

/**
 * Fullscreen auto-fit ceiling when user never adjusted Field Settings.
 * PitchBoard fits down from this so 22 cards never overlap (was blind +20).
 */
export const FULLSCREEN_DEFAULT_MARKER_PCT = 40;

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-40, Math.min(40, Math.round(n)));
}

export function normalizeFieldSettings(
  raw: Partial<FieldSettings> | null | undefined
): FieldSettings {
  const base = { ...DEFAULT_FIELD_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const rows = Number(raw.dataRows);
  const cols = Number(raw.fieldsPerRow);
  return {
    markerSizePct: clampPct(Number(raw.markerSizePct ?? base.markerSizePct)),
    nameSizePct: clampPct(Number(raw.nameSizePct ?? base.nameSizePct)),
    dataRows: rows === 1 ? 1 : 2,
    fieldsPerRow: cols === 3 || cols === 5 ? (cols as 3 | 5) : 4,
    userAdjusted: Boolean(raw.userAdjusted),
  };
}

export function loadFieldSettings(): FieldSettings {
  if (typeof window === "undefined") return { ...DEFAULT_FIELD_SETTINGS };
  try {
    const raw = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FIELD_SETTINGS };
    return normalizeFieldSettings(JSON.parse(raw) as Partial<FieldSettings>);
  } catch {
    return { ...DEFAULT_FIELD_SETTINGS };
  }
}

export function saveFieldSettings(settings: FieldSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FIELD_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeFieldSettings(settings))
    );
  } catch {
    /* quota / private mode */
  }
}

/**
 * Desired marker % before container fit/clamp.
 * Fullscreen + !userAdjusted → auto-fit ceiling (+40); PitchBoard fits down.
 * userAdjusted → user value (still clamped by fit so overlaps never win).
 */
export function effectiveMarkerPct(
  settings: FieldSettings,
  isFullscreen: boolean
): number {
  if (settings.userAdjusted) return settings.markerSizePct;
  if (isFullscreen) return FULLSCREEN_DEFAULT_MARKER_PCT;
  return settings.markerSizePct;
}

export function scaleFactor(pct: number): number {
  return 1 + clampPct(pct) / 100;
}

export function formatPctLabel(pct: number): string {
  if (pct === 0) return "Default";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
