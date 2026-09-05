/**
 * Secondary free xG probes for competitions outside the primary advanced feed
 * (Süper Lig, Scottish Premiership, UEFA cups, etc.). Soft-fail only — never invent.
 *
 * Probes (in order): soft search APIs / public HTML heads. Provider names stay
 * out of UI messages — callers should label "Advanced stats".
 */

export type AltXgResult = {
  available: boolean;
  /** Internal only — never render in UI */
  source: "alt" | null;
  homeXg: number | null;
  awayXg: number | null;
  message: string;
};

const SOFT: AltXgResult = {
  available: false,
  source: null,
  homeXg: null,
  awayXg: null,
  message: "No free xG source for this competition yet (alt soft-failed).",
};

function competitionWantsAlt(competition: string): boolean {
  const c = competition.toLowerCase();
  return (
    c.includes("süper") ||
    c.includes("super lig") ||
    c.includes("superlig") ||
    c.includes("scottish") ||
    c.includes("premiership") ||
    c.includes("champions league") ||
    c.includes("europa league") ||
    c.includes("conference league")
  );
}

async function softFetch(
  url: string,
  ms = 3500
): Promise<{ ok: boolean; status: number; text?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json,text/html,*/*",
        "User-Agent": "PitchlineDesk/1.0 (commentary prep; soft xG probe)",
      },
      cache: "no-store",
      redirect: "follow",
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text: text.slice(0, 8000) };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

/** Soft Sofascore-style search — never invents xG from search hits. */
async function probeSearchIndex(
  homeName: string,
  awayName: string
): Promise<{ reached: boolean; status: number }> {
  const q = encodeURIComponent(`${homeName} ${awayName}`);
  const r = await softFetch(
    `https://www.sofascore.com/api/v1/search/all?q=${q}&page=0`,
    4000
  );
  return { reached: r.ok, status: r.status };
}

/**
 * Soft FBref-ish public page head — many leagues have match pages but no stable
 * JSON. We only confirm reachability; we do NOT parse invented xG from HTML.
 */
async function probeFbrefReachable(
  homeName: string,
  awayName: string
): Promise<{ reached: boolean; status: number }> {
  const q = encodeURIComponent(`${homeName} ${awayName}`);
  // Search landing — if blocked/404, soft-fail
  const r = await softFetch(
    `https://fbref.com/en/search/search.fcgi?search=${q}`,
    4000
  );
  return { reached: r.ok || r.status === 200, status: r.status };
}

/**
 * Attempt alt xG. Always soft-fails cleanly unless a future verified endpoint
 * returns real numbers — no fabricated values.
 */
export async function tryAltXg(opts: {
  competition: string;
  homeName: string;
  awayName: string;
  kickoff: Date | string;
}): Promise<AltXgResult> {
  if (!competitionWantsAlt(opts.competition)) {
    return {
      ...SOFT,
      message:
        "Alt xG not applicable — competition outside secondary coverage set.",
    };
  }

  try {
    const [sofa, fb] = await Promise.all([
      probeSearchIndex(opts.homeName, opts.awayName),
      probeFbrefReachable(opts.homeName, opts.awayName),
    ]);

    // Even on 200 we do not invent xG from search/HTML — need a dedicated verified endpoint.
    const reached = [];
    if (sofa.reached) reached.push(`search:${sofa.status}`);
    else reached.push(`search:${sofa.status || "blocked"}`);
    if (fb.reached) reached.push(`stats-page:${fb.status}`);
    else reached.push(`stats-page:${fb.status || "blocked"}`);

    return {
      ...SOFT,
      message: `xG unavailable for ${opts.competition} — no verified free match xG endpoint (${reached.join(", ")}).`,
    };
  } catch {
    return {
      ...SOFT,
      message: `xG unavailable for ${opts.competition} (alt source soft-failed).`,
    };
  }
}

/**
 * Soft-read expected goals from AF fixture statistics rows when present.
 * AF Pro sometimes includes "expected_goals" — Free often does not.
 */
export function xgFromAfStatistics(
  rows: { type?: string; label?: string; home?: string | number | null; away?: string | number | null; statistics?: { type?: string; value?: string | number | null }[] }[]
): { homeXg: number | null; awayXg: number | null } | null {
  // Shape A: our desk StatRow-like { label, homeValue, awayValue } passed loosely
  for (const r of rows as { label?: string; type?: string; homeValue?: string | number; awayValue?: string | number; home?: string | number; away?: string | number }[]) {
    const lab = `${r.label || r.type || ""}`.toLowerCase();
    if (!/expected.?goal|xg\b|xG/.test(lab) && !/expected_goals/.test(lab)) continue;
    const h = Number(r.homeValue ?? r.home);
    const a = Number(r.awayValue ?? r.away);
    if (Number.isFinite(h) && Number.isFinite(a)) {
      return { homeXg: Math.round(h * 100) / 100, awayXg: Math.round(a * 100) / 100 };
    }
  }
  // Shape B: raw AF fixtures/statistics
  let homeXg: number | null = null;
  let awayXg: number | null = null;
  for (const block of rows as { statistics?: { type?: string; value?: string | number | null }[]; team?: { id?: number } }[]) {
    for (const s of block.statistics || []) {
      if (!/expected.?goal/i.test(s.type || "")) continue;
      const n = Number(s.value);
      if (!Number.isFinite(n)) continue;
      if (homeXg == null) homeXg = Math.round(n * 100) / 100;
      else awayXg = Math.round(n * 100) / 100;
    }
  }
  if (homeXg != null && awayXg != null) return { homeXg, awayXg };
  return null;
}
