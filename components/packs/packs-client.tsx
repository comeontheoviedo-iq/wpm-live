"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Wand2, ChevronDown, ChevronUp } from "lucide-react";

type Template = {
  key: string;
  title: string;
  description: string | null;
  section: string;
};
type Section = {
  id: string;
  templateKey: string;
  title: string;
  content: string;
  status: string;
};

type Distributed = {
  scripts: number;
  playerNotes: number;
  clubNotes: number;
  matchNotes: number;
};

function sumDistributed(parts: Distributed[]): Distributed {
  return parts.reduce(
    (a, b) => ({
      scripts: a.scripts + (b?.scripts || 0),
      playerNotes: a.playerNotes + (b?.playerNotes || 0),
      clubNotes: a.clubNotes + (b?.clubNotes || 0),
      matchNotes: a.matchNotes + (b?.matchNotes || 0),
    }),
    { scripts: 0, playerNotes: 0, clubNotes: 0, matchNotes: 0 }
  );
}

function formatDistributed(d: Distributed) {
  const bits = [
    d.scripts ? `${d.scripts} script${d.scripts === 1 ? "" : "s"}` : null,
    d.playerNotes
      ? `${d.playerNotes} player note${d.playerNotes === 1 ? "" : "s"}`
      : null,
    d.clubNotes
      ? `${d.clubNotes} club note${d.clubNotes === 1 ? "" : "s"}`
      : null,
    d.matchNotes
      ? `${d.matchNotes} match note${d.matchNotes === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "pack section only";
}

export function PacksClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [gemini, setGemini] = useState(false);
  const [active, setActive] = useState<string>("research");
  const [busy, setBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastDistributed, setLastDistributed] = useState<Distributed | null>(
    null
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourceUrls, setSourceUrls] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");

  const sourcesPayload = useMemo(() => {
    const urls = sourceUrls
      .split(/\n+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//i.test(u));
    const notes = sourceNotes.trim();
    if (!urls.length && !notes) return undefined;
    return { urls, notes };
  }, [sourceUrls, sourceNotes]);

  async function load() {
    const res = await fetch(`/api/matches/${matchId}/packs`);
    const json = await res.json();
    setTemplates(json.templates || []);
    setSections(json.sections || []);
    setGemini(Boolean(json.gemini));
    const key = active || json.templates?.[0]?.key || "research";
    if (key) {
      setActive(key);
      const existing = (json.sections || []).find(
        (s: Section) => s.templateKey === key
      );
      setDraft(existing?.content || "");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    const existing = sections.find((s) => s.templateKey === active);
    setDraft(existing?.content || "");
  }, [active, sections]);

  async function generateOne(templateKey: string) {
    const res = await fetch(`/api/matches/${matchId}/packs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey,
        ...(sourcesPayload ? { sources: sourcesPayload } : {}),
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Generate failed");
    return json;
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const json = await generateOne(active);
      setDraft(json.section.content);
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== active);
        return [json.section, ...others];
      });
      const d = (json.distributed || {
        scripts: 0,
        playerNotes: 0,
        clubNotes: 0,
        matchNotes: 0,
      }) as Distributed;
      setLastDistributed(d);
      const ground = json.grounded
        ? " · Google Search grounded"
        : json.stub
          ? ""
          : " · deep research from match context";
      setMsg(
        json.stub
          ? "Stub placeholder — connect GEMINI_API_KEY to generate for real."
          : `Generated · distributed: ${formatDistributed(d)}${ground}`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateResearchPack() {
    setPackBusy(true);
    setMsg(null);
    const keys = ["research", "intro", "profiles", "referee", "hooks"];
    const available = keys.filter((k) => templates.some((t) => t.key === k));
    const runKeys = available.length ? available : ["research"];
    let stub = false;
    let grounded = false;
    const dists: Distributed[] = [];
    try {
      for (const key of runKeys) {
        const json = await generateOne(key);
        stub = stub || Boolean(json.stub);
        grounded = grounded || Boolean(json.grounded);
        if (json.distributed) dists.push(json.distributed);
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== key);
          return [json.section, ...others];
        });
        if (key === active) setDraft(json.section.content);
      }
      const total = sumDistributed(dists);
      setLastDistributed(total);
      setMsg(
        stub
          ? `Pack placeholders saved (${runKeys.length} sections). Set GEMINI_API_KEY for live deep research.`
          : `Research pack ready — ${runKeys.length} sections · distributed: ${formatDistributed(total)}${grounded ? " · Google Search grounded" : ""}`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Pack generate failed");
    } finally {
      setPackBusy(false);
    }
  }

  async function sendToNotes() {
    const label = templates.find((t) => t.key === active)?.title || active;
    if (!draft.trim()) {
      setMsg(
        `No content for “${label}” yet — Generate (or paste) first, then Send to desk notes.`
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const tpl = templates.find((t) => t.key === active);
      const saveRes = await fetch(`/api/matches/${matchId}/packs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: active,
          title: tpl?.title || active,
          content: draft,
        }),
      });
      const saveText = await saveRes.text();
      let saveJson: { section?: Section; error?: string };
      try {
        saveJson = JSON.parse(saveText);
      } catch {
        throw new Error(
          saveRes.ok
            ? "Unexpected response while saving draft"
            : `Save failed (${saveRes.status}) — server returned a page instead of JSON. Try refreshing.`
        );
      }
      if (!saveRes.ok) throw new Error(saveJson.error || "Save draft failed");
      if (saveJson.section) {
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== active);
          return [saveJson.section!, ...others];
        });
      }

      const res = await fetch(`/api/matches/${matchId}/packs/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: active,
          content: draft.trim(),
        }),
      });
      const text = await res.text();
      let json: {
        distributed?: Distributed;
        error?: string;
        message?: string;
        emptyDistribution?: boolean;
      };
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          res.ok
            ? "Unexpected response from distribute"
            : `Send failed (${res.status}) — server returned a page instead of JSON. Try refreshing.`
        );
      }
      if (!res.ok) throw new Error(json.error || "Send to notes failed");
      const d = (json.distributed || {
        scripts: 0,
        playerNotes: 0,
        clubNotes: 0,
        matchNotes: 0,
      }) as Distributed;
      setLastDistributed(d);
      setMsg(
        json.emptyDistribution && json.message
          ? json.message
          : `Sent “${label}” to desk notes · ${formatDistributed(d)}`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Send to notes failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const tpl = templates.find((t) => t.key === active);
      const res = await fetch(`/api/matches/${matchId}/packs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: active,
          title: tpl?.title || active,
          content: draft,
        }),
      });
      const json = await res.json();
      if (json.section) {
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== active);
          return [json.section, ...others];
        });
        setMsg("Saved.");
      }
    } finally {
      setBusy(false);
    }
  }

  const current = templates.find((t) => t.key === active);
  const researchDone = sections.some((s) => s.templateKey === "research");
  const hasSources = Boolean(sourcesPayload);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Broadcast packs</h2>
          <p className="text-sm text-slate-500">
            Generate research pack fills Scripts, player notes, and match notes.
            Deep research runs automatically. Add sources only if you want to
            steer it.
          </p>
        </div>
        <Button
          size="sm"
          disabled={packBusy || busy}
          onClick={generateResearchPack}
          className="bg-violet-600 hover:bg-violet-500"
        >
          <Wand2 className="h-3.5 w-3.5 mr-1" />
          {packBusy
            ? "Deep researching…"
            : researchDone
              ? "Regenerate research pack"
              : "Generate research pack"}
        </Button>
      </div>

      {!gemini && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Gemini not connected</div>
            <p className="text-xs mt-0.5">
              Set <code className="font-mono">GEMINI_API_KEY</code> in .env to
              run deep research with Google Search grounding. Without it, each
              section returns a structured placeholder you can still edit and
              save.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          onClick={() => setSourcesOpen((o) => !o)}
        >
          <div>
            <div className="font-semibold">
              Enhance with sources{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Deep research already uses match context, API-Football
              squads/injuries/predictions/H2H, and Gemini Google Search. Paste
              URLs or notes only to steer.
              {hasSources ? " · Sources attached for next generate." : ""}
            </div>
          </div>
          {sourcesOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          )}
        </button>
        {sourcesOpen && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-3 py-3 space-y-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              URLs (one per line)
              <textarea
                className="mt-1 w-full min-h-[72px] rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs font-mono"
                placeholder="https://…"
                value={sourceUrls}
                onChange={(e) => setSourceUrls(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              Extra notes
              <textarea
                className="mt-1 w-full min-h-[72px] rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
                placeholder="Anything you want Gemini to weigh…"
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
              />
            </label>
            <p className="text-[10px] text-slate-400">
              Empty is fine — Generate never waits on sources.
            </p>
          </div>
        )}
      </div>

      {lastDistributed && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2 text-xs text-violet-900 dark:text-violet-100">
          <span className="font-semibold">Last distribution: </span>
          {formatDistributed(lastDistributed)}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">
        <aside className="lg:col-span-3 space-y-1">
          {templates.map((t) => {
            const done = sections.some((s) => s.templateKey === t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActive(t.key);
                  const existing = sections.find((s) => s.templateKey === t.key);
                  setDraft(existing?.content || "");
                  setMsg(null);
                }}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm border ${
                  active === t.key
                    ? "border-teal-500 bg-teal-50 dark:bg-teal-950/40"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="font-medium">{t.title}</div>
                <div className="text-[10px] text-slate-500">
                  {done ? "Saved" : "Not generated"} · {t.section}
                </div>
              </button>
            );
          })}
        </aside>

        <Card className="lg:col-span-9">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>{current?.title || "Section"}</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {current?.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || packBusy}
                onClick={save}
              >
                Save edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || packBusy || !draft.trim()}
                onClick={sendToNotes}
                title={
                  draft.trim()
                    ? `Push “${current?.title || active}” into Scripts / desk notes`
                    : "Generate or paste content for this section first"
                }
              >
                Send to desk notes
              </Button>
              <Button size="sm" disabled={busy || packBusy} onClick={generate}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {busy ? "Working…" : "Generate"}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {msg && (
              <p
                className={`text-xs ${
                  /failed|error|no content|could not|page instead|nothing mapped/i.test(
                    msg
                  )
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {msg}
              </p>
            )}
            {!draft.trim() && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                This section is empty — Generate first (or paste), then Send to
                desk notes unlocks.
              </p>
            )}
            <textarea
              className="w-full min-h-[420px] rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2 text-sm leading-relaxed font-mono"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Generate or paste pack content…"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
