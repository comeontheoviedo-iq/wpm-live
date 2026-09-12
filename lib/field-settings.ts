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

/** Slim coach chip chrome — never re-bloates corner layout. */
export type CoachCardSettings = {
  showPhoto: boolean;
  showFlag: boolean;
  /** Inline age next to name (still one-line slim chip). */
  showAge: boolean;
  nameSizePct: number;
};

export type RefereeCardSettings = {
  showFlag: boolean;
  /** Show "Ref ·" prefix before the name. */
  showPrefix: boolean;
  nameSizePct: number;
};

export type FieldSettings = {
  /** Marker size percent offset: -40 … +40 */
  markerSizePct: number;
  /** Name text size percent offset: -40 … +40 (player + keeper cards) */
  nameSizePct: number;
  /** Stat rows under the name */
  dataRows: 1 | 2;
  /** Stat cells per row */
  fieldsPerRow: 3 | 4 | 5;
  /** True once user moves any slider (stops auto fullscreen bump) */
  userAdjusted: boolean;
  /** Outfield (Player tab) stats — order = priority */
  visibleFields: CardStatField[];
  /** Keeper tab stats — independent of outfield list */
  keeperVisibleFields: CardStatField[];
  heightUnit: HeightUnit;
  currency: CurrencyCode;
  coach: CoachCardSettings;
  referee: RefereeCardSettings;
};

/** Bumped to v4 for keeper/coach/referee card chrome. */
export const FIELD_SETTINGS_STORAGE_KEY = "pitchline.fieldSettings.v4";
const FIELD_SETTINGS_STORAGE_KEY_V3 = "pitchline.fieldSettings.v3";
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

export const DEFAULT_KEEPER_VISIBLE_FIELDS: CardStatField[] = [
  "APP",
  "SV",
  "CS",
  "M_APP",
  "M_MIN",
  "RTG",
  "AGE",
  "HGT",
];

export const DEFAULT_COACH_CARD: CoachCardSettings = {
  showPhoto: true,
  showFlag: true,
  showAge: false,
  nameSizePct: 0,
};

export const DEFAULT_REFEREE_CARD: RefereeCardSettings = {
  showFlag: true,
  showPrefix: true,
  nameSizePct: 0,
};

export const DEFAULT_FIELD_SETTINGS: FieldSettings = {
  markerSizePct: -18,
  nameSizePct: 0,
  dataRows: 2,
  fieldsPerRow: 4,
  userAdjusted: false,
  visibleFields: [...DEFAULT_VISIBLE_FIELDS],
  keeperVisibleFields: [...DEFAULT_KEEPER_VISIBLE_FIELDS],
  heightUnit: "cm",
  currency: "EUR",
  coach: { ...DEFAULT_COACH_CARD },
  referee: { ...DEFAULT_REFEREE_CARD },
};

/**
 * Fullscreen desired marker % when user never adjusted Field Settings.
 * Bumps tokens up for aging-eyes readability (windowed default is −18).
 */
export const FULLSCREEN_DEFAULT_MARKER_PCT = 32;

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

function normalizeVisibleFields(
  raw: unknown,
  fallback: CardStatField[]
): CardStatField[] {
  const allowed = new Set(ALL_CARD_FIELDS.map((f) => f.id));
  if (!Array.isArray(raw)) return [...fallback];
  const out: CardStatField[] = [];
  for (const x of raw) {
    const id = String(x) as CardStatField;
    if (!allowed.has(id)) continue;
    if (out.includes(id)) continue;
    out.push(id);
  }
  return out.length ? out : [...fallback];
}

function deriveKeeperFieldsFromLegacy(
  visible: CardStatField[]
): CardStatField[] {
  const gkMeta = new Set(
    ALL_CARD_FIELDS.filter((f) => f.gk).map((f) => f.id)
  );
  const fromPlayer = visible.filter((id) => gkMeta.has(id));
  // Prefer defaults when legacy list had almost no GK-capable fields
  if (fromPlayer.length < 2) return [...DEFAULT_KEEPER_VISIBLE_FIELDS];
  // Ensure SV/CS stay available near the front if user never had them
  const out = [...fromPlayer];
  for (const id of ["SV", "CS"] as CardStatField[]) {
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

function normalizeCoach(
  raw: Partial<CoachCardSettings> | null | undefined
): CoachCardSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_COACH_CARD };
  return {
    showPhoto: raw.showPhoto !== false,
    showFlag: raw.showFlag !== false,
    showAge: Boolean(raw.showAge),
    nameSizePct: clampPct(Number(raw.nameSizePct ?? 0)),
  };
}

function normalizeReferee(
  raw: Partial<RefereeCardSettings> | null | undefined
): RefereeCardSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REFEREE_CARD };
  return {
    showFlag: raw.showFlag !== false,
    showPrefix: raw.showPrefix !== false,
    nameSizePct: clampPct(Number(raw.nameSizePct ?? 0)),
  };
}

