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
import { AskReportButton } from "@/components/feedback/ask-report-modal";
import { WhatsNewButton } from "@/components/whats-new/whats-new-button";

export function AppHeader({
  user,
  matchId,
}: {
  user: { name: string; avatarInitials: string; image?: string | null };
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
            <WhatsNewButton />
            <Link
              href="/settings"
              className="focus-ring interactive-press rounded-[2px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              aria-label="Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/settings"
              className="ml-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-[2px] bg-[var(--surface-elevated)] text-[10px] font-bold text-[var(--foreground)] ring-1 ring-[var(--border)]"
              aria-label={`${user.name} profile`}
              title={user.name}
            >
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                user.avatarInitials
              )}
            </Link>
            <IconBtn ariaLabel="Log out" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
            </IconBtn>
          </div>
        </div>
      </header>
      <AskReportButton deskContext={matchId ? { matchId } : null} />
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
