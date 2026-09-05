"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Settings,
  Printer,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { Logo } from "./logo";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function AppHeader({
  user,
  matchId,
}: {
  user: { name: string; avatarInitials: string };
  matchId?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolved, setTheme } = useTheme();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navLink = (href: string, label: string) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        href={href}
        className={cn(
          "focus-ring interactive-press rounded-lg px-3 py-1.5 text-desk-sm font-medium",
          active
            ? "bg-teal-50 text-teal-700 shadow-xs ring-1 ring-teal-200/70 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-800/60"
            : "text-slate-600 hover:bg-slate-100/90 dark:text-slate-300 dark:hover:bg-slate-800/90"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 shadow-xs backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/85">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-3 sm:px-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-slate-600 md:flex dark:text-slate-300">
          {navLink("/dashboard", "Desk")}
          {navLink("/pricing", "Pricing")}
          {navLink("/settings", "Settings")}
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <IconBtn ariaLabel="Search">
            <Search className="h-4 w-4" />
          </IconBtn>
          {matchId && (
            <Link
              href={`/match-day/${matchId}/print`}
              className="focus-ring interactive-press rounded-lg p-2 text-slate-500 hover:bg-slate-100/90 dark:hover:bg-slate-800/90"
              aria-label="Print"
            >
              <Printer className="h-4 w-4" />
            </Link>
          )}
          <IconBtn
            ariaLabel="Toggle theme"
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
          >
            {resolved === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </IconBtn>
          <Link
            href="/settings"
            className="focus-ring interactive-press rounded-lg p-2 text-slate-500 hover:bg-slate-100/90 dark:hover:bg-slate-800/90"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-[11px] font-bold text-white shadow-sm shadow-teal-900/25 ring-2 ring-white/70 dark:ring-slate-900/80">
            {user.avatarInitials}
          </div>
          <IconBtn ariaLabel="Log out" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </header>
  );
}

function IconBtn({
  children,
  ariaLabel,
  onClick,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  onClick?: () => void;
}) {
  return (
    <button
      className="focus-ring interactive-press rounded-lg p-2 text-slate-500 hover:bg-slate-100/90 dark:hover:bg-slate-800/90"
      aria-label={ariaLabel}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
