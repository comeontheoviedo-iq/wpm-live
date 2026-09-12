/** Curated IANA zones for profile picker (football / broadcast markets). Client-safe. */
export const PROFILE_TIMEZONES: { id: string; label: string }[] = [
  { id: "Europe/London", label: "London (UK)" },
  { id: "Europe/Dublin", label: "Dublin" },
  { id: "Europe/Paris", label: "Paris" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Europe/Madrid", label: "Madrid" },
  { id: "Europe/Rome", label: "Rome" },
  { id: "Europe/Amsterdam", label: "Amsterdam" },
  { id: "Europe/Lisbon", label: "Lisbon" },
  { id: "Europe/Warsaw", label: "Warsaw" },
  { id: "Europe/Istanbul", label: "Istanbul" },
  { id: "Europe/Moscow", label: "Moscow" },
  { id: "Africa/Lagos", label: "Lagos" },
  { id: "Africa/Johannesburg", label: "Johannesburg" },
  { id: "Africa/Cairo", label: "Cairo" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Chicago", label: "Chicago" },
  { id: "America/Denver", label: "Denver" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "America/Toronto", label: "Toronto" },
  { id: "America/Mexico_City", label: "Mexico City" },
  { id: "America/Sao_Paulo", label: "São Paulo" },
  { id: "America/Buenos_Aires", label: "Buenos Aires" },
  { id: "Asia/Dubai", label: "Dubai" },
  { id: "Asia/Kolkata", label: "Kolkata" },
  { id: "Asia/Singapore", label: "Singapore" },
  { id: "Asia/Shanghai", label: "Shanghai" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Asia/Seoul", label: "Seoul" },
  { id: "Australia/Sydney", label: "Sydney" },
  { id: "Pacific/Auckland", label: "Auckland" },
  { id: "UTC", label: "UTC" },
];

export function normalizeTimezone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (PROFILE_TIMEZONES.some((z) => z.id === t)) return t;
  if (/^[A-Za-z_]+\/[A-Za-z0-9_+\-]+$/.test(t) || t === "UTC") return t;
  return null;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]![0] || "";
    const b = parts[parts.length - 1]![0] || "";
    return (a + b).toUpperCase().slice(0, 3) || "PL";
  }
  const one = parts[0] || name.trim();
  return one.slice(0, 2).toUpperCase() || "PL";
}
