/**
 * Secondary free xG attempt for competitions Understat does not cover
 * (Süper Lig, Scottish Premiership). Soft-fail only — never invent numbers.
 *
 * FotMob public match endpoints currently 404 / block; we try a lightweight
 * Sofascore public proxy pattern and treat any failure as unavailable.
 */

export type AltXgResult = {
  available: boolean;
  source: "Sofascore" | null;
  homeXg: number | null;
  awayXg: number | null;
  message: string;
};

const SOFT: AltXgResult = {
  available: false,
  source: null,
  homeXg: null,
  awayXg: null,
  message:
    "No free xG source for this competition yet (Understat top-5 only; alt soft-failed).",
};

function competitionWantsAlt(competition: string): boolean {
  const c = competition.toLowerCase();
  return (
    c.includes("süper") ||
    c.includes("super lig") ||
    c.includes("superlig") ||
    c.includes("scottish") ||
    c.includes("premiership")
  );
}

/**
 * Attempt alt xG. Always soft-fails cleanly — no fabricated values.
 * Network/parse errors → unavailable message.
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
      message: "Alt xG not applicable — competition is outside Süper Lig / Scotland fallback set.",
    };
  }

  try {
    // Soft probe: Sofascore search is brittle and often blocked from server IPs.
    // We deliberately do not scrape HTML shot maps. Honest unavailable is OK.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4_000);
    const q = encodeURIComponent(`${opts.homeName} ${opts.awayName}`);
    const res = await fetch(
      `https://www.sofascore.com/api/v1/search/all?q=${q}&page=0`,
      {
        signal: ctrl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "PitchlineDesk/1.0 (commentary prep; xG soft probe)",
        },
        cache: "no-store",
      }
    ).catch(() => null);
    clearTimeout(t);

    if (!res || !res.ok) {
      return {
        ...SOFT,
        message: `xG unavailable for ${opts.competition} (Understat uncovered; Sofascore probe ${res ? res.status : "blocked"}).`,
      };
    }

    // Even on 200 we do not invent xG from search hits — match xG needs a dedicated endpoint.
    return {
      ...SOFT,
      message: `xG unavailable for ${opts.competition} — no verified free match xG endpoint (probe reached search only).`,
    };
  } catch {
    return {
      ...SOFT,
      message: `xG unavailable for ${opts.competition} (alt source soft-failed).`,
    };
  }
}
