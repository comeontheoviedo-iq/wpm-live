"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ExternalLink,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  groupNewsByRegion,
  newsRegionLabel,
  type NewsItem,
  type NewsPayload,
  type NewsScope,
} from "@/lib/news";

const SCOPES: { key: NewsScope; label: string }[] = [
  { key: "all", label: "All" },
  { key: "home", label: "Home club" },
  { key: "away", label: "Away club" },
  { key: "league", label: "League" },
  { key: "players", label: "Players" },
];

function formatPublished(iso: string | null): string {
  if (!iso) return "Time unknown";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function provenanceLabel(item: NewsItem): string {
  if (item.provenance === "web_brief") {
    return item.sourceName === "Web brief" ? "Web brief" : item.sourceName;
  }
  return item.sourceName;
}

function LangBadge({ lang }: { lang: string }) {
  return (
    <span className="rounded border border-slate-200 dark:border-slate-700 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
      {lang}
    </span>
  );
}

function NewsCard({
  item,
  matchId,
  homeClubId,
  awayClubId,
  addingId,
  addedIds,
  onAdd,
}: {
  item: NewsItem;
  matchId: string;
  homeClubId?: string;
  awayClubId?: string;
  addingId: string | null;
  addedIds: Set<string>;
  onAdd: (item: NewsItem) => void;
}) {
  void matchId;
  void homeClubId;
  void awayClubId;
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">
            {item.headline}
          </CardTitle>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                item.provenance === "web_brief"
                  ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {item.provenance === "web_brief" ? "Web brief" : "RSS"}
            </span>
            <LangBadge lang={item.lang} />
          </div>
        </div>
      </CardHeader>
      <CardBody className="px-3 pb-3 pt-0 space-y-2">
        {item.snippet && (
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
            {item.snippet}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {provenanceLabel(item)}
          </span>
          <span>·</span>
          <span>{newsRegionLabel(item.region)}</span>
          <span>·</span>
          <span>{formatPublished(item.publishedAt)}</span>
          {item.entities.map((e) => (
            <span
              key={`${e.kind}-${e.id}`}
              className={cn(
                "rounded-full border px-1.5 py-0.5 font-medium",
                e.kind === "player"
                  ? "border-sky-300 text-sky-800 dark:border-sky-700 dark:text-sky-200"
                  : e.kind === "league"
                    ? "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200"
                    : "border-teal-300 text-teal-800 dark:border-teal-700 dark:text-teal-200"
              )}
            >
              {e.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
            >
              <ExternalLink className="h-3 w-3" />
              Open source
            </a>
          ) : (
            <span className="inline-flex items-center rounded-md border border-dashed border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] text-slate-400">
              No URL from source
            </span>
          )}
          <button
            type="button"
            disabled={addingId === item.id || addedIds.has(item.id)}
            onClick={() => onAdd(item)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold",
              addedIds.has(item.id)
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-60"
            )}
          >
            {addingId === item.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            {addedIds.has(item.id) ? "On desk" : "Add to desk notes"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

export function NewsPanel({
  matchId,
  homeName,
  awayName,
  competition,
  homeClubId,
  awayClubId,
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  competition?: string;
  homeClubId?: string;
  awayClubId?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<NewsPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scope, setScope] = useState<NewsScope>("all");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      setBusy(true);
      setErr(null);
      try {
        const qs = force ? "?refresh=1" : "";
        const res = await fetch(`/api/matches/${matchId}/news${qs}`);
        const json = (await res.json()) as NewsPayload & { error?: string };
        if (!res.ok) throw new Error(json.error || "Failed to load news");
        setData(json);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load news");
      } finally {
        setBusy(false);
      }
    },
    [matchId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const scopeLabels = useMemo(() => {
    return SCOPES.map((s) => {
      if (s.key === "home") return { ...s, label: homeName };
      if (s.key === "away") return { ...s, label: awayName };
      if (s.key === "league" && competition) return { ...s, label: competition };
      if (s.key === "players") return { ...s, label: "Players (XI)" };
      return s;
    });
  }, [homeName, awayName, competition]);

  const visible = useMemo(() => {
    if (!data) return [];
    if (scope === "all") return data.items;
    return data.items.filter((it) => it.scopes.includes(scope));
  }, [data, scope]);

  const groups = useMemo(() => groupNewsByRegion(visible), [visible]);

  async function addToNotes(item: NewsItem) {
    setAddingId(item.id);
    setToast(null);
    try {
      const player = item.entities.find((e) => e.kind === "player");
      const club = item.entities.find((e) => e.kind === "club");
      let entityType: string = "match";
      let entityId: string = matchId;
      if (player) {
        entityType = "player";
        entityId = player.id;
      } else if (club) {
        entityType = "club";
        entityId = club.id;
      } else if (
        homeClubId &&
        item.scopes.includes("home") &&
        !item.scopes.includes("away")
      ) {
        entityType = "club";
        entityId = homeClubId;
      } else if (
        awayClubId &&
        item.scopes.includes("away") &&
        !item.scopes.includes("home")
      ) {
        entityType = "club";
        entityId = awayClubId;
      }

      const bodyParts = [
        item.snippet || "",
        item.url ? `Source: ${item.url}` : "",
        `Via: ${provenanceLabel(item)} (${item.lang.toUpperCase()})`,
      ].filter(Boolean);

      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          title: item.headline.slice(0, 160),
          body: bodyParts.join("\n\n") || item.headline,
          category: "Hook",
          entityType,
          entityId,
          pinned: false,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.note) {
        throw new Error(json.error || "Could not create note");
      }
      setAddedIds((prev) => new Set(prev).add(item.id));
      setToast("Added to desk notes");
      router.refresh();
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not add note");
    } finally {
      setAddingId(null);
      window.setTimeout(() => setToast(null), 3200);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-teal-600" />
            News
          </h1>
          <p className="text-xs text-slate-500">
            League-aware curated feeds plus grounded web brief for {homeName} vs{" "}
            {awayName}. Cache ~7 min. No invented headlines.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          disabled={busy}
          onClick={() => void load(true)}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", busy && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {scopeLabels.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setScope(s.key)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium border transition",
              scope === s.key
                ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
                : "border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {data && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
          {data.feeds.map((f) => (
            <span
              key={f.key}
              className={
                f.ok
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-amber-700 dark:text-amber-400"
              }
            >
              {f.label}
              {f.mode === "web_brief" ? " (brief)" : ""}:{" "}
              {f.ok ? `${f.count}` : f.error || "failed"}
            </span>
          ))}
          <span>
            Web brief:{" "}
            {data.gemini.configured
              ? data.gemini.error
                ? data.gemini.error.slice(0, 80)
                : data.gemini.grounded
                  ? "grounded"
                  : data.gemini.used
                    ? "ok"
                    : "idle"
              : "GEMINI_API_KEY not set"}
          </span>
          <span>
            {data.cached ? "Cached" : "Fresh"} · {formatPublished(data.fetchedAt)}
          </span>
        </div>
      )}

      {toast && (
        <p className="text-xs font-medium text-teal-700 dark:text-teal-300">
          {toast}
        </p>
      )}

      {err && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {err}
        </div>
      )}

      {data?.warnings?.length ? (
        <ul className="space-y-1">
          {data.warnings.map((w) => (
            <li
              key={w}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-[11px] text-slate-600 dark:text-slate-300"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}

      {busy && !data ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Fetching feeds…
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardBody className="py-8 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              No headlines for this filter
            </p>
            <p className="mt-1 text-xs max-w-md mx-auto">
              Curated UK football RSS is often thin for non-Premier League clubs.
              League-specialist feeds and Web brief fill gaps when available — try
              All or Refresh.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.region} className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                {g.label}
                <span className="tabular-nums text-slate-400">{g.items.length}</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </h2>
              <ul className="space-y-2">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <NewsCard
                      item={item}
                      matchId={matchId}
                      homeClubId={homeClubId}
                      awayClubId={awayClubId}
                      addingId={addingId}
                      addedIds={addedIds}
                      onAdd={(it) => void addToNotes(it)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
