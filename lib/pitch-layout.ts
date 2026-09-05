/** Pixel collision resolution for SportsCom-style pitch cards. */

import { type FieldSettings, scaleFactor, clampPct } from "./field-settings";

export type PlacedSlot<TSlot = { id: string; label: string }> = {
  slot: TSlot;
  player: unknown;
  x: number; // % left
  y: number; // % top
  side: "home" | "away";
};

/** Approximate rendered card size (matches SportsComToken baseW + scaled transform). */
export function estimateCardSizePx(
  markerPct: number,
  settings: FieldSettings
): { w: number; h: number } {
  const scale = scaleFactor(markerPct);
  const baseW = 76;
  // header + photo/name + 1–2 cream stat rows (slightly tight vs CSS to leave room)
  const baseH = settings.dataRows === 2 ? 125 : 100;
  return { w: baseW * scale, h: baseH * scale };
}

/**
 * Geometric upper bound so 11+11 cards can physically fit the pitch box.
 * Desk middle column is often ~700–1000px even on a 1440 viewport.
 * Conservative: tall/narrow compact desks previously over-estimated via height.
 */
export function geometricMaxMarkerPct(
  containerW: number,
  containerH: number,
  settings: FieldSettings
): number {
  if (!containerW || !containerH) return 0;
  const baseW = 76;
  const baseH = settings.dataRows === 2 ? 125 : 100;
  const usableH = Math.max(120, containerH - 48);
  const halfW = Math.max(100, containerW * 0.45);
  // Worst case: 5 lateral + gaps; 4 depth bands per half with breathing room
  const maxScaleH = usableH / (5.4 * baseH + 5 * 6);
  const maxScaleW = halfW / (4.15 * baseW);
  const maxScale = Math.max(0.55, Math.min(maxScaleH, maxScaleW, 1.4));
  return clampPct(Math.round((maxScale - 1) * 100));
}

export function countAabbOverlaps<T extends PlacedSlot>(
  placed: T[],
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  gapPx = 0.5
): number {
  if (!containerW || !containerH || placed.length < 2) return 0;
  const minDx = cardW + gapPx;
  const minDy = cardH + gapPx;
  let overlaps = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const ax = (placed[i].x / 100) * containerW;
      const ay = (placed[i].y / 100) * containerH;
      const bx = (placed[j].x / 100) * containerW;
      const by = (placed[j].y / 100) * containerH;
      if (Math.abs(ax - bx) < minDx && Math.abs(ay - by) < minDy) overlaps++;
    }
  }
  return overlaps;
}

/**
 * Cap marker % so 11+11 SportsCom cards fit with zero AABB overlaps after
 * collision resolve. Uses geometric bound as ceiling, then binary-searches
 * against real placements when provided.
 */
export function fitMarkerPctForContainer(
  containerW: number,
  containerH: number,
  desiredPct: number,
  settings: FieldSettings,
  rawPlaced?: PlacedSlot[]
): number {
  if (!containerW || !containerH) return desiredPct;
  const geoMax = geometricMaxMarkerPct(containerW, containerH, settings);
  const ceiling = Math.min(clampPct(desiredPct), geoMax);

  if (!rawPlaced || rawPlaced.length < 2) {
    return ceiling;
  }

  const fits = (pct: number) => {
    const { w, h } = estimateCardSizePx(pct, settings);
    const resolved = resolveCardOverlaps(
      rawPlaced,
      containerW,
      containerH,
      w,
      h,
      4
    );
    return countAabbOverlaps(resolved, containerW, containerH, w, h, 0.5) === 0;
  };

  if (fits(ceiling)) return ceiling;

  let lo = -40;
  let hi = ceiling;
  let best = -40;
  // Binary search max integer pct that fits
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fits(mid)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return clampPct(best);
}

/**
 * Iterative AABB separation in screen space.
 * Prefer lateral (y%) spread within a team half; nudge depth (x%) when needed.
 * Preserves relative attack depth as much as possible.
 */
