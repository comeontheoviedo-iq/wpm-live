"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function MatchDayError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[match-day error]", error?.message, error?.digest, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-100">
        Match desk failed to load
      </h1>
      <p className="text-sm text-slate-400">
        A server or client error interrupted this desk. If you just moved to
        Cloudflare, this is often a missing env (AUTH_SECRET / DATABASE_URL) or
        a Worker crash — check the browser console for details.
      </p>
      {error?.digest ? (
        <p className="font-mono text-xs text-slate-500">digest {error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-md bg-amber-500/90 px-3 py-1.5 text-sm font-medium text-slate-950"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
        >
          Back to boards
        </Link>
      </div>
    </div>
  );
}
