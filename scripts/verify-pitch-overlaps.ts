/**
 * Mental/unit check: 11+11 cards at +40% on 1280–1440 width must not overlap
 * for 4-2-3-1 and 4-3-3 / 4-2-2-2 after collision resolution.
 */
import { slotsFor } from "../lib/formations";
import {
  estimateCardSizePx,
  fitMarkerPctForContainer,
  resolveCardOverlaps,
} from "../lib/pitch-layout";
import { DEFAULT_FIELD_SETTINGS } from "../lib/field-settings";

function placeLandscape(
  formation: string,
  side: "home" | "away"
) {
  const slots = slotsFor(formation);
  return slots.map((slot) => {
    const depth = (100 - slot.y) / 100;
    const width = slot.x;
    let x: number;
    let y: number;
    if (side === "home") {
      x = 4 + depth * 42;
      y = width;
    } else {
      x = 96 - depth * 42;
      y = 100 - width;
    }
    return { slot, player: { id: `${side}-${slot.id}` }, x, y, side };
  });
}

function aabbOverlap(
  a: { x: number; y: number },
  b: { x: number; y: number },
  w: number,
  h: number,
  cw: number,
  ch: number,
  gap = 1
) {
  const ax = (a.x / 100) * cw;
  const ay = (a.y / 100) * ch;
  const bx = (b.x / 100) * cw;
  const by = (b.y / 100) * ch;
  return (
    Math.abs(ax - bx) < w + gap && Math.abs(ay - by) < h + gap
  );
}

function check(
  homeF: string,
  awayF: string,
  width: number,
  markerPct: number
) {
  const height = Math.round((width * 9) / 16);
  const settings = { ...DEFAULT_FIELD_SETTINGS, markerSizePct: markerPct };
  const fitted = fitMarkerPctForContainer(width, height, markerPct, settings);
  const { w, h } = estimateCardSizePx(fitted, settings);
  const raw = [
    ...placeLandscape(homeF, "home"),
    ...placeLandscape(awayF, "away"),
  ];
  const resolved = resolveCardOverlaps(raw, width, height, w, h, 6);
  let overlaps = 0;
  for (let i = 0; i < resolved.length; i++) {
    for (let j = i + 1; j < resolved.length; j++) {
      if (aabbOverlap(resolved[i], resolved[j], w, h, width, height, 0.5)) {
        overlaps++;
        console.log(
          `  OVERLAP ${resolved[i].side}-${resolved[i].slot.id} vs ${resolved[j].side}-${resolved[j].slot.id}`
        );
      }
    }
  }
  const label = `${homeF} vs ${awayF} @ ${width}px want ${markerPct >= 0 ? "+" : ""}${markerPct}% fit ${fitted >= 0 ? "+" : ""}${fitted}% card ${w.toFixed(0)}x${h.toFixed(0)}`;
  console.log(`${overlaps === 0 ? "OK" : "FAIL"} ${label} overlaps=${overlaps}`);
  return overlaps;
}

let failed = 0;
for (const width of [720, 900, 1100, 1280, 1360, 1440]) {
  for (const pct of [-40, 0, 20, 40]) {
    for (const pair of [
      ["4-2-3-1", "4-3-3"],
      ["4-3-3", "4-2-2-2"],
      ["4-2-3-1", "4-2-3-1"],
    ] as const) {
      failed += check(pair[0], pair[1], width, pct);
    }
  }
}
if (failed) {
  console.error(`FAILED with ${failed} overlapping pairs`);
  process.exit(1);
}
console.log("All layout checks passed");
