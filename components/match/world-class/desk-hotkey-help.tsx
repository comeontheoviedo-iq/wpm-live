"use client";

import { useEffect } from "react";
import { DESK_HOTKEY_HELP } from "@/lib/desk-hotkeys";

export function DeskHotkeyHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close help"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Desk hotkeys"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl p-4"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold">Desk hotkeys</h2>
          <button
            type="button"
            className="text-xs text-slate-500 hover:underline"
            onClick={onClose}
          >
            Esc / ?
          </button>
        </div>
        <ul className="space-y-1.5 text-[12px]">
          {DESK_HOTKEY_HELP.map((row) => (
            <li key={row.key} className="flex gap-3">
              <kbd className="shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold min-w-[3.5rem] text-center">
                {row.key}
              </kbd>
              <span className="text-slate-700 dark:text-slate-200">{row.action}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-slate-400">
          Hotkeys never fire while typing in inputs or editors.
        </p>
      </div>
    </div>
  );
}
