"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { NOTE_CATEGORIES } from "@/lib/defaults";
import { Pin, Plus, Trash2, Search } from "lucide-react";
import { cn, normalizeApostrophes } from "@/lib/utils";

export type NoteRow = {
  id: string;
  title: string;
  body: string;
  category: string;
  entityType: string | null;
  entityId: string | null;
  pinned: boolean;
};

export type NotesFilterScope =
  | "all"
  | "home"
  | "away"
  | "players"
  | "match"
  | "pinned"
  | "club"
  | "hooks"
  | "bio"
  | "relevant"
  | string;

export function NotesPanel({
  matchId,
  entityType,
  entityId,
  entityLabel,
  initialNotes,
  compact,
  homePlayerIds,
  awayPlayerIds,
  homeClubId,
  awayClubId,
  externalFilter,
  onFilterChange,
  fillHeight,
  liveMode,
  playerNameById,
  onNotePlayerClick,
  relevantNoteIds,
  relevantLoading,
}: {
  matchId: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string;
  initialNotes: NoteRow[];
  compact?: boolean;
  homePlayerIds?: string[];
  awayPlayerIds?: string[];
  homeClubId?: string;
  awayClubId?: string;
  externalFilter?: NotesFilterScope;
  onFilterChange?: (f: NotesFilterScope) => void;
  fillHeight?: boolean;
  /** LIVE desk: denser rows, sticky add, match/pinned first */
  liveMode?: boolean;
  /** Optional map for grouping player notes */
  playerNameById?: Record<string, string>;
  /** Click player-linked note → highlight on pitch / open dossier */
  onNotePlayerClick?: (playerId: string) => void;
  /** LIVE: note ids ranked relevant to current match events */
  relevantNoteIds?: string[];
  /** Show loading pulse on Relevant now chip */
  relevantLoading?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Custom");
  const [filter, setFilter] = useState<NotesFilterScope>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeFilter = externalFilter ?? filter;

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function setScope(f: NotesFilterScope) {
    if (onFilterChange) onFilterChange(f);
    else setFilter(f);
  }

  const homeSet = useMemo(
    () => new Set(homePlayerIds || []),
    [homePlayerIds]
  );
  const awaySet = useMemo(
    () => new Set(awayPlayerIds || []),
    [awayPlayerIds]
  );
  const relevantSet = useMemo(
    () => new Set(relevantNoteIds || []),
    [relevantNoteIds]
  );

  function matchesScope(n: NoteRow, scope: NotesFilterScope) {
    if (entityId && entityType === "player") {
      if (n.entityId !== entityId) return false;
    }
    if (scope === "home") {
      if (!(n.entityId && homeSet.has(n.entityId)) && n.entityId !== homeClubId)
        return false;
    } else if (scope === "away") {
      if (!(n.entityId && awaySet.has(n.entityId)) && n.entityId !== awayClubId)
        return false;
    } else if (scope === "players") {
      if (n.entityType !== "player") return false;
    } else if (scope === "match") {
      if (
        n.entityType &&
        n.entityType !== "match" &&
        n.category !== "Match"
      )
        return false;
      if (n.entityType === "player") return false;
    } else if (scope === "club") {
      if (
        n.entityType !== "club" &&
        n.entityId !== homeClubId &&
        n.entityId !== awayClubId
      )
        return false;
    } else if (scope === "hooks") {
      if (n.category !== "Hook" && n.category !== "Funfact") return false;
    } else if (scope === "pinned") {
      if (!n.pinned) return false;
    } else if (scope === "bio") {
      if (n.category !== "Bio" && n.category !== "Career") return false;
    } else if (scope === "relevant") {
      if (!relevantSet.has(n.id)) return false;
    } else if (scope !== "all") {
      if (n.category !== scope) return false;
    }
    return true;
  }


  function isLiveEventNote(n: NoteRow): boolean {
    if (n.category === "Match" && n.pinned) return true;
    const t = `${normalizeApostrophes(n.title)} ${normalizeApostrophes(n.body)}`.toLowerCase();
    return (
      n.category === "Match" &&
      (/\d+'/.test(n.title) ||
        /\b(goal|penalt|yellow|red|sub|card|var)\b/i.test(t))
    );
  }

  function noteRank(n: NoteRow): number {
    if (relevantSet.has(n.id)) return -1;
    if (n.pinned) return 0;
    if (isLiveEventNote(n)) return 1;
    if (n.category === "Hook" || n.category === "Funfact") return 2;
    if (n.category === "Bio" || n.category === "Career") return 4;
    return 3;
  }

  const counts = useMemo(() => {
    const scopes: NotesFilterScope[] = [
      "all",
      "relevant",
      "pinned",
      "match",
      "home",
      "away",
      "players",
      "bio",
      "hooks",
      "club",
    ];
    const out: Record<string, number> = {};
    for (const s of scopes) {
      out[s] = notes.filter((n) => matchesScope(n, s)).length;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, entityId, entityType, homeSet, awaySet, homeClubId, awayClubId, relevantSet]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = notes.filter((n) => {
      if (!matchesScope(n, activeFilter)) return false;
      if (needle) {
        const hay = `${normalizeApostrophes(n.title)} ${normalizeApostrophes(n.body)} ${n.category} ${
          (n.entityId && playerNameById?.[n.entityId]) || ""
        }`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const ra = noteRank(a);
      const rb = noteRank(b);
      if (ra !== rb) return ra - rb;
      return Number(b.pinned) - Number(a.pinned);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    notes,
    activeFilter,
    entityId,
    entityType,
    homeSet,
    awaySet,
    homeClubId,
    awayClubId,
    search,
    playerNameById,
    relevantSet,
  ]);

  const grouped = useMemo(() => {
    if (activeFilter !== "players" || entityType === "player") return null;
    const map = new Map<string, NoteRow[]>();
    for (const n of visible) {
      const key = n.entityId || "unknown";
      const list = map.get(key) || [];
      list.push(n);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => {
      const an =
        playerNameById?.[a[0]] ||
        a[1][0]?.title ||
        a[0];
      const bn =
        playerNameById?.[b[0]] ||
        b[1][0]?.title ||
        b[0];
      return an.localeCompare(bn);
    });
  }, [visible, activeFilter, entityType, playerNameById]);

  async function createNote() {
    if (!title.trim()) return;
    setPending(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          title: title.trim(),
          body: body.trim(),
          category,
          entityType: entityType || "match",
          entityId: entityId || matchId,
          pinned: false,
        }),
      });
      const json = await res.json();
      if (json.note) {
        setNotes((prev) => [json.note, ...prev]);
        setTitle("");
        setBody("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    const json = await res.json();
    if (json.note) {
      setNotes((prev) =>
        prev
          .map((n) => (n.id === id ? json.note : n))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned))
      );
    }
  }

  async function remove(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
    router.refresh();
  }

  const scopeChips: { key: NotesFilterScope; label: string }[] = [
    { key: "all", label: "All" },
    {
      key: "relevant",
      label: relevantLoading
        ? "Relevant…"
        : `Relevant now${relevantSet.size ? ` (${relevantSet.size})` : ""}`,
    },
    { key: "pinned", label: "Pinned" },
    { key: "match", label: "Match" },
    { key: "home", label: "Home" },
    { key: "away", label: "Away" },
    { key: "players", label: "Players" },
    { key: "bio", label: "Bio" },
    { key: "hooks", label: "Hooks" },
  ];

  function parseNoteMinute(title: string): {
    minute: string | null;
    sayable: string;
  } {
    const raw = normalizeApostrophes(title).trim();
    const lead = raw.match(/^(\d{1,3}(?:\+\d{1,2})?)\s*['′']\s*(.*)$/);
    if (lead) {
      const rest = lead[2].trim();
      return {
        minute: `${lead[1]}'`,
        sayable: rest || raw,
      };
    }
    const mid = raw.match(/(\d{1,3}(?:\+\d{1,2})?)\s*['′']/);
    if (mid) {
      return { minute: `${mid[1]}'`, sayable: raw };
    }
    return { minute: null, sayable: raw };
  }

  function noteSeverityClass(n: NoteRow): string {
    // Event severity wins over pin/relevant so MATCH goals stay green (--edge-goal)
    const t = `${normalizeApostrophes(n.title)} ${normalizeApostrophes(n.body)}`.toLowerCase();
    const isMatch = n.category === "Match" || isLiveEventNote(n);
    if (
      /\b(own\s*goal|goal|scored)\b/.test(t) ||
      (isMatch && /\b(og|own.?goal)\b/.test(t))
    )
      return "queue-row-goal";
    if (/\bred\b/.test(t)) return "queue-row-red";
    if (/\byellow\b|\bcard\b/.test(t)) return "queue-row-card";
    if (/\binjur|stretcher/.test(t)) return "queue-row-injury";
    if (/\bsub(stitution)?\b/.test(t)) return "queue-row-sub";
    if (relevantSet.has(n.id)) return "queue-row-now";
    if (n.pinned) return "queue-row-pin";
    if (isLiveEventNote(n)) return "queue-row-live";
    if (n.category === "Hook" || n.category === "Funfact") return "queue-row-fact";
    return "";
  }

  function NoteCard({ n }: { n: NoteRow }) {
    const playerLinked =
      n.entityType === "player" && n.entityId && onNotePlayerClick;
    const playerName =
      (n.entityId && playerNameById?.[n.entityId]) || null;
    const expanded = expandedId === n.id;
    const { minute, sayable } = parseNoteMinute(n.title);
    const severity = noteSeverityClass(n);
    // Dense call-queue: collapsed = title row only (~36–40px); body on expand
    const showBody = expanded || !liveMode;

    return (
      <div
        className={cn(
          "queue-row cursor-pointer",
          liveMode && "px-1.5",
          severity,
          expanded && "queue-row-active",
          playerLinked && "hover:border-white/20"
        )}
        onClick={() => {
          setExpandedId((cur) => (cur === n.id ? null : n.id));
        }}
        role="button"
        aria-expanded={expanded}
        title={expanded ? "Collapse note" : "Expand note"}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="note-queue-minute shrink-0"
            aria-hidden={minute ? undefined : true}
          >
            {minute || "·"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className={cn(
                  "note-queue-title min-w-0 flex-1",
                  expanded ? "whitespace-normal" : "truncate"
                )}
              >
                {sayable}
              </div>
              <span
                className="note-queue-chip shrink-0"
                title={[
                  n.category,
                  n.pinned ? "pin" : null,
                  relevantSet.has(n.id) ? "now" : null,
                  playerName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              >
                {n.category}
              </span>
              <div
                className="flex gap-0.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="p-0.5 text-slate-500 hover:text-amber-400"
                  onClick={() => togglePin(n.id, n.pinned)}
                  aria-label="Pin note"
                >
                  <Pin
                    className={cn(
                      "h-3 w-3",
                      n.pinned && "fill-amber-400 text-amber-400"
                    )}
                  />
                </button>
                <button
                  type="button"
                  className="p-0.5 text-slate-500 hover:text-rose-400"
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            {showBody && (
              <p
                className={cn(
                  "note-queue-body mt-1 whitespace-pre-wrap",
                  !expanded && "line-clamp-2"
                )}
              >
                {normalizeApostrophes(n.body)}
              </p>
            )}
            {expanded && (playerName || n.pinned || relevantSet.has(n.id)) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {playerName ? (
                  <span className="note-queue-chip">{playerName}</span>
                ) : null}
                {relevantSet.has(n.id) ? (
                  <span className="note-queue-chip">now</span>
                ) : null}
                {n.pinned ? <span className="note-queue-chip">pin</span> : null}
              </div>
            )}
            {expanded && playerLinked && n.entityId && (
              <button
                type="button"
                className="mt-1.5 text-[10px] font-semibold text-slate-300 hover:text-white hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onNotePlayerClick?.(n.entityId!);
                }}
              >
                Open player profile
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        fillHeight && "h-full flex flex-col overflow-hidden",
        (fillHeight || liveMode) && "notes-rail-shell rounded-[2px]"
      )}
    >
      <CardHeader
        className={cn(
          "shrink-0",
          fillHeight && "px-2.5 py-1.5",
          (fillHeight || liveMode) && "border-white/[0.06] bg-[#0a0d12]"
        )}
      >
        <CardTitle className="flex items-center justify-between gap-2 text-xs">
          <span>
            Notes
            {entityLabel ? (
              <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                · {entityLabel}
              </span>
            ) : null}
          </span>
          <span className="text-[10px] font-normal text-slate-500 tabular-nums">
            {visible.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody
        className={cn(
          "space-y-2",
          fillHeight && "flex-1 min-h-0 flex flex-col overflow-hidden p-2",
          (fillHeight || liveMode) && "bg-[#0e1218]"
        )}
      >
        <div
          className={cn(
            "shrink-0 space-y-1 z-10 pb-1 border-b",
            fillHeight && "sticky top-0",
            fillHeight || liveMode
              ? "bg-[#0e1218] border-white/[0.06]"
              : "bg-[var(--surface)] border-[var(--border)]"
          )}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
            <input
              ref={searchRef}
              data-pitchline-notes-search="1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes… press /"
              aria-label="Search notes"
              className="w-full rounded-[2px] border border-white/10 bg-[#0a0d12] pl-7 pr-2 py-0.5 text-[11px] text-slate-200 placeholder:text-slate-600"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
            {scopeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setScope(c.key)}
                className={cn(
                  "shrink-0 rounded-[2px] px-1.5 py-0.5 text-[9px] border inline-flex items-center gap-0.5 font-semibold tabular-nums tracking-wide",
                  activeFilter === c.key
                    ? "bg-slate-200 text-[#0a0d12] border-slate-200"
                    : c.key === "relevant"
                      ? "border-[var(--edge-break)]/35 text-[var(--edge-break)]"
                      : "border-white/10 text-slate-500"
                )}
              >
                {c.label}
                <span
                  className={cn(
                    "rounded-[2px] px-1 text-[9px] tabular-nums",
                    activeFilter === c.key
                      ? "bg-black/15"
                      : "bg-[#0a0d12] text-slate-500"
                  )}
                >
                  {counts[c.key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Sticky compact composer — quiet call-queue craft, fully functional */}
          {(fillHeight || liveMode || !compact) && (
            <div className="notes-composer space-y-0.5 pt-0.5">
              <label className="notes-composer-label" htmlFor="notes-composer-title">
                Title
              </label>
              <input
                id="notes-composer-title"
                className="notes-composer-input"
                placeholder="Sayable line…"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="New note title"
              />
              <label className="notes-composer-label" htmlFor="notes-composer-body">
                Body
              </label>
              <textarea
                id="notes-composer-body"
                className={cn(
                  "notes-composer-input notes-composer-body",
                  liveMode ? "min-h-[36px]" : "min-h-[48px]"
                )}
                placeholder="Detail…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label="New note body"
              />
              <div className="flex items-center gap-1 pt-0.5">
                <select
                  className="notes-composer-input notes-composer-select min-w-0 flex-1"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="Note category"
                  title="Note category"
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={createNote}
                  disabled={pending || !title.trim() || !body.trim()}
                  className="notes-composer-add shrink-0"
                  aria-label="Add note"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "overflow-y-auto",
            liveMode ? "space-y-0.5" : "space-y-1",
            fillHeight ? "flex-1 min-h-0" : "max-h-64"
          )}
        >
          {visible.length === 0 && (
            <p className="text-xs text-slate-500">No notes yet.</p>
          )}
          {grouped
            ? grouped.map(([pid, list]) => (
                <div key={pid} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[var(--tracking-label)] text-slate-500 sticky top-0 bg-[#0e1218] py-0.5">
                    {playerNameById?.[pid] || list[0]?.title || "Player"}{" "}
                    <span className="font-normal normal-case">
                      ({list.length})
                    </span>
                  </div>
                  {list.map((n) => (
                    <NoteCard key={n.id} n={n} />
                  ))}
                </div>
              ))
            : visible.map((n) => <NoteCard key={n.id} n={n} />)}
        </div>
      </CardBody>
    </Card>
  );
}
