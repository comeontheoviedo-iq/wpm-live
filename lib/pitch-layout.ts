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
 * Iterative AABB separation in screen space.
 * Prefer lateral (y%) spread within a team half; nudge depth (x%) when needed.
 * Preserves relative attack depth as much as possible.
 */

/**
 * Cap marker % so 11+11 SportsCom cards can physically fit the pitch box.
 * Desk middle column is often ~700–1000px even on a 1440 viewport.
 */
export function fitMarkerPctForContainer(
  containerW: number,
  containerH: number,
  desiredPct: number,
  settings: FieldSettings
): number {
  if (!containerW || !containerH) return desiredPct;
  const baseW = 76;
  const baseH = settings.dataRows === 2 ? 125 : 100;
  const usableH = Math.max(120, containerH - 36);
  const halfW = Math.max(120, containerW * 0.46);
  // Worst case bands: ~5 cards along the short (lateral) axis; ~4 depth bands per half
  const maxScaleH = usableH / (5.15 * baseH + 4 * 4);
  const maxScaleW = halfW / (3.8 * baseW);
  const maxScale = Math.max(0.6, Math.min(maxScaleH, maxScaleW, 1.4));
  const desired = scaleFactor(desiredPct);
  const fitted = Math.min(desired, maxScale);
  return clampPct(Math.round((fitted - 1) * 100));
}

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

  for (let iter = 0; iter < 80; iter++) {
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

        // Always separate on both axes proportional to overlap — prevents
        // GK/CB depth collisions when lateral room is already taken by full-backs.
        const latWeight = sameSide ? 1 : 0.85;
        const depthWeight = sameSide ? 1 : 0.7;

        if (overlapY > 0) {
          const push = (overlapY / 2 + 0.5) * latWeight;
          const sign =
            dy === 0 ? (a.oy <= b.oy ? -1 : 1) : dy > 0 ? 1 : -1;
          a.py -= push * sign;
          b.py += push * sign;
        }
        if (overlapX > 0) {
          let push = (overlapX / 2 + 0.5) * depthWeight;
          // Bias: keep deeper player (closer to own goal) deeper
          const aDeeper =
            a.side === "home" ? a.ox <= b.ox : a.ox >= b.ox;
          const depthSignHome = aDeeper ? -1 : 1; // home: deeper = smaller x
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
          // Extra push on large depth overlaps (defense cluster)
          if (overlapX > cardW * 0.25) push *= 1.25;
          a.px -= push * sign;
          b.px += push * sign;
        }
        moved = true;
      }
    }

    for (const it of items) {
      // Soft keep-in-half — allow slight midfield bleed at large scales
      if (it.side === "home") {
        it.px = Math.min(it.px, midX + cardW * 0.15);
      } else {
        it.px = Math.max(it.px, midX - cardW * 0.15);
      }
      it.px = Math.max(halfW + 2, Math.min(containerW - halfW - 2, it.px));
      it.py = Math.max(halfH + 6, Math.min(containerH - halfH - 22, it.py));
    }

    if (!moved) break;
  }

  // Final pass: if still overlapping, force lateral-only split
  for (let pass = 0; pass < 20; pass++) {
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
    for (const it of items) {
      it.px = Math.max(halfW + 2, Math.min(containerW - halfW - 2, it.px));
      it.py = Math.max(halfH + 4, Math.min(containerH - halfH - 18, it.py));
    }
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
