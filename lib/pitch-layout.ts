/** Pixel collision resolution for SportsCom-style pitch cards. */

import { type FieldSettings, scaleFactor, clampPct } from "./field-settings";

export type PlacedSlot<TSlot = { id: string; label: string }> = {
  slot: TSlot;
  player: unknown;
  x: number; // % left
  y: number; // % top
  side: "home" | "away";
};

/** Default gap between card AABBs (screen px). Prefer space over overlap. */
export const CARD_GAP_PX = 8;

/** Honest unscaled SportsCom card height — real DOM is taller than CSS estimate. */
export function baseCardHeight(settings: FieldSettings): number {
  return settings.dataRows === 2 ? 152 : 118;
}

export function baseCardWidth(): number {
  return 76;
}

/** Approximate rendered card size (matches SportsComToken baseW + scaled transform). */
export function estimateCardSizePx(
  markerPct: number,
  settings: FieldSettings
): { w: number; h: number } {
  const scale = scaleFactor(markerPct);
  const baseW = baseCardWidth();
  const baseH = baseCardHeight(settings);
  return { w: baseW * scale, h: baseH * scale };
}

/**
 * Geometric upper bound so 11+11 cards can physically fit the pitch box.
 * Landscape: depth = screen X → use cardW; lateral = screen Y → use cardH.
 * Conservative: 6 depth bands per half × cardW; ~5 lateral stacks × cardH.
 */
export function geometricMaxMarkerPct(
  containerW: number,
  containerH: number,
  settings: FieldSettings
): number {
  if (!containerW || !containerH) return 0;
  const baseW = baseCardWidth();
  const baseH = baseCardHeight(settings);
  const gap = CARD_GAP_PX;
  // Expanded half bands are ~46% of pitch width (home 2→48, away 52→98).
  const halfW = Math.max(100, containerW * 0.46);
  const usableH = Math.max(120, containerH - 56);
  // Depth axis (X): 6 formation lines with gaps
  const maxScaleDepth = halfW / (6 * baseW + 5 * gap);
  // Lateral axis (Y): worst-case 5 players in a line
  const maxScaleLateral = usableH / (5 * baseH + 4 * gap);
  const maxScale = Math.max(
    0.55,
    Math.min(maxScaleDepth, maxScaleLateral, 1.4)
  );
  return clampPct(Math.round((maxScale - 1) * 100));
}

export function countAabbOverlaps<T extends PlacedSlot>(
  placed: T[],
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  gapPx = CARD_GAP_PX
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
 * Prefer smaller cards over any remaining overlap.
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
      CARD_GAP_PX
    );
    // Require 0 overlaps AFTER resolve with full gap — prefer shrink over touch.
    return (
      countAabbOverlaps(resolved, containerW, containerH, w, h, CARD_GAP_PX) ===
      0
    );
  };

  if (fits(ceiling)) return ceiling;

  let lo = -40;
  let hi = ceiling;
  let best = -40;
  // Binary search max integer pct that fits; if even -40 overlaps, still -40
  // (expanded depth bands + DOM shrink loop handle the rest).
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
 * Same-side: push harder along depth (x) when cards sit on different formation
 * lines (different original x); otherwise prefer lateral (y).
 * Never leave known overlaps if space exists — caller must shrink marker if
 * still overlapping after resolve.
 */
export function resolveCardOverlaps<T extends PlacedSlot>(
  placed: T[],
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  gapPx = CARD_GAP_PX
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
  // Keep card bodies on their own half — do not bleed across midfield.
  const halfGuard = Math.max(halfW * 0.55, cardW * 0.35);

  const clampItem = (it: Item, padBottom: number) => {
    if (it.side === "home") {
      // Expanded home band ~2%–48%
      it.px = Math.min(it.px, midX - halfGuard);
      it.px = Math.max(halfW + 2, Math.min(containerW * 0.48, it.px));
    } else {
      // Expanded away band ~52%–98%
      it.px = Math.max(it.px, midX + halfGuard);
      it.px = Math.max(containerW * 0.52, Math.min(containerW - halfW - 2, it.px));
    }
    it.px = Math.max(halfW + 2, Math.min(containerW - halfW - 2, it.px));
    it.py = Math.max(halfH + 6, Math.min(containerH - halfH - padBottom, it.py));
  };

  const separatePair = (a: Item, b: Item, depthBoost: number) => {
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx >= minDx || absDy >= minDy) return false;

    const overlapX = minDx - absDx;
    const overlapY = minDy - absDy;
    const sameSide = a.side === b.side;
    // Different original depth (formation lines) → push depth harder on same side.
    const differentLines = Math.abs(a.ox - b.ox) > cardW * 0.15;
    const preferDepth = sameSide && differentLines;

    let latWeight = sameSide ? 0.85 : 0.95;
    let depthWeight = sameSide ? 1.15 : 0.9;
    if (preferDepth) {
      depthWeight = 1.55 * depthBoost;
      latWeight = 0.65;
    } else if (sameSide) {
      depthWeight = 1.2 * depthBoost;
    }

    if (overlapY > 0) {
      const push = (overlapY / 2 + 0.75) * latWeight;
      const sign = dy === 0 ? (a.oy <= b.oy ? -1 : 1) : dy > 0 ? 1 : -1;
      a.py -= push * sign;
      b.py += push * sign;
    }
    if (overlapX > 0) {
      let push = (overlapX / 2 + 0.75) * depthWeight;
      const aDeeper = a.side === "home" ? a.ox <= b.ox : a.ox >= b.ox;
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
      if (overlapX > cardW * 0.2) push *= 1.35;
      if (preferDepth) push *= 1.2;
      a.px -= push * sign;
      b.px += push * sign;
    }
    return true;
  };

  // Main resolve — many iterations; escalate depth push over time.
  for (let iter = 0; iter < 180; iter++) {
    let moved = false;
    const depthBoost = 1 + Math.min(0.8, iter / 90);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (separatePair(items[i], items[j], depthBoost)) moved = true;
      }
    }
    for (const it of items) clampItem(it, 22);
    if (!moved) break;
  }

  // Final force passes: never leave overlap if axes can still separate.
  for (let pass = 0; pass < 60; pass++) {
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
        const sameSide = a.side === b.side;
        const differentLines = Math.abs(a.ox - b.ox) > cardW * 0.15;

        // Same-side different lines: prioritize depth (x) hard.
        if (sameSide && differentLines && overlapX > 0) {
          const pushX = overlapX / 2 + 1.5;
          const aDeeper = a.side === "home" ? a.ox <= b.ox : a.ox >= b.ox;
          const sign =
            a.side === "home"
              ? aDeeper
                ? -1
                : 1
              : aDeeper
                ? 1
                : -1;
          a.px -= pushX * sign;
          b.px += pushX * sign;
        } else {
          const pushY = overlapY / 2 + 1.25;
          const signY = dy === 0 ? (i % 2 === 0 ? -1 : 1) : dy > 0 ? 1 : -1;
          a.py -= pushY * signY;
          b.py += pushY * signY;
          const pushX = overlapX / 2 + 1.25;
          const signX =
            dx === 0 ? (a.side === "home" ? -1 : 1) : dx > 0 ? 1 : -1;
          a.px -= pushX * signX;
          b.px += pushX * signX;
        }
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
