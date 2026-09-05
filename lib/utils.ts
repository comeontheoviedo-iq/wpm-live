import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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


/** Fix curly quotes / HTML entities / mojibake → proper ASCII apostrophes/quotes. */
export function normalizeApostrophes(input: string): string {
  if (!input) return input;
  return (
    input
      .replace(/\u2018|\u2019|\u201A|\uFF07/g, "'")
      .replace(/\u201C|\u201D|\u201E/g, '"')
      .replace(/&apos;|&#0*39;|&#x0*27;|&#0*8217;|&#0*8216;|&rsquo;|&lsquo;/gi, "'")
      .replace(/&quot;|&#0*34;|&#0*8220;|&#0*8221;|&rdquo;|&ldquo;/gi, '"')
      // Common UTF-8→Latin-1 mojibake for ’ ‘ “ ”
      .replace(/\u00E2\u20AC\u2122/g, "'") // â€™
      .replace(/\u00E2\u20AC\u02DC/g, "'") // â€˜
      .replace(/\u00E2\u20AC\u0153/g, '"') // â€œ
      .replace(/\u00E2\u20AC\u009D/g, '"') // â€
      .replace(/â€™|â€˜/g, "'")
      .replace(/â€œ|â€/g, '"')
  );
}
