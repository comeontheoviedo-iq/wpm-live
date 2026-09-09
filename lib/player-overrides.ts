export type PlayerOverrideRow = {
  playerId: string;
  displayName?: string | null;
  pronunciation?: string | null;
  pitchFlag?: string | null;
  jerseyNumber?: number | null;
  /** Manual slot — survives AF sync until Reset official */
  formationSlot?: string | null;
  /** Free-move landscape % (0–100) */
  pitchX?: number | null;
  pitchY?: number | null;
};

export function hasManualPlacement(o?: PlayerOverrideRow | null): boolean {
  if (!o) return false;
  return (
    Boolean(o.formationSlot) ||
    (o.pitchX != null && Number.isFinite(o.pitchX)) ||
    (o.pitchY != null && Number.isFinite(o.pitchY))
  );
}

export function clampPitchCoord(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  // 0.01% precision — tiny commentary nudges must stick first try (was 0.1).
  return Math.max(0, Math.min(100, Math.round(v * 100) / 100));
}
