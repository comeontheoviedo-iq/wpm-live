/**
 * LIVE desk hotkeys — ignore when typing in inputs/contenteditable.
 */

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[data-hotkeys-ignore='true']")) return true;
  return false;
}

export type DeskHotkeyHandlers = {
  onFocusNotesSearch?: () => void;
  onReopenLastGoal?: () => void;
  onSwapSides?: () => void;
  onOpenShirt?: (shirt: number) => void;
  onToggleHelp?: () => void;
  onToggleOnAirMode?: () => void;
};

export const DESK_HOTKEY_HELP: { key: string; action: string }[] = [
  { key: "O", action: "Toggle On-air mode (slim chrome · pitch hero)" },
  { key: "/", action: "Focus notes search" },
  { key: "G", action: "Re-open last goal card" },
  { key: "S", action: "Swap sides (home left ↔ right)" },
  { key: "1–9 / 0", action: "Open shirt dossier (pitch focus; 0 = #10)" },
  { key: "?", action: "Show / hide this help" },
  { key: "Esc", action: "Close help / cancel place" },
];

/** Bind window keydown. Returns cleanup. */
export function bindDeskHotkeys(handlers: DeskHotkeyHandlers): () => void {
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;

    const key = e.key;

    if (key === "?" || (key === "/" && e.shiftKey)) {
      e.preventDefault();
      handlers.onToggleHelp?.();
      return;
    }
    if (key === "/") {
      e.preventDefault();
      handlers.onFocusNotesSearch?.();
      return;
    }
    if (key === "g" || key === "G") {
      e.preventDefault();
      handlers.onReopenLastGoal?.();
      return;
    }
    if (key === "s" || key === "S") {
      e.preventDefault();
      handlers.onSwapSides?.();
      return;
    }
    if (key === "o" || key === "O") {
      e.preventDefault();
      handlers.onToggleOnAirMode?.();
      return;
    }
    if (/^[0-9]$/.test(key)) {
      const n = key === "0" ? 10 : Number(key);
      e.preventDefault();
      handlers.onOpenShirt?.(n);
      return;
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
