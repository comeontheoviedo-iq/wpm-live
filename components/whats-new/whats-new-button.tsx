"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type WhatsNewPost = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type WhatsNewPayload = {
  posts: WhatsNewPost[];
  unreadCount: number;
  canCreate?: boolean;
};

function formatPostDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function WhatsNewButton() {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState<WhatsNewPost[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whats-new", { credentials: "include" });
      if (!res.ok) return;
      const json = (await res.json()) as WhatsNewPayload;
      setPosts(Array.isArray(json.posts) ? json.posts : []);
      setUnreadCount(Number(json.unreadCount) || 0);
      setCanCreate(Boolean(json.canCreate));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  async function markRead() {
    try {
      const res = await fetch("/api/whats-new/read", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }

  async function openPanel() {
    setOpen(true);
    setFormStatus(null);
    if (unreadCount > 0) {
      void markRead();
    }
  }

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormStatus(null);
    try {
      const res = await fetch("/api/whats-new", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json.error || "Could not post"));
      setTitle("");
      setBody("");
      setShowForm(false);
      setFormStatus("Posted.");
      await load();
    } catch (err) {
      setFormStatus(err instanceof Error ? err.message : "Could not post");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="focus-ring interactive-press relative rounded-[2px] p-1.5 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
        aria-label={
          unreadCount > 0
            ? `What’s New, ${unreadCount} unread`
            : "What’s New"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => (open ? setOpen(false) : void openPanel())}
      >
        <Megaphone className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span
            className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold leading-none text-white ring-1 ring-[var(--surface)]"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="What’s New"
          className="absolute right-0 top-full z-50 mt-1.5 w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl border border-amber-400/40 bg-white shadow-xl dark:border-amber-600/30 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-amber-200/50 px-3 py-2.5 dark:border-amber-800/40">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                CoComms
              </p>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                What’s New
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {canCreate && (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-slate-800"
                  onClick={() => {
                    setShowForm((v) => !v);
                    setFormStatus(null);
                  }}
                >
                  {showForm ? "Cancel" : "Add update"}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 dark:hover:bg-slate-800"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {canCreate && showForm && (
            <form
              onSubmit={submitCreate}
              className="space-y-2 border-b border-amber-200/50 px-3 py-3 dark:border-amber-800/40"
            >
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title"
                maxLength={120}
                required
                className="w-full rounded-lg border border-amber-200/80 bg-transparent px-2.5 py-1.5 text-sm focus-ring dark:border-amber-800/40"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Plain commentator note…"
                rows={3}
                maxLength={4000}
                required
                className="w-full rounded-lg border border-amber-200/80 bg-transparent px-2.5 py-1.5 text-sm focus-ring dark:border-amber-800/40"
              />
              {formStatus && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {formStatus}
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={
                    creating || title.trim().length < 2 || body.trim().length < 3
                  }
                  className="bg-[var(--brand)] text-white hover:bg-[var(--brand-dark)]"
                >
                  {creating ? "Posting…" : "Post"}
                </Button>
              </div>
            </form>
          )}

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                Loading…
              </p>
            ) : posts.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-600 dark:text-slate-300">
                You’re up to date.
              </p>
            ) : (
              <ul className="divide-y divide-amber-100/80 dark:divide-slate-800">
                {posts.map((post) => (
                  <li key={post.id} className="px-3 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-400/80">
                      {formatPostDate(post.createdAt)}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {post.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {post.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