export function normalizeFieldSettings(
  raw: Partial<FieldSettings> | null | undefined
): FieldSettings {
  const base = { ...DEFAULT_FIELD_SETTINGS };
  if (!raw || typeof raw !== "object") {
    return {
      ...base,
      visibleFields: [...base.visibleFields],
      keeperVisibleFields: [...base.keeperVisibleFields],
      coach: { ...base.coach },
      referee: { ...base.referee },
    };
  }
  const rows = Number(raw.dataRows);
  const cols = Number(raw.fieldsPerRow);
  const heightUnit: HeightUnit =
    raw.heightUnit === "ftin" ? "ftin" : "cm";
  const currency: CurrencyCode =
    raw.currency === "GBP" || raw.currency === "USD" || raw.currency === "EUR"
      ? raw.currency
      : "EUR";
  const visibleFields = normalizeVisibleFields(
    raw.visibleFields,
    DEFAULT_VISIBLE_FIELDS
  );
  const keeperVisibleFields =
    raw.keeperVisibleFields != null
      ? normalizeVisibleFields(
          raw.keeperVisibleFields,
          DEFAULT_KEEPER_VISIBLE_FIELDS
        )
      : deriveKeeperFieldsFromLegacy(visibleFields);
  return {
    markerSizePct: clampPct(Number(raw.markerSizePct ?? base.markerSizePct)),
    nameSizePct: clampPct(Number(raw.nameSizePct ?? base.nameSizePct)),
    dataRows: rows === 1 ? 1 : 2,
    fieldsPerRow: cols === 3 || cols === 5 ? (cols as 3 | 5) : 4,
    userAdjusted: Boolean(raw.userAdjusted),
    visibleFields,
    keeperVisibleFields,
    heightUnit,
    currency,
    coach: normalizeCoach(raw.coach),
    referee: normalizeReferee(raw.referee),
  };
}

function persistFresh(settings: FieldSettings): FieldSettings {
  if (typeof window === "undefined") return settings;
  try {
    window.localStorage.setItem(
      FIELD_SETTINGS_STORAGE_KEY,
      JSON.stringify(settings)
    );
  } catch {
    /* ignore */
  }
  return settings;
}

export function loadFieldSettings(): FieldSettings {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_FIELD_SETTINGS,
      visibleFields: [...DEFAULT_VISIBLE_FIELDS],
      keeperVisibleFields: [...DEFAULT_KEEPER_VISIBLE_FIELDS],
      coach: { ...DEFAULT_COACH_CARD },
      referee: { ...DEFAULT_REFEREE_CARD },
    };
  }
  try {
    const rawV4 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY);
    if (rawV4) {
      return normalizeFieldSettings(JSON.parse(rawV4) as Partial<FieldSettings>);
    }

    // Migrate v3 → v4 (keep player prefs; add keeper/coach/ref defaults)
    const rawV3 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY_V3);
    if (rawV3) {
      const migrated = normalizeFieldSettings(
        JSON.parse(rawV3) as Partial<FieldSettings>
      );
      return persistFresh(migrated);
    }

    // Migrate v2 → v4
    const rawV2 = window.localStorage.getItem(FIELD_SETTINGS_STORAGE_KEY_V2);
    if (rawV2) {
      const migrated = normalizeFieldSettings(
        JSON.parse(rawV2) as Partial<FieldSettings>
      );
      return persistFresh(migrated);
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
      keeperVisibleFields: [...DEFAULT_KEEPER_VISIBLE_FIELDS],
      coach: { ...DEFAULT_COACH_CARD },
      referee: { ...DEFAULT_REFEREE_CARD },
    };
    return persistFresh(fresh);
  } catch {
    return {
      ...DEFAULT_FIELD_SETTINGS,
      visibleFields: [...DEFAULT_VISIBLE_FIELDS],
      keeperVisibleFields: [...DEFAULT_KEEPER_VISIBLE_FIELDS],
      coach: { ...DEFAULT_COACH_CARD },
      referee: { ...DEFAULT_REFEREE_CARD },
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
      window.localStorage.removeItem(FIELD_SETTINGS_STORAGE_KEY_V3);
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
    // Grow cards in Full — Math.max so we never stay stuck at the tiny windowed %.
    return Math.max(FULLSCREEN_DEFAULT_MARKER_PCT, settings.markerSizePct);
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
  const source =
    kind === "gk" ? settings.keeperVisibleFields : settings.visibleFields;
  const out: CardStatField[] = [];
  for (const id of source) {
    const m = meta.get(id);
    if (!m) continue;
    if (kind === "gk" && !m.gk) continue;
    if (kind === "outfield" && !m.outfield) continue;
    out.push(id);
    if (out.length >= budget) break;
  }
  return out;
}
