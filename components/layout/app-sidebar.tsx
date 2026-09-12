"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutGrid,
  Plus,
  Settings,
  CreditCard,
  Radio,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  match: (p: string) => boolean;
};

const baseItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Desks",
    icon: LayoutGrid,
    match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/"),
  },
  {
    href: "/match-day/new",
    label: "New desk",
    icon: Plus,
    match: (p: string) => p.startsWith("/match-day/new"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (p: string) => p.startsWith("/settings"),
  },
  {
    href: "/pricing",
    label: "Pricing",
    icon: CreditCard,
    match: (p: string) => p.startsWith("/pricing"),
  },
];

export function AppSidebar({
  liveCount = 0,
  showUr,
  urMatchDayId,
}: {
  liveCount?: number;
  /** When set (dashboard SSR), skip client fetch for allowlist. */
  showUr?: boolean;
  /** Preferred match-day for U&R tab → `/show/<id>` (board or enable gate). */
  urMatchDayId?: string | null;
}) {
  const pathname = usePathname();
  const [urNav, setUrNav] = useState<{
    enabled: boolean;
    matchDayId: string | null;
  } | null>(
    showUr === undefined
      ? null
      : { enabled: showUr, matchDayId: urMatchDayId ?? null }
  );

  useEffect(() => {
    if (showUr !== undefined) {
      setUrNav({ enabled: showUr, matchDayId: urMatchDayId ?? null });
      return;
    }
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.urNav) return;
        setUrNav({
          enabled: Boolean(d.urNav.enabled),
          matchDayId: d.urNav.matchDayId ?? null,
        });
      })
      .catch(() => {
        /* ignore — hide U&R until known */
      });
    return () => {
      cancelled = true;
    };
  }, [showUr, urMatchDayId]);

  const items = useMemo(() => {
    const list = [...baseItems];
    if (urNav?.enabled) {
      const href = urNav.matchDayId
        ? `/show/${urNav.matchDayId}`
        : "/dashboard#ur";
      list.splice(2, 0, {
        href,
        label: "U&R",
        icon: Clapperboard,
        match: (p: string) => p.startsWith("/show"),
      });
    }
    return list;
  }, [urNav]);

  function onNavClick(e: { preventDefault(): void }, href: string) {
    const hashIdx = href.indexOf("#");
    if (hashIdx < 0) return;
    const path = href.slice(0, hashIdx) || "/dashboard";
    const hash = href.slice(hashIdx + 1);
    const onSamePath =
      pathname === path || (path === "/dashboard" && pathname === "/dashboard");
    if (!onSamePath) return;
    e.preventDefault();
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      try {
        history.replaceState(null, "", `#${hash}`);
      } catch {
        /* ignore */
      }
    }
  }

  return (
    <aside
      data-app-sidebar
      className={cn(
        "desk-chrome relative z-20 flex w-[3.25rem] shrink-0 flex-col border-r border-[var(--border)] bg-[#0f1319]",
        "sticky top-14 h-[calc(100dvh-3.5rem)] dark:bg-[#0f1319]",
        "md:w-[11.5rem]"
      )}
      aria-label="App navigation"
    >
      <div className="flex items-center justify-between gap-1 border-b border-[var(--border)] px-2 py-2">
        <span className="hidden truncate px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] md:inline">
          CoComms
        </span>
        <span className="sr-only md:hidden">CoComms</span>
        {liveCount > 0 ? (
          <span
            className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-[var(--live-soft)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--live)] md:ml-0"
            title={`${liveCount} live`}
          >
            <Radio className="h-2.5 w-2.5" />
            <span className="hidden md:inline">{liveCount}</span>
          </span>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-1.5" aria-label="Hub sections">
        <ul className="flex flex-col gap-0.5 px-1.5">
          {items.map((item) => {
            const active =
              item.label === "U&R"
                ? pathname.startsWith("/show")
                : item.match(pathname);
            const Icon = item.icon;
            return (
              <li key={`${item.label}-${item.href}`}>
                <Link
                  href={item.href}
                  title={item.label}
                  onClick={(e) => onNavClick(e, item.href)}
                  className={cn(
                    "focus-ring group relative flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-[11px] font-semibold tracking-tight transition-[color,background-color,box-shadow] duration-150",
                    "justify-center md:justify-start",
                    active
                      ? "bg-[var(--surface-muted)] text-[var(--foreground)] shadow-[inset_2px_0_0_0_var(--brand)] dark:text-[var(--brand)]"
                      : "text-[var(--muted)] hover:bg-[var(--surface-muted)]/70 hover:text-[var(--foreground)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      active ? "opacity-100" : "opacity-60 group-hover:opacity-90"
                    )}
                  />
                  <span className="hidden truncate uppercase tracking-[0.06em] md:inline md:normal-case md:tracking-tight">
                    {item.label}
                  </span>
                  <span className="sr-only md:hidden">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
