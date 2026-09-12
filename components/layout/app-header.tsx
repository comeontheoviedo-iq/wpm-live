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
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0f1319] shadow-none">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
          <Logo />
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {t("header.commentaryDesk")}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <IconBtn ariaLabel="Search">
              <Search className="h-4 w-4" />
            </IconBtn>
            {matchId && (
              <Link
                href={`/match-day/${matchId}/print`}
                className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
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
              className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] text-[11px] font-bold text-[var(--foreground)] ring-1 ring-[var(--border)]">
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
      className="focus-ring interactive-press rounded-[var(--radius-sm)] p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
      aria-label={ariaLabel}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
