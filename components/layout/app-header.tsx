"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useLocale } from "@/components/i18n/locale-provider";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";

export function AppHeader({
  user,
  matchId,
}: {
  user: { name: string; avatarInitials: string };
  matchId?: string;
}) {
  const router = useRouter();
  const { resolved, setTheme } = useTheme();
  const { t } = useLocale();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="app-topbar sticky top-0 z-40">
        <div className="mx-auto flex h-11 max-w-[1600px] items-center gap-2.5 px-3 sm:px-4">
          <Logo />
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="h-3 w-px bg-[var(--border-strong)]" aria-hidden />
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
              {t("header.commentaryDesk")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <IconBtn ariaLabel="Search">
              <Search className="h-3.5 w-3.5" />
            </IconBtn>
            {matchId && (
              <Link
                href={`/match-day/${matchId}/print`}
                className="focus-ring interactive-press rounded-[2px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
                aria-label="Print"
              >
                <Printer className="h-3.5 w-3.5" />
              </Link>
            )}
            <IconBtn
              ariaLabel="Toggle theme"
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
            >
              {resolved === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </IconBtn>
            <Link
              href="/settings"
              className="focus-ring interactive-press rounded-[2px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
            <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-[2px] bg-[var(--surface-elevated)] text-[10px] font-bold text-[var(--foreground)] ring-1 ring-[var(--border)]">
              {user.avatarInitials}
            </div>
            <IconBtn ariaLabel="Log out" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
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
      className="focus-ring interactive-press rounded-[2px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
      aria-label={ariaLabel}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
