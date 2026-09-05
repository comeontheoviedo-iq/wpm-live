/** Pitch card Field Settings (localStorage). */

export type FieldSettingsTab = "player" | "keeper" | "coach" | "referee";

export type CardStatField =
  | "APP"
  | "S_GOL"
  | "S_AST"
  | "M_APP"
  | "M_MIN"
  | "M_GOL"
  | "M_AST"
  | "RTG"
  | "AGE"
  | "SUB"
  | "HGT"
  | "WGT"
  | "FOT"
  | "SV"
  | "CS"
  | "VAL";

export type HeightUnit = "cm" | "ftin";
export type CurrencyCode = "GBP" | "EUR" | "USD";

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
  /** Which outfield/gk stats appear on the card (order = priority) */
  visibleFields: CardStatField[];
  heightUnit: HeightUnit;
  currency: CurrencyCode;
};

/** Bumped to v3 for visibleFields / units / currency. */
export const FIELD_SETTINGS_STORAGE_KEY = "pitchline.fieldSettings.v3";
const FIELD_SETTINGS_STORAGE_KEY_V2 = "pitchline.fieldSettings.v2";
const FIELD_SETTINGS_STORAGE_KEY_V1 = "pitchline.fieldSettings.v1";

export const ALL_CARD_FIELDS: {
  id: CardStatField;
  label: string;
  hint: string;
  gk?: boolean;
  outfield?: boolean;
}[] = [
  { id: "APP", label: "APP", hint: "Season appearances", outfield: true, gk: true },
  { id: "S_GOL", label: "S GOL", hint: "Season goals", outfield: true },
  { id: "S_AST", label: "S AST", hint: "Season assists", outfield: true },
  { id: "M_APP", label: "M APP", hint: "Appeared this match (starter or sub-on)", outfield: true, gk: true },
  { id: "M_MIN", label: "M MIN", hint: "Minutes this match", outfield: true, gk: true },
  { id: "M_GOL", label: "M GOL", hint: "Goals this match", outfield: true },
  { id: "M_AST", label: "M AST", hint: "Assists this match", outfield: true },
  { id: "RTG", label: "RTG", hint: "Season rating", outfield: true, gk: true },
  { id: "AGE", label: "AGE", hint: "Age (also under name when known)", outfield: true, gk: true },
  { id: "SUB", label: "SUB", hint: "Sub minute / out", outfield: true },
  { id: "HGT", label: "HGT", hint: "Height", outfield: true, gk: true },
  { id: "WGT", label: "WGT", hint: "Weight", outfield: true, gk: true },
  { id: "FOT", label: "FOT", hint: "Preferred foot", outfield: true, gk: true },
  { id: "SV", label: "SV", hint: "Saves this match", gk: true },
  { id: "CS", label: "CS", hint: "Season clean sheets", gk: true },
  { id: "VAL", label: "VAL", hint: "Market value (when known)", outfield: true, gk: true },
];

export const DEFAULT_VISIBLE_FIELDS: CardStatField[] = [
  "APP",
  "S_GOL",
  "S_AST",
  "M_APP",
  "M_MIN",
  "M_GOL",
  "M_AST",
  "SUB",
];

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  markerSizePct: -25,
  nameSizePct: 0,
  dataRows: 2,
  fieldsPerRow: 4,
  userAdjusted: false,
  visibleFields: [...DEFAULT_VISIBLE_FIELDS],
  heightUnit: "cm",
  currency: "EUR",
};

/**
 * Fullscreen desired marker % when user never adjusted Field Settings.
 * Cap at 0 so Full never auto-grows above windowed default.
 */
export const FULLSCREEN_DEFAULT_MARKER_PCT = 0;

export function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-40, Math.min(40, Math.round(n)));
}

export function currencySymbol(code: CurrencyCode): string {
  if (code === "GBP") return "£";
  if (code === "USD") return "$";
  return "€";
}

export function formatHeightValue(
  cm: number | null | undefined,
  unit: HeightUnit
): string {
  if (cm == null || !Number.isFinite(cm)) return "—";
  if (unit === "ftin") {
    const totalIn = Math.round(cm / 2.54);
    const ft = Math.floor(totalIn / 12);
    const inches = totalIn % 12;
    return `${ft}'${inches}"`;
  }
  return String(Math.round(cm));
}

export function formatWeightValue(
  kg: number | null | undefined,
  heightUnit: HeightUnit
): string {
  if (kg == null || !Number.isFinite(kg)) return "—";
  // Mirror height unit: ft/in → lbs, cm → kg
  if (heightUnit === "ftin") {
    return `${Math.round(kg * 2.20462)} lbs`;
  }
  return `${Math.round(kg)} kg`;
}