export function resolveCardOverlaps<T extends PlacedSlot>(
  placed: T[],
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  gapPx = 4
): T[] {
  if (!containerW || !containerH || placed.length < 2) return placed;

  type Item = T & { px: number; py: number; ox: number; oy: number };
  const items: Item[] = placed.map((p) => {
    const px = (p.x / 100) * containerW;
    const py = (p.y / 100) * containerH;
    return { ...p, px, py, ox: px, oy: py };
  });

  const minDx = cardW + gapPx;
  const minDy = cardH + gapPx;
  const halfW = cardW / 2;
  const halfH = cardH / 2;
  const midX = containerW / 2;
  // Keep card bodies on their own half — previous +0.15*cardW bleed let
  // centers cross midfield and home/away cards collide at large scales.
  const halfGuard = Math.min(halfW * 0.25, 18);

  const clampItem = (it: Item, padBottom: number) => {
    if (it.side === "home") {
      it.px = Math.min(it.px, midX - halfGuard);
    } else {
      it.px = Math.max(it.px, midX + halfGuard);
    }
    it.px = Math.max(halfW + 2, Math.min(containerW - halfW - 2, it.px));
    it.py = Math.max(halfH + 6, Math.min(containerH - halfH - padBottom, it.py));
  };

  for (let iter = 0; iter < 100; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx >= minDx || absDy >= minDy) continue;

        const overlapX = minDx - absDx;
        const overlapY = minDy - absDy;
        const sameSide = a.side === b.side;

        const latWeight = sameSide ? 1 : 0.95;
        const depthWeight = sameSide ? 1 : 0.85;

        if (overlapY > 0) {
          const push = (overlapY / 2 + 0.5) * latWeight;
          const sign =
            dy === 0 ? (a.oy <= b.oy ? -1 : 1) : dy > 0 ? 1 : -1;
          a.py -= push * sign;
          b.py += push * sign;
        }
        if (overlapX > 0) {
          let push = (overlapX / 2 + 0.5) * depthWeight;
          const aDeeper =
            a.side === "home" ? a.ox <= b.ox : a.ox >= b.ox;
          const depthSignHome = aDeeper ? -1 : 1;
          const sign =
            a.side === "home" && b.side === "home"
              ? depthSignHome
              : a.side === "away" && b.side === "away"
                ? -depthSignHome
                : dx === 0
                  ? a.side === "home"
                    ? -1
                    : 1
                  : dx > 0
                    ? 1
                    : -1;
          if (overlapX > cardW * 0.25) push *= 1.25;
          a.px -= push * sign;
          b.px += push * sign;
        }
        moved = true;
      }
    }

    for (const it of items) clampItem(it, 22);

    if (!moved) break;
  }

  // Final pass: if still overlapping, force lateral-only split
  for (let pass = 0; pass < 30; pass++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        if (Math.abs(dx) >= minDx || Math.abs(dy) >= minDy) continue;
        const overlapY = minDy - Math.abs(dy);
        const overlapX = minDx - Math.abs(dx);
        const pushY = overlapY / 2 + 1;
        const signY = dy === 0 ? (i % 2 === 0 ? -1 : 1) : dy > 0 ? 1 : -1;
        a.py -= pushY * signY;
        b.py += pushY * signY;
        const pushX = overlapX / 2 + 1;
        const signX = dx === 0 ? (a.side === "home" ? -1 : 1) : dx > 0 ? 1 : -1;
        a.px -= pushX * signX;
        b.px += pushX * signX;
        moved = true;
      }
    }
    for (const it of items) clampItem(it, 18);
    if (!moved) break;
  }

  return items.map((it) => {
    const { px, py, ox: _ox, oy: _oy, ...rest } = it;
    return {
      ...(rest as unknown as T),
      x: (px / containerW) * 100,
      y: (py / containerH) * 100,
    };
  });
}
