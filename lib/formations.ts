/** Percentage positions on a vertical half-pitch (x: 0-100 left-right, y: 0-100 own-goal to halfway) */
export type Slot = { id: string; x: number; y: number; label: string };

/**
 * Slot spacing is intentionally wider than classic chalkboards so pitch cards
 * (76px+ at +40% scale) have room before collision resolution runs.
 */
export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RCM", x: 74, y: 48, label: "CM" },
    { id: "CM", x: 50, y: 56, label: "CM" },
    { id: "LCM", x: 26, y: 48, label: "CM" },
    { id: "RW", x: 86, y: 24, label: "RW" },
    { id: "ST", x: 50, y: 14, label: "ST" },
    { id: "LW", x: 14, y: 24, label: "LW" },
  ],
  "4-2-3-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RDM", x: 66, y: 52, label: "CDM" },
    { id: "LDM", x: 34, y: 52, label: "CDM" },
    { id: "RAM", x: 86, y: 32, label: "RM" },
    { id: "CAM", x: 50, y: 34, label: "CAM" },
    { id: "LAM", x: 14, y: 32, label: "LM" },
    { id: "ST", x: 50, y: 12, label: "ST" },
  ],
  "4-1-4-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "CDM", x: 50, y: 58, label: "CDM" },
    { id: "RM", x: 90, y: 40, label: "RM" },
    { id: "RCM", x: 66, y: 44, label: "CM" },
    { id: "LCM", x: 34, y: 44, label: "CM" },
    { id: "LM", x: 10, y: 40, label: "LM" },
    { id: "ST", x: 50, y: 14, label: "ST" },
  ],
  "4-4-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RM", x: 90, y: 46, label: "RM" },
    { id: "RCM", x: 64, y: 52, label: "CM" },
    { id: "LCM", x: 36, y: 52, label: "CM" },
    { id: "LM", x: 10, y: 46, label: "LM" },
    { id: "RST", x: 64, y: 16, label: "ST" },
    { id: "LST", x: 36, y: 16, label: "ST" },
  ],
  "4-4-2 diamond": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "CDM", x: 50, y: 60, label: "CDM" },
    { id: "RCM", x: 74, y: 46, label: "CM" },
    { id: "LCM", x: 26, y: 46, label: "CM" },
    { id: "CAM", x: 50, y: 32, label: "CAM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "4-2-2-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RDM", x: 66, y: 52, label: "CDM" },
    { id: "LDM", x: 34, y: 52, label: "CDM" },
    { id: "RAM", x: 78, y: 32, label: "CAM" },
    { id: "LAM", x: 22, y: 32, label: "CAM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "4-1-2-1-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "CDM", x: 50, y: 60, label: "CDM" },
    { id: "RCM", x: 72, y: 46, label: "CM" },
    { id: "LCM", x: 28, y: 46, label: "CM" },
    { id: "CAM", x: 50, y: 32, label: "CAM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "4-3-1-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RCM", x: 74, y: 52, label: "CM" },
    { id: "CM", x: 50, y: 58, label: "CM" },
    { id: "LCM", x: 26, y: 52, label: "CM" },
    { id: "CAM", x: 50, y: 32, label: "CAM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "4-3-2-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RCM", x: 74, y: 52, label: "CM" },
    { id: "CM", x: 50, y: 58, label: "CM" },
    { id: "LCM", x: 26, y: 52, label: "CM" },
    { id: "RAM", x: 66, y: 30, label: "AM" },
    { id: "LAM", x: 34, y: 30, label: "AM" },
    { id: "ST", x: 50, y: 12, label: "ST" },
  ],
  "4-5-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RM", x: 90, y: 44, label: "RM" },
    { id: "RCM", x: 66, y: 50, label: "CM" },
    { id: "CM", x: 50, y: 54, label: "CM" },
    { id: "LCM", x: 34, y: 50, label: "CM" },
    { id: "LM", x: 10, y: 44, label: "LM" },
    { id: "ST", x: 50, y: 14, label: "ST" },
  ],
  "4-2-4": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RB", x: 90, y: 74, label: "RB" },
    { id: "RCB", x: 68, y: 82, label: "CB" },
    { id: "LCB", x: 32, y: 82, label: "CB" },
    { id: "LB", x: 10, y: 74, label: "LB" },
    { id: "RDM", x: 66, y: 52, label: "CDM" },
    { id: "LDM", x: 34, y: 52, label: "CDM" },
    { id: "RW", x: 88, y: 24, label: "RW" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
    { id: "LW", x: 12, y: 24, label: "LW" },
  ],
  "3-5-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RCB", x: 76, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 24, y: 80, label: "CB" },
    { id: "RWB", x: 92, y: 46, label: "RWB" },
    { id: "RCM", x: 66, y: 48, label: "CM" },
    { id: "CM", x: 50, y: 56, label: "CDM" },
    { id: "LCM", x: 34, y: 48, label: "CM" },
    { id: "LWB", x: 8, y: 46, label: "LWB" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "3-4-3": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RCB", x: 76, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 24, y: 80, label: "CB" },
    { id: "RWB", x: 92, y: 50, label: "RWB" },
    { id: "RCM", x: 64, y: 52, label: "CM" },
    { id: "LCM", x: 36, y: 52, label: "CM" },
    { id: "LWB", x: 8, y: 50, label: "LWB" },
    { id: "RW", x: 84, y: 22, label: "RW" },
    { id: "ST", x: 50, y: 12, label: "ST" },
    { id: "LW", x: 16, y: 22, label: "LW" },
  ],
  "3-4-2-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RCB", x: 76, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 24, y: 80, label: "CB" },
    { id: "RWB", x: 92, y: 50, label: "RWB" },
    { id: "RCM", x: 64, y: 54, label: "CM" },
    { id: "LCM", x: 36, y: 54, label: "CM" },
    { id: "LWB", x: 8, y: 50, label: "LWB" },
    { id: "RAM", x: 66, y: 30, label: "AM" },
    { id: "LAM", x: 34, y: 30, label: "AM" },
    { id: "ST", x: 50, y: 12, label: "ST" },
  ],
  "3-4-1-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RCB", x: 76, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 24, y: 80, label: "CB" },
    { id: "RWB", x: 92, y: 50, label: "RWB" },
    { id: "RCM", x: 64, y: 54, label: "CM" },
    { id: "LCM", x: 36, y: 54, label: "CM" },
    { id: "LWB", x: 8, y: 50, label: "LWB" },
    { id: "CAM", x: 50, y: 32, label: "CAM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "5-3-2": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RWB", x: 92, y: 68, label: "RWB" },
    { id: "RCB", x: 72, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 28, y: 80, label: "CB" },
    { id: "LWB", x: 8, y: 68, label: "LWB" },
    { id: "RCM", x: 72, y: 46, label: "CM" },
    { id: "CM", x: 50, y: 52, label: "CM" },
    { id: "LCM", x: 28, y: 46, label: "CM" },
    { id: "RST", x: 64, y: 14, label: "ST" },
    { id: "LST", x: 36, y: 14, label: "ST" },
  ],
  "5-4-1": [
    { id: "GK", x: 50, y: 96, label: "GK" },
    { id: "RWB", x: 92, y: 68, label: "RWB" },
    { id: "RCB", x: 72, y: 80, label: "CB" },
    { id: "CB", x: 50, y: 84, label: "CB" },
    { id: "LCB", x: 28, y: 80, label: "CB" },
    { id: "LWB", x: 8, y: 68, label: "LWB" },
    { id: "RM", x: 84, y: 44, label: "RM" },
    { id: "RCM", x: 62, y: 50, label: "CM" },
    { id: "LCM", x: 38, y: 50, label: "CM" },
    { id: "LM", x: 16, y: 44, label: "LM" },
    { id: "ST", x: 50, y: 14, label: "ST" },
  ],
};

