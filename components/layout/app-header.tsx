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

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-3 sm:px-4">
        <Logo />
        <nav className="hidden md:flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
          <Link
            href="/dashboard"
            className={cn(
              "rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800",
              pathname.startsWith("/dashboard") &&
                "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            )}
          >
            Desk
          </Link>
          <Link
            href="/pricing"
            className={cn(
              "rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800",
              pathname.startsWith("/pricing") &&
                "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            )}
          >
            Pricing
          </Link>
          <Link
            href="/settings"
            className={cn(
              "rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800",
              pathname.startsWith("/settings") &&
                "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            )}
          >
            Settings
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Search"
            type="button"
          >
            <Search className="h-4 w-4" />
          </button>
          {matchId && (
            <Link
              href={`/match-day/${matchId}/print`}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Print"
            >
              <Printer className="h-4 w-4" />
            </Link>
          )}
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
          >
            {resolved === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <Link
            href="/settings"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
            {user.avatarInitials}
          </div>
          <button
            onClick={logout}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            type="button"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
