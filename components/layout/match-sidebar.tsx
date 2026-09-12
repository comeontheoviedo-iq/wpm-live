"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "pitchline.matchSidebar.expanded";

type NavItem = {
  slug: string;
  label: string;
  icon: typeof LayoutGrid;
};

type NavSection = { id: string; label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    id: "prep",
    label: "Prep",
    items: [
      { slug: "", label: "Desk", icon: LayoutGrid },
      { slug: "packs", label: "Research", icon: Sparkles },
      { slug: "scripts", label: "Scripts", icon: Mic2 },
      { slug: "notes", label: "Notes", icon: StickyNote },
    ],
  },
  {
    id: "intel",
    label: "Intel",
    items: [
      { slug: "stats", label: "Stats", icon: Target },
      { slug: "league", label: "League", icon: Trophy },
      { slug: "news", label: "News", icon: Newspaper },
      { slug: "scorers", label: "Scorers", icon: Target },
      { slug: "injuries", label: "Injuries", icon: HeartPulse },
    ],
  },
  {
    id: "squad",
    label: "Squad",
    items: [
      { slug: "squad", label: "Squad", icon: Users },
      { slug: "venue", label: "Venue", icon: MapPin },
      { slug: "clubs", label: "Clubs", icon: Building2 },
      { slug: "weather", label: "Weather", icon: CloudSun },
      { slug: "print", label: "Export", icon: Printer },
    ],
  },
];

function isMobileViewport() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
  );
}

export function MatchSidebar({ matchId }: { matchId: string }) {
  const pathname = usePathname();
  const base = `/match-day/${matchId}`;
  const [expanded, setExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "0" || raw === "false") setExpanded(false);
      else if (raw === "1" || raw === "true") setExpanded(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persistExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    if (isMobileViewport()) {
      setMobileOpen((open) => {
        const next = !open;
        persistExpanded(next);
        return next;
      });
      return;
    }
    persistExpanded(!expanded);
  }, [expanded, persistExpanded]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        persistExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, persistExpanded]);

  const desktopExpanded = hydrated ? expanded : true;

  const renderLinks = (opts: {
    showLabels: boolean;
    onNavigate?: () => void;
  }) => (
    <div className="flex flex-col gap-0.5 px-1.5 pb-2">
      {sections.map((section) => (
        <div key={section.id}>
          {opts.showLabels ? (
            <div className="nav-rail-section" aria-hidden>
              {section.label}
            </div>
          ) : (
            <div
              className="mx-auto my-1.5 h-px w-5 bg-[var(--border)] first:mt-0.5"
              aria-hidden
            />
          )}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const href = item.slug ? `${base}/${item.slug}` : base;
              const active =
                item.slug === ""
                  ? pathname === base
                  : pathname.startsWith(`${base}/${item.slug}`);
              const Icon = item.icon;
              return (
                <li key={item.slug || "overview"}>
                  <Link
                    href={href}
                    onClick={opts.onNavigate}
                    title={item.label}
                    className={cn(
                      "focus-ring nav-rail-link group relative flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-[color,background-color,box-shadow] duration-150",
                      opts.showLabels ? "justify-start" : "justify-center",
                      active
                        ? "is-active"
                        : "text-[var(--muted)] hover:bg-[var(--surface-muted)]/70 hover:text-[var(--foreground)]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-opacity",
                        active
                          ? "opacity-100"
                          : "opacity-55 group-hover:opacity-90"
                      )}
                    />
                    {opts.showLabels ? (
                      <span className="truncate">{item.label}</span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  const chrome = (opts: {
    showLabels: boolean;
    collapseLooksExpanded: boolean;
    onNavigate?: () => void;
  }) => (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-1 border-b border-[var(--border)] px-2 py-1.5">
        {opts.showLabels ? (
          <span className="nav-rail-kicker truncate px-1">Match desk</span>
        ) : (
          <span className="sr-only">Match navigation</span>
        )}
        <button
          type="button"
          onClick={toggle}
          className="focus-ring interactive-press ml-auto inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          aria-label={
            opts.collapseLooksExpanded
              ? "Collapse sidebar to icons only"
              : "Expand sidebar with labels"
          }
          title={opts.collapseLooksExpanded ? "Icons only" : "Show labels"}
        >
          {opts.collapseLooksExpanded ? (
            <ChevronsLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronsRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden py-1"
        aria-label="Match sections"
      >
        {renderLinks(opts)}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop / tablet: Football Manager-style rail */}
      <aside
        data-match-sidebar
        className={cn(
          "desk-chrome match-sidebar nav-rail relative z-20 hidden shrink-0 flex-col border-r border-[var(--border)] md:sticky md:top-11 md:flex md:h-[calc(100dvh-2.75rem)]",
          desktopExpanded ? "md:w-[11.25rem]" : "md:w-[3rem]",
          "transition-[width] duration-200 ease-out"
        )}
        aria-label="Match navigation sidebar"
      >
        {chrome({
          showLabels: desktopExpanded,
          collapseLooksExpanded: desktopExpanded,
        })}
      </aside>

      {/* Mobile: always-on compact icon rail */}
      <aside
        data-match-sidebar-mobile
        className={cn(
          "desk-chrome nav-rail relative z-20 flex w-[3rem] shrink-0 flex-col border-r border-[var(--border)] md:hidden",
          "sticky top-11 h-[calc(100dvh-2.75rem)]"
        )}
        aria-label="Match navigation"
      >
        {chrome({
          showLabels: false,
          collapseLooksExpanded: mobileOpen,
          onNavigate: () => setMobileOpen(false),
        })}
      </aside>

      {/* Mobile label drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false);
              persistExpanded(false);
            }}
          />
          <aside
            className="nav-rail absolute inset-y-0 left-0 flex w-[14rem] flex-col border-r border-[var(--border)] bg-[#0c1016] shadow-xl"
            data-match-sidebar-drawer
          >
            {chrome({
              showLabels: true,
              collapseLooksExpanded: true,
              onNavigate: () => setMobileOpen(false),
            })}
          </aside>
        </div>
      )}
    </>
  );
}
