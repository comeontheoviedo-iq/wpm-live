"use client";

import { useEffect } from "react";
import { DESK_HOTKEY_HELP } from "@/lib/desk-hotkeys";
import { ModalHeader } from "@/components/ui/modal-header";

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
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
        aria-label="Close help"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Desk hotkeys"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg animate-slide-up dark:border-slate-700 dark:bg-slate-950"
      >
        <ModalHeader
          title={<span className="text-sm font-bold sm:text-sm">Desk hotkeys</span>}
          subtitle="Esc / ? to close · never fire while typing"
          onClose={onClose}
          closeLabel="Close help"
        />
        <ul className="space-y-1.5 p-4 text-[12px]">
          {DESK_HOTKEY_HELP.map((row) => (
            <li key={row.key} className="flex gap-3">
              <kbd className="shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold min-w-[3.5rem] text-center">
                {row.key}
              </kbd>
              <span className="text-slate-700 dark:text-slate-200">{row.action}</span>
            </li>
          ))}
        </ul>
        <p className="px-4 pb-4 text-[10px] text-slate-400">
          Hotkeys never fire while typing in inputs or editors.
        </p>
      </div>
    </div>
  );
}
