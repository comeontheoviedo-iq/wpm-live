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

/** Bumped to v2 so inflated v1 localStorage (userAdjusted huge sizes) is ignored. */
export const FIELD_SETTINGS_STORAGE_KEY = "pitchline.fieldSettings.v2";
const FIELD_SETTINGS_STORAGE_KEY_V1 = "pitchline.fieldSettings.v1";

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  markerSizePct: -25,
  nameSizePct: 0,
  dataRows: 2,
  fieldsPerRow: 4,
  userAdjusted: false,
};

/**
 * Fullscreen desired marker % when user never adjusted Field Settings.
 * Was +40 (auto-inflate — broke Full view). Now 0 — no auto bump; PitchBoard still fits down.
 */
export const FULLSCREEN_DEFAULT_MARKER_PCT = 0;

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
    const rawV2 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY);
    if (rawV2) {
      return normalizeFieldSettings(JSON.parse(rawV2) as Partial<FieldSettings>);
    }

    // Migrate off v1: drop inflated userAdjusted from broken sessions;
    // everyone gets fresh smaller defaults on v2.
    const hadV1 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY_V1) != null;
    if (hadV1) {
      try {
        window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V1);
      } catch {
        /* ignore */
      }
    }
    const fresh = { ...DEFAULT_FIELD_SETTINGS };
    window.localStorage.setItem(
      FIELD_SETTINGS_STORAGE_KEY,
      JSON.stringify(fresh)
    );
    return fresh;
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
    // Keep v1 cleared so old code paths / stale tabs don't revive huge sizes.
    try {
      window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota / private mode */
  }
}

/**
 * Desired marker % before container fit/clamp.
 * Fullscreen + !userAdjusted → FULLSCREEN_DEFAULT_MARKER_PCT (0, no inflate);
 * PitchBoard still fits down so 22 cards never overlap.
 * userAdjusted → user value exactly (PitchBoard skips overlap reposition so
 * size changes never move formation anchors).
 */
export function effectiveMarkerPct(
  settings: FieldSettings,
  isFullscreen: boolean
): number {
  if (settings.userAdjusted) return settings.markerSizePct;
  // Fullscreen used to return FULLSCREEN_DEFAULT_MARKER_PCT (+40) and inflate cards.
  // Cap at that constant (now 0) so Full never auto-grows above windowed default.
  if (isFullscreen) {
    return Math.min(FULLSCREEN_DEFAULT_MARKER_PCT, settings.markerSizePct);
  }
  return settings.markerSizePct;
}

export function scaleFactor(pct: number): number {
  return 1 + clampPct(pct) / 100;
}

export function formatPctLabel(pct: number): string {
  if (pct === 0) return "Default";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}
