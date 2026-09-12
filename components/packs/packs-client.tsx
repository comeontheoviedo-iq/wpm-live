"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Wand2, ChevronDown, ChevronUp } from "lucide-react";
import { ResearchStagesHeader } from "@/components/packs/research-stages";
import { HooksPosterUpload } from "@/components/packs/hooks-poster-upload";
import { looksLikeNotebookPaste } from "@/lib/research-stages";

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
  coachNotes?: number;
  hookNotes?: number;
  intro?: number;
  lineup?: number;
  relevanceArmed?: number;
};

function sumDistributed(parts: Distributed[]): Distributed {
  return parts.reduce(
    (a, b) => ({
      scripts: a.scripts + (b?.scripts || 0),
      playerNotes: a.playerNotes + (b?.playerNotes || 0),
      clubNotes: a.clubNotes + (b?.clubNotes || 0),
      matchNotes: a.matchNotes + (b?.matchNotes || 0),
      coachNotes: (a.coachNotes || 0) + (b?.coachNotes || 0),
      hookNotes: (a.hookNotes || 0) + (b?.hookNotes || 0),
      intro: (a.intro || 0) + (b?.intro || 0),
      lineup: (a.lineup || 0) + (b?.lineup || 0),
      relevanceArmed: (a.relevanceArmed || 0) + (b?.relevanceArmed || 0),
    }),
    {
      scripts: 0,
      playerNotes: 0,
      clubNotes: 0,
      matchNotes: 0,
      coachNotes: 0,
      hookNotes: 0,
      intro: 0,
      lineup: 0,
      relevanceArmed: 0,
    }
  );
}

