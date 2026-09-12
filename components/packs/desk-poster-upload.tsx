"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, Upload } from "lucide-react";

type Meta = {
  exists: boolean;
  contentType?: string;
  updatedAt?: string;
  bytes?: number;
};

type PosterKind = "hooks" | "league";

const LABEL: Record<PosterKind, string> = {
  hooks: "HOOKS",
  league: "LEAGUE",
};

/**
 * Research: upload / replace / remove a per-match desk glance poster.
 */
export function DeskPosterUpload({
  matchId,
  kind,
}: {
  matchId: string;
  kind: PosterKind;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [meta, setMeta] = useState<Meta>({ exists: false });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const label = LABEL[kind];
  const apiPath =
    kind === "hooks"
      ? `/api/matches/${matchId}/hooks-poster`
      : `/api/matches/${matchId}/league-poster`;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${apiPath}?meta=1`, { cache: "no-store" });
      if (!res.ok) {
        setMeta({ exists: false });
        setPreview(null);
        return;
      }
      const json = (await res.json()) as Meta;
      setMeta(json);
      if (json.exists) {
        const bust = json.updatedAt
          ? `?t=${encodeURIComponent(json.updatedAt)}`
          : `?t=${Date.now()}`;
        setPreview(`${apiPath}${bust}`);
      } else {
        setPreview(null);
      }
    } catch {
      setMeta({ exists: false });
      setPreview(null);
    }
  }, [apiPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiPath, { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }
      setMsg(`${label} poster saved — open it from the match desk.`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    if (!window.confirm(`Remove ${label} poster for this match?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(apiPath, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Remove failed");
      }
      setMsg(`${label} poster removed.`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-surface px-3 py-2.5 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-desk-label text-[var(--foreground)]">
            {label} poster
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">
            Upload a full-screen glance card (PNG / JPG / WebP). Desk shows a{" "}
            {label} button — Esc returns to the match desk.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0] || null)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {meta.exists ? (
              <>
                <Upload className="h-3 w-3 mr-1" />
                Replace
              </>
            ) : (
              <>
                <ImagePlus className="h-3 w-3 mr-1" />
                Upload
              </>
            )}
          </Button>
          {meta.exists ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-[11px] text-rose-600 dark:text-rose-300"
              disabled={busy}
              onClick={() => void onRemove()}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/80 overflow-hidden max-h-48 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${label} poster preview`}
            className="max-h-48 w-auto object-contain"
          />
        </div>
      ) : (
        <p className="text-[11px] text-[var(--muted)] rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-2 py-3 text-center">
          No poster yet for this match.
        </p>
      )}

      {msg ? (
        <p className="text-[11px] text-[var(--muted)]" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer DeskPosterUpload kind="hooks" */
export function HooksPosterUpload({ matchId }: { matchId: string }) {
  return <DeskPosterUpload matchId={matchId} kind="hooks" />;
}
