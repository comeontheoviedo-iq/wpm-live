"use client";

import type { MouseEvent } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  speechLangFromNationality,
  speakPronunciation,
} from "@/lib/speech-lang";

/** Obvious TTS control for player / coach / club / referee names. */
export function SpeakNameButton({
  text,
  phonetic,
  nationality,
  className,
  compact = false,
  label = "Speak",
}: {
  text: string;
  /** IPA / phonetic override when set — spoken instead of display name. */
  phonetic?: string | null;
  nationality?: string | null;
  className?: string;
  /** Icon-only (pitch chips). */
  compact?: boolean;
  label?: string;
}) {
  const spoken = (phonetic || "").trim() || (text || "").trim();
  if (!spoken) return null;

  function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    speakPronunciation(spoken, speechLangFromNationality(nationality));
  }

  const tip = phonetic?.trim()
    ? `Speak pronunciation · ${phonetic.trim()}`
    : `Speak · ${spoken}`;

  return (
    <button
      type="button"
      className={cn(
        compact ? "player-dossier-icon-btn focus-ring" : "player-dossier-action",
        className
      )}
      onClick={onClick}
      title={tip}
      aria-label={tip}
    >
      <Volume2 className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {compact ? null : label}
    </button>
  );
}
