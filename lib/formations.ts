/** Percentage positions on a vertical half-pitch (x: 0-100 left-right, y: 0-100 own-goal to halfway) */
export type Slot = { id: string; x: number; y: number; label: string };

export const FORMATIONS: Record<string, Slot[]> = {
  "4-3-3": [
    { id: "GK", x: 50, y: 92, label: "GK" },
    { id: "RB", x: 82, y: 72, label: "RB" },
    { id: "RCB", x: 62, y: 75, label: "CB" },
    { id: "LCB", x: 38, y: 75, label: "CB" },
    { id: "LB", x: 18, y: 72, label: "LB" },
    { id: "RCM", x: 68, y: 50, label: "CM" },
    { id: "CM", x: 50, y: 55, label: "CM" },
    { id: "LCM", x: 32, y: 50, label: "CM" },
    { id: "RW", x: 80, y: 28, label: "RW" },
    { id: "ST", x: 50, y: 22, label: "ST" },
    { id: "LW", x: 20, y: 28, label: "LW" },
  ],
  "4-2-3-1": [
    { id: "GK", x: 50, y: 92, label: "GK" },
    { id: "RB", x: 82, y: 72, label: "RB" },
    { id: "RCB", x: 62, y: 75, label: "CB" },
    { id: "LCB", x: 38, y: 75, label: "CB" },
    { id: "LB", x: 18, y: 72, label: "LB" },
    { id: "RDM", x: 62, y: 55, label: "CDM" },
    { id: "LDM", x: 38, y: 55, label: "CDM" },
    { id: "RAM", x: 78, y: 35, label: "RM" },
    { id: "CAM", x: 50, y: 38, label: "CAM" },
    { id: "LAM", x: 22, y: 35, label: "LM" },
    { id: "ST", x: 50, y: 18, label: "ST" },
  ],
  "4-4-2": [
    { id: "GK", x: 50, y: 92, label: "GK" },
    { id: "RB", x: 82, y: 72, label: "RB" },
    { id: "RCB", x: 62, y: 75, label: "CB" },
    { id: "LCB", x: 38, y: 75, label: "CB" },
    { id: "LB", x: 18, y: 72, label: "LB" },
    { id: "RM", x: 82, y: 48, label: "RM" },
    { id: "RCM", x: 60, y: 52, label: "CM" },
    { id: "LCM", x: 40, y: 52, label: "CM" },
    { id: "LM", x: 18, y: 48, label: "LM" },
    { id: "RST", x: 60, y: 22, label: "ST" },
    { id: "LST", x: 40, y: 22, label: "ST" },
  ],
  "3-5-2": [
    { id: "GK", x: 50, y: 92, label: "GK" },
    { id: "RCB", x: 70, y: 75, label: "CB" },
    { id: "CB", x: 50, y: 78, label: "CB" },
    { id: "LCB", x: 30, y: 75, label: "CB" },
    { id: "RWB", x: 88, y: 50, label: "RWB" },
    { id: "RCM", x: 62, y: 52, label: "CM" },
    { id: "CM", x: 50, y: 58, label: "CDM" },
    { id: "LCM", x: 38, y: 52, label: "CM" },
    { id: "LWB", x: 12, y: 50, label: "LWB" },
    { id: "RST", x: 60, y: 22, label: "ST" },
    { id: "LST", x: 40, y: 22, label: "ST" },
  ],
};

export function slotsFor(formation: string): Slot[] {
  return FORMATIONS[formation] || FORMATIONS["4-3-3"];
}
