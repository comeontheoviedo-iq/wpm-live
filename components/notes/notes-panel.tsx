"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NOTE_CATEGORIES } from "@/lib/defaults";
import { Pin, Plus, Trash2 } from "lucide-react";
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

export function NotesPanel({
  matchId,
  entityType,
  entityId,
  entityLabel,
  initialNotes,
  compact,
}: {
  matchId: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string;
  initialNotes: NoteRow[];
  compact?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("Custom");
  const [filter, setFilter] = useState<string>("all");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const visible = useMemo(() => {
    return notes.filter((n) => {
      if (entityId && n.entityId && n.entityId !== entityId) {
        // still show match-level notes when filtering to a player? show both
      }
      if (entityId) {
        const isEntity = n.entityId === entityId;
        const isMatchLevel = !n.entityId || n.entityType === "match";
        if (!(isEntity || (isMatchLevel && !entityType))) {
          if (!isEntity) return false;
        }
        if (entityType === "player") return isEntity;
      }
      if (filter === "all") return true;
      return n.category === filter;
    });
  }, [notes, filter, entityId, entityType]);

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>
            Notes
            {entityLabel ? (
              <span className="ml-2 text-xs font-normal text-slate-500">
                · {entityLabel}
              </span>
            ) : null}
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] border",
              filter === "all"
                ? "bg-teal-600 text-white border-teal-600"
                : "border-slate-200 dark:border-slate-700"
            )}
          >
            All
          </button>
          {NOTE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] border",
                filter === c
                  ? "bg-teal-600 text-white border-teal-600"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {visible.length === 0 && (
            <p className="text-xs text-slate-500">No notes yet.</p>
          )}
          {visible.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-slate-100 dark:border-slate-800 p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                    {n.title}
                    <span className="ml-2 text-[10px] font-normal text-slate-400">
                      {n.category}
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
                      className={cn("h-3.5 w-3.5", n.pinned && "fill-amber-400 text-amber-500")}
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
          ))}
        </div>

        {!compact && (
          <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
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
