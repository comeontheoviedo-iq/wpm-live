import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom desk type scale uses `text-desk-*` names. Default twMerge treats any
 * `text-*` as text-color, so `text-desk-sm` was stripping Button colors
 * (`text-white`, `text-[var(--surface)]`, etc.) → blank white CTAs.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-desk-2xs",
        "text-desk-xs",
        "text-desk-sm",
        "text-desk-label",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKickoff(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export const STATUS_FLOW = [
  "Assigned",
  "Preparation",
  "Ready",
  "Live",
  "Full Time",
] as const;

export type PrepStatus = (typeof STATUS_FLOW)[number];

export function nextStatus(current: string): PrepStatus | null {
  const idx = STATUS_FLOW.indexOf(current as PrepStatus);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

export function statusColor(status: string) {
  switch (status) {
    case "Assigned":
      return "bg-slate-500";
    case "Preparation":
      return "bg-amber-500";
    case "Ready":
      return "bg-sky-500";
    case "Live":
      return "bg-rose-500 animate-pulse";
    case "Full Time":
      return "bg-emerald-600";
    default:
      return "bg-slate-400";
  }
}


const HTML_NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

function decodeCodePoint(raw: string): string | null {
  const n = raw.toLowerCase().startsWith("x")
    ? parseInt(raw.slice(1), 16)
    : parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return null;
  try {
    return String.fromCodePoint(n);
  } catch {
    return null;
  }
}

/**
 * Decode HTML/XML entities for display or ingest.
 * Unwraps double-encoding (`&amp;amp;` → `&`) and broken `& amp;` forms.
 * Safe for React text nodes — does not parse markup.
 */
export function decodeHtmlEntities(input: string): string {
  if (!input || !input.includes("&")) return input;
  let out = input
    // Broken entities from copy/paste / RSS ("& amp;", "&amp ;", "&# 38;")
    .replace(/&\s*amp\s*;/gi, "&amp;")
    .replace(/&\s*#\s*0*38\s*;/g, "&amp;")
    .replace(/&\s*#\s*x0*26\s*;/gi, "&amp;");
  for (let i = 0; i < 3; i++) {
    const next = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
      const key = String(body);
      if (key.startsWith("#")) {
        const decoded = decodeCodePoint(key.slice(1));
        return decoded ?? m;
      }
      return HTML_NAMED_ENTITIES[key.toLowerCase()] ?? m;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Display helper: decode entities once, then fix curly quotes / mojibake. */
export function displayText(input: string): string {
  if (!input) return input;
  return (
    decodeHtmlEntities(input)
      .replace(/\u2018|\u2019|\u201A|\uFF07/g, "'")
      .replace(/\u201C|\u201D|\u201E/g, '"')
      // Common UTF-8→Latin-1 mojibake for ’ ‘ “ ”
      .replace(/\u00E2\u20AC\u2122/g, "'") // â€™
      .replace(/\u00E2\u20AC\u02DC/g, "'") // â€˜
      .replace(/\u00E2\u20AC\u0153/g, '"') // â€œ
      .replace(/\u00E2\u20AC\u009D/g, '"') // â€
      .replace(/â€™|â€˜/g, "'")
      .replace(/â€œ|â€/g, '"')
  );
}

/** Alias of displayText — existing note/script write + display paths now decode entities too. */
export function normalizeApostrophes(input: string): string {
  return displayText(input);
}
