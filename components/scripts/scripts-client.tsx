"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SPEAK_TIMINGS } from "@/lib/defaults";
import { cn, displayText, normalizeApostrophes } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export type SpeakRow = {
  id: string;
  title: string;
  body: string;
  timing: string;
  order: number;
  status?: string;
};

const TIMING_LABEL: Record<string, string> = {
  "pre-match": "Pre match",
  kickoff: "Kickoff",
  "half-time": "Half time",
  "full-time": "Full time",
};

export function ScriptsClient({
  matchId,
  homeShort,
  awayShort,
  initialSpeaks,
}: {
  matchId: string;
  homeShort: string;
  awayShort: string;
  initialSpeaks: SpeakRow[];
}) {
  const router = useRouter();
  const [speaks, setSpeaks] = useState(initialSpeaks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftTiming, setDraftTiming] = useState<string>("pre-match");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newTiming, setNewTiming] = useState<string>("pre-match");

  useEffect(() => {
    setSpeaks(initialSpeaks);
  }, [initialSpeaks]);

  const byTiming = useMemo(() => {
    const map: Record<string, SpeakRow[]> = {};
    for (const t of SPEAK_TIMINGS) map[t] = [];
    for (const s of speaks) {
      const key = (SPEAK_TIMINGS as readonly string[]).includes(s.timing)
        ? s.timing
        : "pre-match";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    for (const t of Object.keys(map)) {
      map[t].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    }
    return map;
  }, [speaks]);

  function startEdit(s: SpeakRow) {
    setCreating(false);
    setEditingId(s.id);
    setDraftTitle(s.title);
    setDraftBody(s.body);
    setDraftTiming(s.timing);
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setMsg(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const title = normalizeApostrophes(draftTitle.trim());
    if (!title) {
      setMsg("Title is required.");
      return;
    }
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/speaks/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body: normalizeApostrophes(draftBody),
          timing: draftTiming,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(json.error || "Save failed"));
        return;
      }
      if (json.speak) {
        setSpeaks((prev) =>
          prev.map((s) => (s.id === editingId ? { ...s, ...json.speak } : s))
        );
        setEditingId(null);
        setMsg("Saved — protected from auto-distribute overwrite.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this script?")) return;
    setPending(true);
    try {
      await fetch(`/api/speaks/${id}`, { method: "DELETE" });
      setSpeaks((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setEditingId(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function createSpeak() {
    const title = normalizeApostrophes(newTitle.trim());
    if (!title) {
      setMsg("Title is required for a new script.");
      return;
    }
    setPending(true);
    setMsg(null);
    try {
      const res = await fetch("/api/speaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          title,
          body: normalizeApostrophes(newBody),
          timing: newTiming,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(json.error || "Create failed"));
        return;
      }
      if (json.speak) {
        setSpeaks((prev) => [...prev, json.speak]);
        setNewTitle("");
        setNewBody("");
        setCreating(false);
        setMsg("Script created.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function move(s: SpeakRow, dir: -1 | 1) {
    const group = byTiming[s.timing] || [];
    const idx = group.findIndex((x) => x.id === s.id);
    const swap = group[idx + dir];
    if (!swap) return;
    setPending(true);
    try {
      const [a, b] = await Promise.all([
        fetch(`/api/speaks/${s.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: swap.order }),
        }).then((r) => r.json()),
        fetch(`/api/speaks/${swap.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: s.order }),
        }).then((r) => r.json()),
      ]);
      setSpeaks((prev) =>
        prev.map((row) => {
          if (row.id === s.id && a.speak) return { ...row, ...a.speak };
          if (row.id === swap.id && b.speak) return { ...row, ...b.speak };
          return row;
        })
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Scripts</h2>
          <p className="text-sm text-[var(--muted)]">
            Timed commentary cues for {homeShort} vs {awayShort}. Edit freely —
            your changes are marked edited and kept when Research files prep
            or Official XI fills the lineup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setCreating((v) => !v);
              setEditingId(null);
              setMsg(null);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New script
          </Button>
          <a
            href={`/match-day/${matchId}/packs`}
            className="text-sm font-semibold text-[var(--brand-dark)] dark:text-[var(--brand)] hover:underline"
          >
            File prep from Research →
          </a>
        </div>
      </div>

      {msg && (
        <p className="text-xs font-medium text-[var(--muted-foreground)] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
          {msg}
        </p>
      )}

      {creating && (
        <Card>
          <CardHeader>
            <CardTitle>New script</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <input
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={newTiming}
              onChange={(e) => setNewTiming(e.target.value)}
            >
              {SPEAK_TIMINGS.map((t) => (
                <option key={t} value={t}>
                  {TIMING_LABEL[t] || t}
                </option>
              ))}
            </select>
            <textarea
              className="w-full min-h-[120px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed"
              placeholder="Script body…"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={createSpeak}
              >
                Create
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {SPEAK_TIMINGS.map((g) => {
          const items = byTiming[g] || [];
          return (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="capitalize">
                  {TIMING_LABEL[g] || g.replace("-", " ")}
                </CardTitle>
              </CardHeader>
              <CardBody className="space-y-3">
                {items.length === 0 && (
                  <p className="text-xs text-[var(--muted)]">
                    No scripts in this slot yet.
                  </p>
                )}
                {items.map((s, i) => {
                  const editing = editingId === s.id;
                  const edited = s.status === "edited";
                  return (
                    <article
                      key={s.id}
                      className={cn(
                        "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-3",
                        editing && "ring-1 ring-[var(--border-strong)]"
                      )}
                    >
                      {editing ? (
                        <div className="space-y-2">
                          <input
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm font-semibold"
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                          />
                          <select
                            className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs"
                            value={draftTiming}
                            onChange={(e) => setDraftTiming(e.target.value)}
                          >
                            {SPEAK_TIMINGS.map((t) => (
                              <option key={t} value={t}>
                                {TIMING_LABEL[t] || t}
                              </option>
                            ))}
                          </select>
                          <textarea
                            className="w-full min-h-[140px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm leading-relaxed"
                            value={draftBody}
                            onChange={(e) => setDraftBody(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={pending}
                              onClick={saveEdit}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-semibold text-[var(--foreground)]">
                                  {displayText(s.title)}
                                </h4>
                                {edited && (
                                  <span className="text-[10px] uppercase tracking-wide font-bold text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">
                                    Edited
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-sm text-[var(--muted-foreground)] leading-relaxed whitespace-pre-wrap">
                                {displayText(s.body) || (
                                  <span className="italic opacity-60">
                                    Empty — click Edit to write.
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button
                                type="button"
                                className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                                disabled={pending || i === 0}
                                onClick={() => move(s, -1)}
                                aria-label="Move up"
                                title="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
                                disabled={pending || i === items.length - 1}
                                onClick={() => move(s, 1)}
                                aria-label="Move down"
                                title="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => startEdit(s)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={pending}
                              onClick={() => remove(s.id)}
                              className="text-[var(--live)]"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
