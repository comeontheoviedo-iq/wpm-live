"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResearchStagesHeader } from "@/components/packs/research-stages";
import { DeskPosterUpload } from "@/components/packs/desk-poster-upload";

const RESEARCH_KEY = "research";

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

function formatDistributed(d: Distributed) {
  const bits = [
    d.playerNotes
      ? `${d.playerNotes} player note${d.playerNotes === 1 ? "" : "s"}`
      : null,
    d.coachNotes ? `${d.coachNotes} coach` : null,
    d.hookNotes
      ? `${d.hookNotes} hook${d.hookNotes === 1 ? "" : "s"}`
      : null,
    d.intro ? "intro script" : null,
    d.lineup ? "lineup script" : null,
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
  return bits.length ? bits.join(" · ") : "saved dump only";
}

export function PacksClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [lastDistributed, setLastDistributed] = useState<Distributed | null>(
    null
  );
  const draftDirty = useRef(false);
  const [researchDistributed, setResearchDistributed] = useState(false);

  useEffect(() => {
    try {
      setResearchDistributed(
        window.localStorage.getItem(
          `pitchline.researchDistributed.${matchId}`
        ) === "1"
      );
    } catch {
      /* ignore */
    }
  }, [matchId]);

  async function load() {
    const res = await fetch(`/api/matches/${matchId}/packs`);
    const json = await res.json();
    setTemplates(json.templates || []);
    setSections(json.sections || []);
    const existing = (json.sections || []).find(
      (s: Section) => s.templateKey === RESEARCH_KEY
    );
    if (!draftDirty.current) setDraft(existing?.content || "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    if (draftDirty.current) return;
    const existing = sections.find((s) => s.templateKey === RESEARCH_KEY);
    setDraft(existing?.content || "");
  }, [sections]);

  /** Organise path: keep pasted body, save, file into Notes / Scripts / profiles. */
  async function filePrep() {
    if (!draft.trim()) {
      setMsg("Paste your prep into the dump first, then file it.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/packs/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: RESEARCH_KEY,
          useDraft: true,
          draftContent: draft,
        }),
      });
      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          res.ok
            ? "Unexpected response while filing prep"
            : `File failed (${res.status}) — server returned a page instead of JSON.`
        );
      }
      if (!res.ok) throw new Error(String(json.error || "File failed"));
      const section = json.section as Section;
      draftDirty.current = false;
      setDraft(section.content);
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== RESEARCH_KEY);
        return [section, ...others];
      });
      const d = (json.distributed || {
        scripts: 0,
        playerNotes: 0,
        clubNotes: 0,
        matchNotes: 0,
      }) as Distributed;
      setLastDistributed(d);
      setResearchDistributed(true);
      try {
        window.localStorage.setItem(
          `pitchline.researchDistributed.${matchId}`,
          "1"
        );
      } catch {
        /* ignore */
      }
      setMsg(
        `Filed your prep into Notes, Scripts, profiles · ${formatDistributed(d)}`
      );
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "File failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendToNotes() {
    if (!draft.trim()) {
      setMsg("Paste your prep first, then send it to desk notes.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const tpl = templates.find((t) => t.key === RESEARCH_KEY);
      const saveRes = await fetch(`/api/matches/${matchId}/packs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: RESEARCH_KEY,
          title: tpl?.title || "Research pack",
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
            ? "Unexpected response while saving dump"
            : `Save failed (${saveRes.status}) — server returned a page instead of JSON. Try refreshing.`
        );
      }
      if (!saveRes.ok) throw new Error(saveJson.error || "Save dump failed");
      if (saveJson.section) {
        draftDirty.current = false;
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== RESEARCH_KEY);
          return [saveJson.section!, ...others];
        });
      }

      const res = await fetch(`/api/matches/${matchId}/packs/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: RESEARCH_KEY,
          content: draft.trim(),
        }),
      });
      const text = await res.text();
      let json: {
        distributed?: Distributed;
        error?: string;
        message?: string;
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
      setResearchDistributed(true);
      try {
        window.localStorage.setItem(
          `pitchline.researchDistributed.${matchId}`,
          "1"
        );
      } catch {
        /* ignore */
      }
      setMsg(
        json.message
          ? `${json.message} · ${formatDistributed(d)}`
          : `Sent prep to Notes, Scripts, profiles · ${formatDistributed(d)}`
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
      const tpl = templates.find((t) => t.key === RESEARCH_KEY);
      const res = await fetch(`/api/matches/${matchId}/packs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: RESEARCH_KEY,
          title: tpl?.title || "Research pack",
          content: draft,
        }),
      });
      const json = await res.json();
      if (json.section) {
        draftDirty.current = false;
        setSections((prev) => {
          const others = prev.filter((s) => s.templateKey !== RESEARCH_KEY);
          return [json.section, ...others];
        });
        setMsg("Saved dump.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Research</h2>
        <p className="text-sm text-[var(--muted)]">
          Bring your notes / paste your prep — we file them into Notes, Scripts, profiles.
        </p>
      </div>

      <ResearchStagesHeader
        sections={sections.map((s) => ({
          templateKey: s.templateKey,
          content: s.content,
          status: s.status,
        }))}
        researchDistributed={researchDistributed}
      />

      <div className="space-y-2">
        <DeskPosterUpload matchId={matchId} kind="league" />
        <DeskPosterUpload matchId={matchId} kind="hooks" />
      </div>

      {lastDistributed && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--foreground)]">
          <span className="font-semibold">Last filed: </span>
          {formatDistributed(lastDistributed)}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Research dump</CardTitle>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              One paste. CoComms sorts it into Notes, Scripts, hooks, and
              profiles. Scripts stay destinations — they fill from organise or
              Official XI, not extra generators here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button size="sm" variant="outline" disabled={busy} onClick={save}>
              Save dump
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !draft.trim()}
              onClick={sendToNotes}
              title={
                draft.trim()
                  ? "Push this dump into Notes, Scripts, and profiles"
                  : "Paste your prep first"
              }
            >
              Send to desk notes
            </Button>
            <Button
              size="sm"
              disabled={busy || !draft.trim()}
              onClick={filePrep}
              className="desk-btn-accent"
              title="Keep this pasted body and file it into Notes, Scripts, profiles"
            >
              {busy ? "Filing…" : "File into Notes & Scripts"}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-2">
          {msg && (
            <p
              className={`text-xs ${
                /failed|error|no content|could not|page instead|nothing mapped|paste your prep/i.test(
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
              Dump is empty — paste your prep, then file it into Notes, Scripts,
              profiles.
            </p>
          )}
          <textarea
            className="w-full min-h-[420px] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed font-mono"
            value={draft}
            onChange={(e) => {
              draftDirty.current = true;
              setDraft(e.target.value);
            }}
            placeholder="Paste your prep here — one dump. We file it into Notes, Scripts, profiles."
          />
        </CardBody>
      </Card>
    </div>
  );
}
