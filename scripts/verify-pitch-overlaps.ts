/**
 * Unit check: 11+11 cards must have 0 AABB overlaps after fit + collision
 * across windowed 16:9 and tall compact/fullscreen-like containers.
 */
import { slotsFor } from "../lib/formations";
import {
  estimateCardSizePx,
  fitMarkerPctForContainer,
  resolveCardOverlaps,
  countAabbOverlaps,
} from "../lib/pitch-layout";
import { DEFAULT_FIELD_SETTINGS } from "../lib/field-settings";

function placeLandscape(formation: string, side: "home" | "away") {
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

function check(
  homeF: string,
  awayF: string,
  width: number,
  height: number,
  markerPct: number
) {
  const settings = { ...DEFAULT_FIELD_SETTINGS, markerSizePct: markerPct };
  const raw = [
    ...placeLandscape(homeF, "home"),
    ...placeLandscape(awayF, "away"),
  ];
  const fitted = fitMarkerPctForContainer(
    width,
    height,
    markerPct,
    settings,
    raw
  );
  const { w, h } = estimateCardSizePx(fitted, settings);
  const resolved = resolveCardOverlaps(raw, width, height, w, h, 4);
  const overlaps = countAabbOverlaps(resolved, width, height, w, h, 0.5);
  const label = `${homeF} vs ${awayF} @ ${width}x${height} want ${markerPct >= 0 ? "+" : ""}${markerPct}% fit ${fitted >= 0 ? "+" : ""}${fitted}% card ${w.toFixed(0)}x${h.toFixed(0)}`;
  console.log(`${overlaps === 0 ? "OK" : "FAIL"} ${label} overlaps=${overlaps}`);
  return overlaps;
}

let failed = 0;
const sizes: [number, number][] = [
  [720, 405],
  [900, 506],
  [1100, 619],
  [1280, 720],
  [1360, 765],
  [1440, 810],
  // tall compact desk (notes|pitch|squad) — previous geometric fit failed here
  [700, 780],
  [850, 820],
  [980, 820],
  [1100, 900],
  [1200, 1000],
];

for (const [width, height] of sizes) {
  for (const pct of [-40, 0, 20, 40]) {
    for (const pair of [
      ["4-2-3-1", "4-3-3"],
      ["4-3-3", "4-2-2-2"],
      ["4-2-3-1", "4-2-3-1"],
    ] as const) {
      failed += check(pair[0], pair[1], width, height, pct);
    }
  }
}
if (failed) {
  console.error(`FAILED with ${failed} overlapping pairs`);
  process.exit(1);
}
console.log("All layout checks passed");
