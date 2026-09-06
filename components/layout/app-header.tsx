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
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

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
          "focus-ring interactive-press rounded-[var(--radius-sm)] px-2.5 py-1.5 text-desk-sm font-semibold tracking-tight",
          active
            ? "bg-[var(--surface-muted)] text-slate-900 ring-1 ring-[var(--border-strong)] dark:text-slate-100"
            : "text-slate-600 hover:bg-[var(--surface-muted)] dark:text-slate-300"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)] shadow-none dark:border-[var(--border)]">
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
              className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
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
            className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--foreground)] text-[11px] font-bold text-[var(--surface)] shadow-xs ring-2 ring-[var(--border)]">
            {user.avatarInitials}
          </div>
          <IconBtn ariaLabel="Log out" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
    </header>
      <FeedbackWidget matchId={matchId} />
    </>
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
      className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)]"
      aria-label={ariaLabel}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