function formatDistributed(d: Distributed) {
  const bits = [
    d.playerNotes
      ? `${d.playerNotes} player note${d.playerNotes === 1 ? "" : "s"}`
      : null,
    d.coachNotes ? `${d.coachNotes} coach` : null,
    d.hookNotes
      ? `${d.hookNotes} hook${d.hookNotes === 1 ? "" : "s"}`
      : null,
    d.intro ? "intro" : null,
    d.lineup ? "lineup" : null,
    d.clubNotes
      ? `${d.clubNotes} club note${d.clubNotes === 1 ? "" : "s"}`
      : null,
    d.matchNotes
      ? `${d.matchNotes} match note${d.matchNotes === 1 ? "" : "s"}`
      : null,
    !d.intro && !d.lineup && d.scripts
      ? `${d.scripts} script${d.scripts === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "pack section only";
}

export function PacksClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [gemini, setGemini] = useState(false);
  const [canAutoGen, setCanAutoGen] = useState(false);
  const [plan, setPlan] = useState<string>("base");
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
  const draftDirty = useRef(false);
  const [researchDistributed, setResearchDistributed] = useState(false);
  useEffect(() => {
    try {
      setResearchDistributed(
        window.localStorage.getItem(`pitchline.researchDistributed.${matchId}`) === "1"
      );
    } catch {
      /* ignore */
    }
  }, [matchId]);

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
    setCanAutoGen(Boolean(json.canAutoGen));
    setPlan(String(json.plan || "base"));
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
    if (draftDirty.current) return;
    const existing = sections.find((s) => s.templateKey === active);
    setDraft(existing?.content || "");
  }, [active, sections]);

  async function generateOne(
    templateKey: string,
    opts?: { useDraft?: boolean; draftContent?: string }
  ) {
    const res = await fetch(`/api/matches/${matchId}/packs/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey,
        ...(sourcesPayload ? { sources: sourcesPayload } : {}),
        ...(opts?.useDraft
          ? { useDraft: true, draftContent: opts.draftContent ?? draft }
          : {}),
      }),
    });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        res.ok
          ? "Unexpected response from generate"
          : `Generate failed (${res.status}) — server returned a page instead of JSON.`
      );
    }
    if (!res.ok) throw new Error(String(json.error || "Generate failed"));
    return json;
  }

  function confirmOverwriteDraft(label: string): boolean {
    if (!draftDirty.current && !draft.trim()) return true;
    const existing = sections.find((s) => s.templateKey === active);
    const hasPaste =
      draftDirty.current ||
      existing?.status === "edited" ||
      (draft.trim().length > 0 && draft !== (existing?.content || ""));
    if (!hasPaste) return true;
    return window.confirm(
      `“${label}” has your pasted/edited Notebook content.\n\nGenerate will REPLACE it with AI output.\n\nOK = replace\nCancel = keep your draft (use “Use my draft → desk notes” instead)`
    );
  }

  async function generate() {
    const label = templates.find((t) => t.key === active)?.title || active;
    if (!confirmOverwriteDraft(label)) {
      setMsg(
        "Kept your draft — click “Use my draft → desk notes” to send Notebook content without regenerating."
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const json = await generateOne(active);
      const section = json.section as Section;
      draftDirty.current = false;
      setDraft(section.content);
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== active);
        return [section, ...others];
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

  /** Paste path: keep Notebook body, save, distribute to desk notes (no Gemini). */
  async function useMyDraft() {
    const label = templates.find((t) => t.key === active)?.title || active;
    if (!draft.trim()) {
      setMsg(
        `No content for “${label}” — paste Notebook research into the editor first.`
      );
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const json = await generateOne(active, {
        useDraft: true,
        draftContent: draft,
      });
      const section = json.section as Section;
      draftDirty.current = false;
      setDraft(section.content);
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== active);
        return [section, ...others];
      });
      const d = (json.distributed || {
        scripts: 0,
        playerNotes: 0,
        clubNotes: 0,
        matchNotes: 0,
      }) as Distributed;
      setLastDistributed(d);
      if (active === "research") {
        setResearchDistributed(true);
        try {
          window.localStorage.setItem(
            `pitchline.researchDistributed.${matchId}`,
            "1"
          );
        } catch {
          /* ignore */
        }
      }
      setMsg(
        `Kept your Notebook draft for “${label}” · sent to desk notes · ${formatDistributed(d)}`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Use my draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateResearchPack() {
    const researchSection = sections.find((s) => s.templateKey === "research");
    const researchHasPaste =
      (active === "research" && draftDirty.current && draft.trim()) ||
      researchSection?.status === "edited" ||
      Boolean(researchSection?.content?.trim());
    if (researchHasPaste && active === "research" && draftDirty.current) {
      const ok = window.confirm(
        "Research pack has your pasted Notebook content.\n\nRegenerating will REPLACE it.\n\nOK = replace all sections\nCancel = keep paste (use “Use my draft → desk notes”)"
      );
      if (!ok) {
        setMsg(
          "Kept your Notebook draft — use “Use my draft → desk notes” or “Send to desk notes”."
        );
        return;
      }
    }
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
        if (json.distributed) dists.push(json.distributed as Distributed);
        const section = json.section as Section;
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== key);
          return [section, ...others];
        });
        if (key === active) {
          draftDirty.current = false;
          setDraft(section.content);
        }
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
        draftDirty.current = false;
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
        json.message
          ? `${json.message} · ${formatDistributed(d)}`
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
        draftDirty.current = false;
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
  async function fillGap(templateKey: string) {
    setBusy(true);
    setMsg(null);
    try {
      const json = await generateOne(templateKey);
      const section = json.section as Section;
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== templateKey);
        return [section, ...others];
      });
      if (active === templateKey) {
        draftDirty.current = false;
        setDraft(section.content);
      }
      setMsg(`Filled gap: ${templateKey} only (no full re-research).`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fill gap failed");
    } finally {
      setBusy(false);
    }
  }

  const researchDone = sections.some((s) => s.templateKey === "research");
  const hasSources = Boolean(sourcesPayload);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Research</h2>
          <p className="text-sm text-[var(--muted)]">
            Gemini Notebook is the research source of truth: paste → Use my draft
            → desk notes (organise/tag). Do not full re-Generate on top of paste —
            use Fill gap for missing sections only. Generate still asks to confirm
            before replacing a Notebook draft.
          </p>
        </div>
        <Button
          size="sm"
          disabled={packBusy || busy || !canAutoGen}
          onClick={generateResearchPack}
          title={
            canAutoGen
              ? "Auto Gen research pack with Gemini"
              : "Intel + GEMINI_API_KEY required — paste Notebook + Use my draft on Base"
          }
          className="desk-btn-accent"
        >
          <Wand2 className="h-3.5 w-3.5 mr-1" />
          {packBusy
            ? "Deep researching…"
            : (() => {
                const research = sections.find((s) => s.templateKey === "research");
                const pasted =
                  research &&
                  research.content.trim().length >= 40 &&
                  (/^##\s+/m.test(research.content) ||
                    research.content.trim().length >= 280);
                if (pasted) return "Generate (replaces Notebook paste)";
                return researchDone
                  ? "Regenerate research pack"
                  : "Generate research pack";
              })()}
        </Button>
      </div>

      <ResearchStagesHeader
        sections={sections.map((s) => ({
          templateKey: s.templateKey,
          content: s.content,
          status: s.status,
        }))}
        researchDistributed={researchDistributed}
        onFillGap={(key) => void fillGap(key)}
        fillBusy={busy || packBusy}
      />

      <HooksPosterUpload matchId={matchId} />

      {!canAutoGen && (
        <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/40 bg-[var(--surface-muted)] px-3 py-2.5 text-sm text-[var(--foreground)] flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">
              {!gemini
                ? "Gemini not connected"
                : plan === "base"
                  ? "Intel required for Auto Gen"
                  : "Auto Gen unavailable"}
            </div>
            <p className="text-xs mt-0.5">
              {!gemini ? (
                <>
                  Set <code className="font-mono">GEMINI_API_KEY</code> in .env.
                  Paste Notebook research still works on Base — use{" "}
                  <strong>Use my draft → desk notes</strong>.
                </>
              ) : (
                <>
                  Base plan keeps BYO Notebook / draft distribute. Enable Intel in
                  Settings (or set plan env to intel)
                  for Auto Gen. Stripe later.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="panel-surface overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          onClick={() => setSourcesOpen((o) => !o)}
        >
          <div>
            <div className="font-semibold">
              Enhance with sources{" "}
              <span className="font-normal text-[var(--muted)]">(optional)</span>
            </div>
            <div className="text-[11px] text-[var(--muted)]">
              Deep research already uses match context, live-feed
              squads/injuries/predictions/H2H, and Gemini Google Search. Paste
              URLs or notes only to steer.
              {hasSources ? " · Sources attached for next generate." : ""}
            </div>
          </div>
          {sourcesOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          )}
        </button>
        {sourcesOpen && (
          <div className="border-t border-[var(--border)] px-3 py-3 space-y-2">
            <label className="block text-xs font-medium text-[var(--muted-foreground)]">
              URLs (one per line)
              <textarea
                className="mt-1 w-full min-h-[72px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs font-mono"
                placeholder="https://…"
                value={sourceUrls}
                onChange={(e) => setSourceUrls(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--muted-foreground)]">
              Extra notes
              <textarea
                className="mt-1 w-full min-h-[72px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                placeholder="Anything you want Gemini to weigh…"
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
              />
            </label>
            <p className="text-[10px] text-[var(--muted)]">
              Empty is fine — Generate never waits on sources.
            </p>
          </div>
        )}
      </div>

      {lastDistributed && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--foreground)]">
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
                  if (
                    t.key !== active &&
                    draftDirty.current &&
                    draft.trim() &&
                    !window.confirm(
                      "Discard unsaved paste in this section and switch?"
                    )
                  ) {
                    return;
                  }
                  draftDirty.current = false;
                  setActive(t.key);
                  const existing = sections.find((s) => s.templateKey === t.key);
                  setDraft(existing?.content || "");
                  setMsg(null);
                }}
                className={`w-full text-left rounded-[var(--radius-sm)] px-3 py-2 text-sm border ${
                  active === t.key
                    ? "border-[var(--border-strong)] bg-[var(--surface)] shadow-xs"
                    : "border-[var(--border)] bg-[var(--surface-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                <div className="font-medium">{t.title}</div>
                <div className="text-[10px] text-[var(--muted)]">
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
              <p className="text-xs text-[var(--muted)] mt-0.5">
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
              <Button
                size="sm"
                variant="outline"
                disabled={busy || packBusy || !draft.trim()}
                onClick={useMyDraft}
                title="Keep this pasted Notebook body and distribute it to desk notes (no AI overwrite)"
              >
                Use my draft → desk notes
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || packBusy || !canAutoGen}
                onClick={generate}
                title={
                  canAutoGen
                    ? "Generate this section with Gemini (confirms before replacing a Notebook paste)"
                    : "Intel + GEMINI_API_KEY required for Auto Gen — use Use my draft on Base"
                }
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{busy ? "Working…" : "Generate"}</span>
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
                    ? "text-[var(--live)]"
                    : "text-[var(--success)]"
                }`}
              >
                {msg}
              </p>
            )}
            {!draft.trim() && (
              <p className="text-[11px] text-[var(--muted)]">
                This section is empty — Generate first (or paste), then Send to
                desk notes unlocks.
              </p>
            )}
            <p className="text-[11px] text-[var(--muted)]">
              Notebook path: paste Gemini Notebook research into this editor →
              <span className="font-medium"> Use my draft → desk notes</span> or
              <span className="font-medium"> Send to desk notes</span>. Avoid
              Generate if you want to keep your paste.
            </p>
            <textarea
              className="w-full min-h-[420px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed font-mono"
              value={draft}
              onChange={(e) => {
                draftDirty.current = true;
                setDraft(e.target.value);
              }}
              placeholder="Paste Gemini Notebook research here, or Generate…"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
