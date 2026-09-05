/** Percentage positions on a vertical half-pitch (x: 0-100 left-right, y: 0-100 own-goal to halfway) */
export type Slot = { id: string; x: number; y: number; label: string };

/**
 * Slot spacing is intentionally wider than classic chalkboards so pitch cards (76px+ at +40% scale) have room before collision resolution runs.
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
};

export function slotsFor(formation: string): Slot[] {
  return FORMATIONS[formation] || FORMATIONS["4-3-3"];
}

export function formationKeys(): string[] {
  return Object.keys(FORMATIONS);
}
