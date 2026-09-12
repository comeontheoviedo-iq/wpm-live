/** Desk chrome density preset — fixed layout, spacing only (not widget rearrange). */

export type DeskDensity = "compact" | "comfortable";

export const DESK_DENSITY_STORAGE_KEY = "cocomms.deskDensity.v1";

export const DEFAULT_DESK_DENSITY: DeskDensity = "compact";

export function normalizeDeskDensity(raw: unknown): DeskDensity {
  return raw === "comfortable" ? "comfortable" : "compact";
}

export function loadDeskDensity(): DeskDensity {
  if (typeof window === "undefined") return DEFAULT_DESK_DENSITY;
  try {
    return normalizeDeskDensity(
      window.localStorage.getItem(DESK_DENSITY_STORAGE_KEY)
    );
  } catch {
    return DEFAULT_DESK_DENSITY;
  }
}

export function saveDeskDensity(density: DeskDensity): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DESK_DENSITY_STORAGE_KEY,
      normalizeDeskDensity(density)
    );
  } catch {
    /* quota / private mode */
  }
}

export function toggleDeskDensity(current: DeskDensity): DeskDensity {
  return current === "compact" ? "comfortable" : "compact";
}
