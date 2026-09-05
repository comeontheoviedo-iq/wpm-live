"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  matchDayId: string;
  /** e.g. "Newcastle vs Bournemouth" — shown in the confirm title */
  matchLabel: string;
  /** list = dashboard row action; overflow = desk ⋯ menu */
  variant?: "list" | "overflow";
  className?: string;
};

export function DeleteMatchDesk({
  matchDayId,
  matchLabel,
  variant = "list",
  className,
}: Props) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!openMenu) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpenMenu(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  useEffect(() => {
    if (!confirmOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setConfirmOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen, pending]);

  function startConfirm() {
    setError(null);
    setOpenMenu(false);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/match-days/${matchDayId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not delete desk"
        );
      }
      setConfirmOpen(false);
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete desk");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {variant === "list" ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startConfirm();
          }}
          className={cn(
            "focus-ring interactive-press inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40",
            className
          )}
          aria-label={`Delete ${matchLabel}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      ) : (
        <div className={cn("relative", className)} ref={menuRef}>
          <button
            type="button"
            className="focus-ring interactive-press rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
            aria-label="Desk actions"
            aria-haspopup="menu"
            aria-expanded={openMenu}
            onClick={() => setOpenMenu((v) => !v)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {openMenu ? (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={startConfirm}
              >
                <Trash2 className="h-4 w-4" />
                Delete match desk
              </button>
            </div>
          ) : null}
        </div>
      )}

      {confirmOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Dismiss"
            disabled={pending}
            onClick={() => !pending && setConfirmOpen(false)}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-950"
          >
            <h2
              id={titleId}
              className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Delete {matchLabel}?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This permanently removes the match desk and all related notes,
              events, packs, and prep data. This cannot be undone.
            </p>
            {error ? (
              <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={confirmDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pending ? "Deleting…" : "Delete desk"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
