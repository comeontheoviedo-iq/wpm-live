"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NOTE_CATEGORIES } from "@/lib/defaults";
import { Pin, Plus, Trash2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  | "club"
  | "hooks"
  | "bio"
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
  playerNameById,
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
  /** Optional map for grouping player notes */
  playerNameById?: Record<string, string>;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Custom");
  const [filter, setFilter] = useState<NotesFilterScope>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
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
    } else if (scope === "bio") {
      if (n.category !== "Bio" && n.category !== "Career") return false;
    } else if (scope !== "all") {
      if (n.category !== scope) return false;
    }
    return true;
  }

  const counts = useMemo(() => {
    const scopes: NotesFilterScope[] = [
      "all",
      "home",
      "away",
      "players",
      "match",
      "club",
      "hooks",
      "bio",
    ];
    const out: Record<string, number> = {};
    for (const s of scopes) {
      out[s] = notes.filter((n) => matchesScope(n, s)).length;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, entityId, entityType, homeSet, awaySet, homeClubId, awayClubId]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (!matchesScope(n, activeFilter)) return false;
      if (needle) {
        const hay = `${n.title} ${n.body} ${n.category}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
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
    if (!title.trim() || !body.trim()) return;
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
    { key: "home", label: "Home" },
    { key: "away", label: "Away" },
    { key: "players", label: "Players" },
    { key: "match", label: "Match" },
    { key: "club", label: "Club" },
    { key: "hooks", label: "Hooks" },
    { key: "bio", label: "Bio" },
  ];

  function NoteCard({ n }: { n: NoteRow }) {
    return (
      <div className="rounded-lg border border-slate-100 dark:border-slate-800 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
              {n.title}
              <span className="ml-2 text-[10px] font-normal text-slate-400">
                {n.category}
                {n.pinned ? " · pinned" : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {n.body}
            </p>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-amber-500"
              onClick={() => togglePin(n.id, n.pinned)}
              aria-label="Pin"
            >
              <Pin
                className={cn(
                  "h-3.5 w-3.5",
                  n.pinned && "fill-amber-400 text-amber-500"
                )}
              />
            </button>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-rose-500"
              onClick={() => remove(n.id)}
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(fillHeight && "h-full flex flex-col overflow-hidden")}>
      <CardHeader className="shrink-0">
        <CardTitle className="flex items-center justify-between gap-2">
          <span>
            Notes
            {entityLabel ? (
              <span className="ml-2 text-xs font-normal text-slate-500">
                · {entityLabel}
              </span>
            ) : null}
          </span>
          <span className="text-[10px] font-normal text-slate-400">
            {visible.length}
            <span className="ml-1 opacity-60">(/ search)</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody
        className={cn(
          "space-y-3",
          fillHeight && "flex-1 min-h-0 flex flex-col overflow-hidden"
        )}
      >
        <div
          className={cn(
            "shrink-0 space-y-2 bg-white/95 dark:bg-slate-950/95 backdrop-blur z-10",
            fillHeight && "sticky top-0 pb-1"
          )}
        >
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes… (/)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent pl-7 pr-2 py-1 text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {scopeChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setScope(c.key)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] border inline-flex items-center gap-1",
                  activeFilter === c.key
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-slate-200 dark:border-slate-700"
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
            {NOTE_CATEGORIES.filter(
              (c) => !["Hook", "Bio", "Funfact", "Career", "Match"].includes(c)
            ).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setScope(c)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] border",
                  activeFilter === c
                    ? "bg-teal-600 text-white border-teal-600"
                    : "border-slate-200 dark:border-slate-700"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "space-y-2 overflow-y-auto",
            fillHeight ? "flex-1 min-h-0" : "max-h-64"
          )}
        >
          {visible.length === 0 && (
            <p className="text-xs text-slate-500">No notes yet.</p>
          )}
          {grouped
            ? grouped.map(([pid, list]) => (
                <div key={pid} className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 sticky top-0 bg-white/90 dark:bg-slate-950/90 py-0.5">
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

        {!compact && (
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 shrink-0">
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs min-h-[64px]"
              placeholder="Note body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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
                disabled={pending}
                className="ml-auto"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add note
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