export function formatMarketValue(
  raw: number | null | undefined,
  currency: CurrencyCode
): string {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return "—";
  const sym = currencySymbol(currency);
  if (raw >= 1_000_000) {
    const m = raw / 1_000_000;
    return `${sym}${m >= 10 ? Math.round(m) : m.toFixed(1)}m`;
  }
  if (raw >= 1_000) {
    return `${sym}${Math.round(raw / 1_000)}k`;
  }
  return `${sym}${Math.round(raw)}`;
}

function normalizeVisibleFields(raw: unknown): CardStatField[] {
  const allowed = new Set(ALL_CARD_FIELDS.map((f) => f.id));
  if (!Array.isArray(raw)) return [...DEFAULT_VISIBLE_FIELDS];
  const out: CardStatField[] = [];
  for (const x of raw) {
    const id = String(x) as CardStatField;
    if (!allowed.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out.length ? out : [...DEFAULT_VISIBLE_FIELDS];
}

export function normalizeFieldSettings(
  raw: Partial<FieldSettings> | null | undefined
): FieldSettings {
  const base = { ...DEFAULT_FIELD_SETTINGS };
  if (!raw || typeof raw !== "object") return { ...base, visibleFields: [...base.visibleFields] };
  const rows = Number(raw.dataRows);
  const cols = Number(raw.fieldsPerRow);
  const heightUnit: HeightUnit =
    raw.heightUnit === "ftin" ? "ftin" : "cm";
  const currency: CurrencyCode =
    raw.currency === "GBP" || raw.currency === "USD" || raw.currency === "EUR"
      ? raw.currency
      : "EUR";
  return {
    markerSizePct: clampPct(Number(raw.markerSizePct ?? base.markerSizePct)),
    nameSizePct: clampPct(Number(raw.nameSizePct ?? base.nameSizePct)),
    dataRows: rows === 1 ? 1 : 2,
    fieldsPerRow: cols === 3 || cols === 5 ? (cols as 3 | 5) : 4,
    userAdjusted: Boolean(raw.userAdjusted),
    visibleFields: normalizeVisibleFields(raw.visibleFields),
    heightUnit,
    currency,
  };
}

export function loadFieldSettings(): FieldSettings {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_FIELD_SETTINGS,
      visibleFields: [...DEFAULT_VISIBLE_FIELDS],
    };
  }
  try {
    const rawV3 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY);
    if (rawV3) {
      return normalizeFieldSettings(JSON.parse(rawV3) as Partial<FieldSettings>);
    }

    // Migrate v2 → v3 (keep size/rows; add new defaults)
    const rawV2 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY_V2);
    if (rawV2) {
      const migrated = normalizeFieldSettings(
        JSON.parse(rawV2) as Partial<FieldSettings>
      );
      window.localStorage.setItem(
        FIELD_SETTINGS_STORAGE_KEY,
        JSON.stringify(migrated)
      );
      return migrated;
    }

    const hadV1 =
      window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY_V1) != null;
    if (hadV1) {
      try {
        window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V1);
      } catch {
        /* ignore */
      }
    }
    const fresh = {
      ...DEFAULT_FIELD_SETTINGS,
      visibleFields: [...DEFAULT_VISIBLE_FIELDS],
    };
    window.localStorage.setItem(
      FIELD_SETTINGS_STORAGE_KEY,
      JSON.stringify(fresh)
    );
    return fresh;
  } catch {
    return {
      ...DEFAULT_FIELD_SETTINGS,
      visibleFields: [...DEFAULT_VISIBLE_FIELDS],
    };
  }
}

export function saveFieldSettings(settings: FieldSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      FIELD_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeFieldSettings(settings))
    );
    try {
      window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V2);
      window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V1);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota / private mode */
  }
}

export function effectiveMarkerPct(
  settings: FieldSettings,
  isFullscreen: boolean
): number {
  if (settings.userAdjusted) return settings.markerSizePct;
  if (isFullscreen) {
    return Math.min(FULLSCREEN_DEFAULT_MARKER_PCT, settings.markerSizePct);
  }
  return settings.markerSizePct;
}

export function formatPctLabel(n: number): string {
  if (n > 0) return `+${n}%`;
  if (n < 0) return `${n}%`;
  return "0%";
}

export function scaleFactor(pct: number): number {
  return 1 + clampPct(pct) / 100;
}

/** Build ordered stat cells from visibility + row/col budget. */
export function pickVisibleFields(
  settings: FieldSettings,
  kind: "outfield" | "gk"
): CardStatField[] {
  const meta = new Map(ALL_CARD_FIELDS.map((f) => [f.id, f]));
  const budget = settings.dataRows * settings.fieldsPerRow;
  const out: CardStatField[] = [];
  for (const id of settings.visibleFields) {
    const m = meta.get(id);
    if (!m) continue;
    if (kind === "gk" && !m.gk) continue;
    if (kind === "outfield" && !m.outfield) continue;
    out.push(id);
    if (out.length >= budget) break;
  }
  return out;
}
