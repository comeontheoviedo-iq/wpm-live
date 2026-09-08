"use client";

import { useState } from "react";

/**
 * Profile VERDICT — truncated by default; click expands to full text.
 */
export function VerdictBlock({
  line,
  sub,
  fullBody,
}: {
  line: string;
  sub?: string | null;
  /** Full note body when available — shown when expanded */
  fullBody?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const hasMore =
    !!(fullBody && fullBody.trim() && fullBody.trim() !== (sub || "").trim()) ||
    !!(sub && sub.length >= 160);

  return (
    <button
      type="button"
      className="player-dossier-verdict w-full text-left cursor-pointer"
      data-dossier-verdict="1"
      data-verdict-open={open ? "1" : "0"}
      aria-expanded={open}
      title={open ? "Collapse verdict" : hasMore ? "Expand full verdict" : undefined}
      onClick={() => setOpen((v) => !v)}
    >
      <div className="player-dossier-verdict-label">
        Verdict{hasMore ? (open ? " · tap to collapse" : " · tap to expand") : ""}
      </div>
      <div className="player-dossier-verdict-line">{line}</div>
      {open && fullBody?.trim() ? (
        <div className="player-dossier-verdict-sub whitespace-pre-wrap">
          {fullBody.trim()}
        </div>
      ) : sub ? (
        <div
          className={
            open
              ? "player-dossier-verdict-sub whitespace-pre-wrap"
              : "player-dossier-verdict-sub"
          }
        >
          {sub}
          {!open && hasMore ? "…" : ""}
        </div>
      ) : null}
    </button>
  );
}