/** AF sometimes sends spacing variants / unknown shapes — map onto our keys. */
const FORMATION_ALIASES: Record<string, string> = {
  "4-3-1-2": "4-3-1-2",
  "4-1-3-2": "4-3-1-2",
  "4-4-2-diamond": "4-4-2 diamond",
  "4-4-2diamond": "4-4-2 diamond",
  "442 diamond": "4-4-2 diamond",
};

export function normalizeFormation(
  formation?: string | null,
  fallback = "4-3-3"
): string {
  const raw = String(formation || "").trim();
  if (!raw) return fallback;
  if (FORMATIONS[raw]) return raw;
  const compact = raw.replace(/\s+/g, " ");
  if (FORMATIONS[compact]) return compact;
  const aliased = FORMATION_ALIASES[raw] || FORMATION_ALIASES[compact.toLowerCase()];
  if (aliased && FORMATIONS[aliased]) return aliased;
  // Digits-only shapes like "433" → "4-3-3"
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length >= 3) {
    const dashed = digits.split("").join("-");
    if (FORMATIONS[dashed]) return dashed;
  }
  return FORMATIONS[raw] ? raw : fallback;
}

export function slotsFor(formation?: string | null): Slot[] {
  const key = normalizeFormation(formation, "4-3-3");
  return FORMATIONS[key] || FORMATIONS["4-3-3"];
}

/** Guarantee every assigned id exists on the formation (never S1/S2 fallbacks). */
export function coerceValidSlotIds(
  slotIds: string[],
  formation?: string | null
): string[] {
  const valid = slotsFor(formation);
  const used = new Set<string>();
  return slotIds.map((raw, i) => {
    const id = String(raw || "").trim();
    if (id && valid.some((s) => s.id === id) && !used.has(id)) {
      used.add(id);
      return id;
    }
    const next = valid.find((s) => !used.has(s.id)) || valid[i % valid.length];
    used.add(next.id);
    return next.id;
  });
}

export function formationKeys(): string[] {
  return Object.keys(FORMATIONS);
}
