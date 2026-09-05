"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Mic2,
  ClipboardList,
  HeartPulse,
  Target,
  Shield,
  Crosshair,
  MapPin,
  Building2,
  CloudSun,
  Users,
  Radio,
  LayoutGrid,
  Printer,
  StickyNote,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { slug: "", label: "Desk", icon: LayoutGrid },
  { slug: "scripts", label: "Scripts", icon: Mic2 },
  { slug: "packs", label: "Packs", icon: Sparkles },
  { slug: "prep", label: "Prep", icon: ClipboardList },
  { slug: "stats", label: "Stats", icon: Target },
  { slug: "notes", label: "Notes", icon: StickyNote },
  { slug: "injuries", label: "Injuries", icon: HeartPulse },
  { slug: "scorers", label: "Scorers", icon: Target },
  { slug: "keepers", label: "Keepers", icon: Shield },
  { slug: "penalties", label: "Penalties", icon: Crosshair },
  { slug: "venue", label: "Venue", icon: MapPin },
  { slug: "clubs", label: "Clubs", icon: Building2 },
  { slug: "weather", label: "Weather", icon: CloudSun },
  { slug: "squad", label: "Squad", icon: Users },
  { slug: "live", label: "Live", icon: Radio },
  { slug: "print", label: "Export", icon: Printer },
];

export function MatchNav({ matchId }: { matchId: string }) {
  const pathname = usePathname();
  const base = `/match-day/${matchId}`;

  return (
    <nav className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-x-auto">
      <div className="mx-auto flex max-w-[1600px] gap-0.5 px-2 sm:px-4 min-w-max">
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
                "flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap",
                active
                  ? "border-teal-500 text-teal-700 dark:text-teal-300"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
