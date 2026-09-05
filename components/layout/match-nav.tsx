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
  { slug: "scripts", label: "Scripts", icon: Mic2 },
  { slug: "packs", label: "Packs", icon: Sparkles },
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
    <nav className="desk-chrome sticky top-14 z-30 overflow-x-auto bg-white/90 backdrop-blur-md dark:bg-slate-950/90">
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
                "focus-ring relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-desk-xs font-semibold tracking-tight transition-[color,border-color,background-color,transform] duration-150 sm:text-desk-sm",
                active
                  ? "border-teal-500 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:border-slate-300/80 hover:bg-slate-50/80 hover:text-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-slate-200"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 transition-opacity",
                  active ? "opacity-100" : "opacity-70"
                )}
              />
              {item.label}
              {active ? (
                <span className="pointer-events-none absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 shadow-[0_0_12px_rgba(45,212,191,0.55)]" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
