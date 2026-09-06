"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  function NoteCard({ n }: { n: NoteRow }) {
    const playerLinked =
      n.entityType === "player" && n.entityId && onNotePlayerClick;
    const playerName =
      (n.entityId && playerNameById?.[n.entityId]) || null;
    const expanded = expandedId === n.id;
    return (
      <div
        className={cn(
          "queue-row cursor-pointer",
          liveMode && "py-0.5 px-1.5",
          n.pinned && "queue-row-pin",
          relevantSet.has(n.id) && !expanded && "queue-row-now",
          isLiveEventNote(n) && !n.pinned && !relevantSet.has(n.id) && "border-l-[3px] border-l-[var(--live)]",
          expanded && "queue-row-active",
          playerLinked && "hover:border-[var(--border-strong)]"
        )}
        onClick={() => {
          setExpandedId((cur) => (cur === n.id ? null : n.id));
        }}
        role="button"
        aria-expanded={expanded}
        title={expanded ? "Collapse note" : "Expand note"}
      >
        <div className="flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "font-semibold text-[var(--foreground)]",
                expanded && "text-[var(--brand)]",
                n.pinned && !expanded && "text-amber-100",
                expanded ? "whitespace-normal" : "truncate",
                liveMode ? "text-[10.5px] leading-tight" : "text-xs"
              )}
            >
              {normalizeApostrophes(n.title)}
              <span
                className={cn(
                  "ml-1.5 text-[8.5px] font-semibold uppercase tracking-[0.04em]",
                  n.pinned
                    ? "text-amber-400/90"
                    : expanded
                      ? "text-teal-400/80"
                      : "text-slate-500"
                )}
              >
                {n.category}
                {n.pinned ? " · pin" : ""}
                {relevantSet.has(n.id) ? " · now" : ""}
                {playerName ? ` · ${playerName}` : ""}
              </span>
            </div>
            <p
              className={cn(
                "text-slate-700 dark:text-slate-300 whitespace-pre-wrap",
                liveMode
                  ? "mt-0.5 text-[10px] leading-snug"
                  : "mt-1 text-xs",
                !expanded && (liveMode ? "line-clamp-2" : "line-clamp-3")
              )}
            >
              {normalizeApostrophes(n.body)}
            </p>
            {expanded && playerLinked && n.entityId && (
              <button
                type="button"
                className="mt-1.5 text-[10px] font-semibold text-[var(--brand-dark)] dark:text-[var(--brand)] hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onNotePlayerClick?.(n.entityId!);
                }}
              >
                Open player profile
              </button>
            )}
          </div>
          <div
            className="flex gap-0.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="p-0.5 text-slate-400 hover:text-amber-500"
              onClick={() => togglePin(n.id, n.pinned)}
              aria-label="Pin note"
            >
              <Pin
                className={cn(
                  "h-3 w-3",
                  n.pinned && "fill-amber-400 text-amber-500"
                )}
              />
            </button>
            <button
              type="button"
              className="p-0.5 text-slate-400 hover:text-rose-500"
              onClick={() => remove(n.id)}
              aria-label="Delete note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(fillHeight && "h-full flex flex-col overflow-hidden")}>
      <CardHeader className={cn("shrink-0", fillHeight && "px-2.5 py-1.5")}>
        <CardTitle className="flex items-center justify-between gap-2 text-xs">
          <span>
            Notes
            {entityLabel ? (
              <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                · {entityLabel}
              </span>
            ) : null}
          </span>
          <span className="text-[10px] font-normal text-[var(--muted)] tabular-nums">
            {visible.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody
        className={cn(
          "space-y-2",
          fillHeight && "flex-1 min-h-0 flex flex-col overflow-hidden p-2"
        )}
      >
        <div
          className={cn(
            "shrink-0 space-y-1 bg-[var(--surface)] z-10 pb-1 border-b border-[var(--border)]",
            fillHeight && "sticky top-0"
          )}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <input
              ref={searchRef}
              data-pitchline-notes-search="1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes… press /"
              aria-label="Search notes"
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-transparent pl-7 pr-2 py-0.5 text-[11px]"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 flex-nowrap">
            {scopeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setScope(c.key)}
                className={cn(
                  "shrink-0 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] border inline-flex items-center gap-0.5 font-semibold tabular-nums",
                  activeFilter === c.key
                    ? "bg-[var(--foreground)] text-[var(--surface)] border-[var(--foreground)]"
                    : c.key === "relevant"
                      ? "border-[var(--edge-break)]/40 text-[var(--edge-break)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)]"
                )}
              >
                {c.label}
                <span
                  className={cn(
                    "rounded-full px-1 text-[9px] tabular-nums",
                    activeFilter === c.key
                      ? "bg-white/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                  )}
                >
                  {counts[c.key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Sticky compact composer — always reachable during LIVE */}
          {(fillHeight || liveMode || !compact) && (
            <div className="space-y-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-1.5">
              <input
                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-[var(--surface)] px-1.5 py-1 text-[11px]"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-label="New note title"
              />
              <textarea
                className={cn(
                  "w-full rounded border border-slate-200 dark:border-slate-700 bg-[var(--surface)] px-1.5 py-1 text-[11px]",
                  liveMode ? "min-h-[40px]" : "min-h-[52px]"
                )}
                placeholder="Note body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                aria-label="New note body"
              />
              <div className="flex items-center gap-1.5">
                <select
                  className="min-w-0 flex-1 rounded border border-slate-200 dark:border-slate-700 bg-[var(--surface)] px-1.5 py-1 text-[11px]"
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
                <Button
                  size="sm"
                  onClick={createNote}
                  disabled={pending || !title.trim() || !body.trim()}
                  className="shrink-0 h-7 px-2 text-[11px]"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </Button>
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
                  <div className="text-[10px] font-bold uppercase tracking-[var(--tracking-label)] text-[var(--muted)] sticky top-0 bg-[var(--surface)] py-0.5">
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
