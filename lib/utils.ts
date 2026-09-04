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
