"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mic2,
  HeartPulse,
  Target,
  MapPin,
  Building2,
  CloudSun,
  Users,
  LayoutGrid,
  Printer,
  StickyNote,
  Sparkles,
  Trophy,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { slug: "", label: "Desk", icon: LayoutGrid },
  { slug: "packs", label: "Research", icon: Sparkles },
  { slug: "scripts", label: "Scripts", icon: Mic2 },
  { slug: "stats", label: "Stats", icon: Target },
  { slug: "league", label: "League", icon: Trophy },
  { slug: "news", label: "News", icon: Newspaper },
  { slug: "notes", label: "Notes", icon: StickyNote },
  { slug: "squad", label: "Squad", icon: Users },
  { slug: "injuries", label: "Injuries", icon: HeartPulse },
  { slug: "scorers", label: "Scorers", icon: Target },
  { slug: "venue", label: "Venue", icon: MapPin },
  { slug: "clubs", label: "Clubs", icon: Building2 },
  { slug: "weather", label: "Weather", icon: CloudSun },
  { slug: "print", label: "Export", icon: Printer },
];

export function MatchNav({ matchId }: { matchId: string }) {
  const pathname = usePathname();
  const base = `/match-day/${matchId}`;

  return (
    <nav className="desk-chrome sticky top-14 z-30 overflow-x-auto bg-[var(--surface)] dark:bg-[var(--surface)]">
      <div className="mx-auto flex max-w-[1600px] min-w-max gap-0.5 px-2 sm:px-4">
        {items.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active =
            item.slug === ""
              ? pathname === base
              : pathname.startsWith(`${base}/${item.slug}`);
          const Icon = item.icon;
          return (
            <Link
              key={item.slug || "overview"}
              href={href}
              className={cn(
                "focus-ring relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-desk-xs font-bold uppercase tracking-[0.06em] transition-[color,border-color,background-color] duration-150 sm:text-[11px] sm:normal-case sm:tracking-tight sm:font-semibold",
                active
                  ? "border-[var(--foreground)] text-[var(--foreground)] dark:border-[var(--brand)] dark:text-[var(--brand)]"
                  : "border-transparent text-[var(--muted)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-opacity",
                  active ? "opacity-100" : "opacity-55"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
