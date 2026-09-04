"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer } from "lucide-react";

type PrintData = {
  home: string;
  away: string;
  kickoff: string;
  venue: string;
  speaks: { title: string; body: string; timing: string }[];
  homeSquad: { num: number; name: string; pos: string }[];
  awaySquad: { num: number; name: string; pos: string }[];
  injuries: { player: string; status: string; type: string }[];
  checklist: { label: string; done: boolean }[];
};

export default function PrintPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<PrintData | null>(null);
  const [sections, setSections] = useState({
    squads: true,
    speaks: true,
    injuries: true,
    checklist: true,
  });

  useEffect(() => {
    fetch(`/api/matches/${id}/print`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [id]);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Print / Export</h2>
          <p className="text-sm text-slate-500">
            Select sections, then print or save as PDF
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print match pack
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Select information</CardTitle>
        </CardHeader>
        <CardBody className="grid sm:grid-cols-2 gap-2">
          {(Object.keys(sections) as (keyof typeof sections)[]).map((key) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm capitalize"
            >
              <input
                type="checkbox"
                checked={sections[key]}
                onChange={(e) =>
                  setSections((s) => ({ ...s, [key]: e.target.checked }))
                }
              />
              {key}
            </label>
          ))}
        </CardBody>
      </Card>

      {!data ? (
        <p className="text-sm text-slate-500">Loading export pack…</p>
      ) : (
        <div className="print-area space-y-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
          <header>
            <h1 className="text-2xl font-bold">
              {data.home} vs {data.away}
            </h1>
            <p className="text-sm text-slate-500">
              {data.kickoff} · {data.venue}
            </p>
            <p className="text-xs text-slate-400 mt-1">Pitchline match pack</p>
          </header>

          {sections.squads && (
            <section className="grid md:grid-cols-2 gap-4">
              <Squad title={data.home} rows={data.homeSquad} />
              <Squad title={data.away} rows={data.awaySquad} />
            </section>
          )}

          {sections.speaks && (
            <section>
              <h3 className="font-bold mb-2">Speaks</h3>
              <div className="space-y-2">
                {data.speaks.map((s, i) => (
                  <div key={i} className="text-sm">
                    <div className="font-semibold">
                      [{s.timing}] {s.title}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300">{s.body}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {sections.injuries && (
            <section>
              <h3 className="font-bold mb-2">Injuries</h3>
              <ul className="text-sm space-y-1">
                {data.injuries.map((inj, i) => (
                  <li key={i}>
                    {inj.player} — {inj.status} ({inj.type})
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sections.checklist && (
            <section>
              <h3 className="font-bold mb-2">Checklist</h3>
              <ul className="text-sm space-y-1">
                {data.checklist.map((c, i) => (
                  <li key={i}>
                    [{c.done ? "x" : " "}] {c.label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Squad({
  title,
  rows,
}: {
  title: string;
  rows: { num: number; name: string; pos: string }[];
}) {
  return (
    <div>
      <h3 className="font-bold mb-2">{title}</h3>
      <ul className="text-sm space-y-0.5">
        {rows.map((r) => (
          <li key={r.num}>
            {r.num}. {r.name} ({r.pos})
          </li>
        ))}
      </ul>
    </div>
  );
}
