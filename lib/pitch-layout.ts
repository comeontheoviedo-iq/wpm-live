/** Pixel collision resolution for pitch cards. */

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

/** Honest unscaled pitch card height — real DOM is taller than CSS estimate. */
export function baseCardHeight(settings: FieldSettings): number {
  // Slightly tighter than prior 152/118 so windowed desks aren't floored at -40%.
  return settings.dataRows === 2 ? 128 : 102;
}

export function baseCardWidth(): number {
  return 78;
}

/** Approximate rendered card size (matches PitchCardToken baseW + scaled transform). */
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
 * Soft ceiling only — fitMarkerPctForContainer binary-searches real placements.
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
  // Lateral axis (Y): typical back-four / midfield line (4), not worst-case 5
  const maxScaleLateral = usableH / (4 * baseH + 3 * gap);
  const maxScale = Math.max(
    0.6,
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
 * Cap marker % so 11+11 pitch cards fit with zero AABB overlaps after
 * collision resolve. Binary-searches from the user's desired % downward.
 * geometricMax is a soft hint only — never floors the slider before search.
 */
export function fitMarkerPctForContainer(
  containerW: number,
  containerH: number,
  desiredPct: number,
  settings: FieldSettings,
  rawPlaced?: PlacedSlot[],
  homeOnLeft = true
): number {
  if (!containerW || !containerH) return desiredPct;
  const geoMax = geometricMaxMarkerPct(containerW, containerH, settings);
  // Honor user desire as ceiling; geoMax may raise the starting guess only when
  // desired is below geo (never clamp desired down before testing).
  const ceiling = clampPct(desiredPct);

  if (!rawPlaced || rawPlaced.length < 2) {
    // Without placements, soft-cap with geo so Full doesn't explode blindly.
    return Math.min(ceiling, Math.max(geoMax, -25));
  }

  const fits = (pct: number) => {
    const { w, h } = estimateCardSizePx(pct, settings);
    const resolved = resolveCardOverlaps(
      rawPlaced,
      containerW,
      containerH,
      w,
      h,
      CARD_GAP_PX,
      homeOnLeft
    );
    return (
      countAabbOverlaps(resolved, containerW, containerH, w, h, CARD_GAP_PX) ===
      0
    );
  };

  if (fits(ceiling)) return ceiling;

  let lo = -40;
  let hi = ceiling;
  let best = -40;
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
 * CRITICAL: depth pushes MUST preserve original formation depth order so a CB
 * never ends up in the CDM band (and vice versa).
 */
export function resolveCardOverlaps<T extends PlacedSlot>(
  placed: T[],
  containerW: number,
  containerH: number,
  cardW: number,
  cardH: number,
  gapPx = CARD_GAP_PX,
  /** When false, home occupies the right half (Swap sides). */
  homeOnLeft = true
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

  // Per-side depth bands from original formation xs: each card may move up to
  // the midpoint toward the next/prev line (never past), plus a small slack.
  const bandLimits = new Map<Item, { lo: number; hi: number }>();
  for (const side of ["home", "away"] as const) {
    const sideItems = items.filter((it) => it.side === side);
    const uniqueOx = [...new Set(sideItems.map((it) => it.ox))].sort((a, b) => a - b);
    const slack = Math.max(4, cardW * 0.08);
    for (const it of sideItems) {
      const idx = uniqueOx.indexOf(it.ox);
      const prev = idx > 0 ? uniqueOx[idx - 1] : null;
      const next = idx < uniqueOx.length - 1 ? uniqueOx[idx + 1] : null;
      const lo = prev == null ? halfW + 2 : (prev + it.ox) / 2 + slack * 0.25;
      const hi = next == null ? containerW - halfW - 2 : (it.ox + next) / 2 - slack * 0.25;
      bandLimits.set(it, {
        lo: Math.min(it.ox, lo) - slack,
        hi: Math.max(it.ox, hi) + slack,
      });
    }
  }

  const sideOnLeft = (side: "home" | "away") =>
    side === "home" ? homeOnLeft : !homeOnLeft;

  const clampItem = (it: Item, padBottom: number) => {
    const onLeft = sideOnLeft(it.side);
    if (onLeft) {
      it.px = Math.min(it.px, midX - halfGuard);
      it.px = Math.max(halfW + 2, Math.min(containerW * 0.48, it.px));
    } else {
      it.px = Math.max(it.px, midX + halfGuard);
      it.px = Math.max(containerW * 0.52, Math.min(containerW - halfW - 2, it.px));
    }
    const band = bandLimits.get(it);
    if (band) {
      it.px = Math.max(band.lo, Math.min(band.hi, it.px));
    }
    if (onLeft) {
      it.px = Math.min(it.px, midX - halfGuard);
      it.px = Math.max(halfW + 2, Math.min(containerW * 0.48, it.px));
    } else {
      it.px = Math.max(it.px, midX + halfGuard);
      it.px = Math.max(containerW * 0.52, Math.min(containerW - halfW - 2, it.px));
    }
    it.px = Math.max(halfW + 2, Math.min(containerW - halfW - 2, it.px));
    it.py = Math.max(halfH + 6, Math.min(containerH - halfH - padBottom, it.py));
  };

  /** Push same-side pair apart on depth while preserving ox order. */
  const pushDepthPreserving = (a: Item, b: Item, push: number) => {
    if (a.ox <= b.ox) {
      // a belongs left of b (home: deeper; away: more advanced)
      a.px -= push;
      b.px += push;
    } else {
      a.px += push;
      b.px -= push;
    }
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
    const differentLines = Math.abs(a.ox - b.ox) > Math.max(cardW * 0.4, containerW * 0.045);
    const preferDepth = sameSide && differentLines;

    let latWeight = sameSide ? 0.85 : 0.95;
    let depthWeight = sameSide ? 1.15 : 0.9;
    if (preferDepth) {
      depthWeight = 1.55 * depthBoost;
      latWeight = 0.55;
    } else if (sameSide) {
      depthWeight = 1.1 * depthBoost;
    }

    // Lateral first when same line; still apply some lateral when different lines.
    if (overlapY > 0) {
      const push = (overlapY / 2 + 0.75) * latWeight;
      const sign = dy === 0 ? (a.oy <= b.oy ? -1 : 1) : dy > 0 ? 1 : -1;
      a.py -= push * sign;
      b.py += push * sign;
    }
    if (overlapX > 0) {
      let push = (overlapX / 2 + 0.75) * depthWeight;
      if (overlapX > cardW * 0.2) push *= 1.25;
      if (preferDepth) push *= 1.15;
      if (sameSide) {
        pushDepthPreserving(a, b, push);
      } else {
        const sign =
          dx === 0
            ? sideOnLeft(a.side)
              ? -1
              : 1
            : dx > 0
              ? 1
              : -1;
        a.px -= push * sign;
        b.px += push * sign;
      }
    }
    return true;
  };

  /** If same-side depth order inverted vs ox, snap back apart. */
  const enforceDepthOrder = () => {
    let fixed = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.side !== b.side) continue;
        if (Math.abs(a.ox - b.ox) < Math.max(cardW * 0.35, containerW * 0.04)) continue; // same formation line
        const orderOk = a.ox <= b.ox ? a.px <= b.px : a.px >= b.px;
        if (orderOk) continue;
        // Restore order with at least minDx separation when possible
        const left = a.ox <= b.ox ? a : b;
        const right = left === a ? b : a;
        const mid = (left.px + right.px) / 2;
        const sep = Math.max(minDx / 2, Math.abs(left.ox - right.ox) * 0.35);
        left.px = mid - sep;
        right.px = mid + sep;
        fixed = true;
      }
    }
    return fixed;
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
    if (enforceDepthOrder()) moved = true;
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
        const differentLines = Math.abs(a.ox - b.ox) > Math.max(cardW * 0.4, containerW * 0.045);

        if (sameSide && differentLines && overlapX > 0) {
          pushDepthPreserving(a, b, overlapX / 2 + 1.5);
        } else {
          const pushY = overlapY / 2 + 1.25;
          const signY = dy === 0 ? (i % 2 === 0 ? -1 : 1) : dy > 0 ? 1 : -1;
          a.py -= pushY * signY;
          b.py += pushY * signY;
          if (sameSide && overlapX > 0) {
            pushDepthPreserving(a, b, overlapX / 2 + 1.25);
          } else if (overlapX > 0) {
            const pushX = overlapX / 2 + 1.25;
            const signX =
              dx === 0
                ? sideOnLeft(a.side)
                  ? -1
                  : 1
                : dx > 0
                  ? 1
                  : -1;
            a.px -= pushX * signX;
            b.px += pushX * signX;
          }
        }
        moved = true;
      }
    }
    enforceDepthOrder();
    for (const it of items) clampItem(it, 18);
    if (!moved) break;
  }

  // Last hard order pass after clamps
  for (let k = 0; k < 8; k++) {
    if (!enforceDepthOrder()) break;
    for (const it of items) clampItem(it, 18);
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

