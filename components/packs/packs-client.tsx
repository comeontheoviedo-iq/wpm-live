"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle } from "lucide-react";

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

export function PacksClient({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [gemini, setGemini] = useState(false);
  const [active, setActive] = useState<string>("research");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/matches/${matchId}/packs`);
    const json = await res.json();
    setTemplates(json.templates || []);
    setSections(json.sections || []);
    setGemini(Boolean(json.gemini));
    const key = active || json.templates?.[0]?.key;
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

  async function generate() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/packs/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: active }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || "Generate failed");
        return;
      }
      setDraft(json.section.content);
      setSections((prev) => {
        const others = prev.filter((s) => s.templateKey !== active);
        return [json.section, ...others];
      });
      setMsg(
        json.stub
          ? "Stub placeholder — connect GEMINI_API_KEY to generate for real."
          : "Generated and saved into Scripts / Notes where applicable."
      );
      router.refresh();
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Broadcast packs</h2>
          <p className="text-sm text-slate-500">
            Section-by-section Gemini generation from Chris&apos;s prompt library.
          </p>
        </div>
      </div>

      {!gemini && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 flex gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Gemini not connected</div>
            <p className="text-xs mt-0.5">
              Set <code className="font-mono">GEMINI_API_KEY</code> in .env to
              generate live copy. Without it, each section returns a structured
              placeholder you can still edit and save.
            </p>
          </div>
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
                onClick={() => setActive(t.key)}
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
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={save}>
                Save edit
              </Button>
              <Button size="sm" disabled={busy} onClick={generate}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {busy ? "Working…" : "Generate"}
              </Button>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {msg && <p className="text-xs text-slate-500">{msg}</p>}
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
