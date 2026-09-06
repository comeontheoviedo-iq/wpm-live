"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { leagueIdForCompetition } from "@/lib/competitions";
import {
  formatLiveClock,
  formatPitchClockBadge,
} from "@/lib/live-clock";
import { DataVizFlashCard } from "@/components/match/data-viz-flash";
import {
  pickViz,
  type MomentumSample,
  type ShotPoint,
  type VizFlashKind,
  type VizPayload,
} from "@/lib/viz-build";
import {
  evaluateMomentumProxy,
  evaluatePlayerThresholds,
  type LivePlayerStatRow,
} from "@/lib/live-stat-triggers";
import {
  enrichFlashLines,
  momentFingerprint,
  shouldEmitMomentFlash,
} from "@/lib/flash-enrich";

type StatRow = {
  label: string;
  homeValue: string | number;
  awayValue: string | number;
};

type EventRow = {
  id?: string;
  type: string;
  minute: number;
  description: string;
  teamSide?: string | null;
};

type LivePopup = {
  id: string;
  kind: "goal" | "sub" | "fact";
  title: string;
  subtitle?: string;
  lines: string[];
  scoreline?: string;
  pinned?: boolean;
  createdAt: number;
  viz?: VizPayload | null;
};

export function ObsOverlayClient(props: {
  matchId: string;
  matchDayId: string;
  homeName: string;
  awayName: string;
  homeAbbr?: string | null;
  awayAbbr?: string | null;
  homeColor: string;
  awayColor: string;
  homeTeamAfId?: number | null;
  awayTeamAfId?: number | null;
  competition: string;
  apiFootballFixtureId?: number | null;
  status: string;
  homeScore: number;
  awayScore: number;
  minute: number;
  minuteExtra?: number | null;
  /** AF/synced period — often "HT" while status stays "Live" (mapAfStatus). */
  period?: string | null;
  events: EventRow[];
  statistics: StatRow[];
}) {
  const {
    matchId,
    homeName,
    awayName,
    homeAbbr,
    awayAbbr,
    homeColor,
    awayColor,
    homeTeamAfId,
    awayTeamAfId,
    competition,
    apiFootballFixtureId,
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();
  const scorebugParam = (searchParams.get("scorebug") || "").trim().toLowerCase();
  const noscorebugParam = (searchParams.get("noscorebug") || "").trim().toLowerCase();
  const showScorebug =
    scorebugParam !== "0" &&
    scorebugParam !== "off" &&
    scorebugParam !== "false" &&
    noscorebugParam !== "1" &&
    noscorebugParam !== "true" &&
    noscorebugParam !== "yes";
  const flashesLower =
    (searchParams.get("flashes") || "").trim().toLowerCase() === "lower";


  const [status, setStatus] = useState(props.status);
  const [period, setPeriod] = useState<string | null>(props.period ?? null);
  const [homeScore, setHomeScore] = useState(props.homeScore);
  const [awayScore, setAwayScore] = useState(props.awayScore);
  const [minute, setMinute] = useState(props.minute);
  const [minuteExtra, setMinuteExtra] = useState<number | null>(
    props.minuteExtra ?? null
  );
  const [events, setEvents] = useState<EventRow[]>(props.events || []);
  const [statistics, setStatistics] = useState<StatRow[]>(props.statistics || []);
  const [livePopups, setLivePopups] = useState<LivePopup[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const seenEventKeysRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef({ home: props.homeScore, away: props.awayScore });
  const scoreSampleRef = useRef({ home: props.homeScore, away: props.awayScore });
  const statisticsRef = useRef<StatRow[]>(props.statistics || []);
  const eventsRef = useRef<EventRow[]>(props.events || []);
  const livePlayerStatsRef = useRef<LivePlayerStatRow[]>([]);
  const possessionSamplesRef = useRef<number[]>([]);
  const momentumSamplesRef = useRef<MomentumSample[]>([]);
  const recentVizKindsRef = useRef<VizFlashKind[]>([]);
  const advStatsCacheRef = useRef<{
    homeXg: number | null;
    awayXg: number | null;
    shots: ShotPoint[];
    at: number;
  } | null>(null);
  const firedStatTriggersRef = useRef<Set<string>>(new Set());
  const htVizEmittedRef = useRef(false);
  const ftVizPreviewRef = useRef(false);
  const momentFpRef = useRef<string | null>(null);

  useEffect(() => {
    scoreRef.current = { home: homeScore, away: awayScore };
    scoreSampleRef.current = { home: homeScore, away: awayScore };
  }, [homeScore, awayScore]);
  useEffect(() => {
    statisticsRef.current = statistics;
  }, [statistics]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Mirror desk: after router.refresh(), adopt fresh server props
  useEffect(() => {
    setStatus(props.status);
    setPeriod(props.period ?? null);
    setHomeScore(props.homeScore);
    setAwayScore(props.awayScore);
    setMinute(props.minute);
    setMinuteExtra(props.minuteExtra ?? null);
    setEvents(props.events || []);
    setStatistics(props.statistics || []);
    scoreRef.current = { home: props.homeScore, away: props.awayScore };
    scoreSampleRef.current = { home: props.homeScore, away: props.awayScore };
    statisticsRef.current = props.statistics || [];
    eventsRef.current = props.events || [];
  }, [
    props.status,
    props.period,
    props.homeScore,
    props.awayScore,
    props.minute,
    props.minuteExtra,
    props.events,
    props.statistics,
  ]);

  // Transparent OBS canvas — strip app chrome backgrounds / scrollbars
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    html.classList.add("obs-overlay-active");
    body.classList.add("obs-overlay-active");
    const prevHtmlBg = html.style.background;
    const prevBodyBg = body.style.background;
    const prevOverflow = body.style.overflow;
    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    return () => {
      html.classList.remove("obs-overlay-active");
      body.classList.remove("obs-overlay-active");
      html.style.background = prevHtmlBg;
      body.style.background = prevBodyBg;
      body.style.overflow = prevOverflow;
    };
  }, []);

  // Seed seen keys so initial hydrate does not spam flashes
  useEffect(() => {
    for (const e of props.events || []) {
      seenEventKeysRef.current.add(
        `${e.minute}|${e.type}|${e.description}`
      );
    }
  }, [props.events]);

  const homeLogoUrl = homeTeamAfId
    ? `https://media.api-sports.io/football/teams/${homeTeamAfId}.png`
    : null;
  const awayLogoUrl = awayTeamAfId
    ? `https://media.api-sports.io/football/teams/${awayTeamAfId}.png`
    : null;
  const leagueAfId = leagueIdForCompetition(competition);
  const leagueLogoUrl = leagueAfId
    ? `https://media.api-sports.io/football/leagues/${leagueAfId}.png`
    : null;

  const homeCode = (homeAbbr || homeName).slice(0, 3).toUpperCase();
  const awayCode = (awayAbbr || awayName).slice(0, 3).toUpperCase();

  const statusShortBase =
    status === "Full Time" || period === "FT"
      ? "FT"
      : status === "Half Time" || period === "HT"
        ? "HT"
        : status === "Live"
          ? "LIVE"
          : null;
  const statusShort = formatPitchClockBadge(
    minute,
    minuteExtra,
    statusShortBase
  );
  const clockLabel = formatLiveClock(minute, minuteExtra, {
    status: status === "Half Time" || period === "HT" ? "Half Time" : status,
  });
  const isHalfTime =
    status === "Half Time" ||
    period === "HT" ||
    statusShort === "HT" ||
    clockLabel === "HT";

  const accentsCollide =
    homeColor.trim().toLowerCase() === awayColor.trim().toLowerCase();
  const leftAccent = accentsCollide ? "#f8fafc" : homeColor;
  const rightAccent = accentsCollide ? "#e11d48" : awayColor;

  const dismissLivePopup = useCallback((id: string) => {
    setLivePopups((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const pushLivePopup = useCallback(
    (
      popup: Omit<LivePopup, "id" | "createdAt" | "pinned"> & { id?: string },
      ttlMs: number
    ) => {
      const id = popup.id || `live|${Date.now()}`;
      const full: LivePopup = {
        ...popup,
        id,
        createdAt: Date.now(),
        pinned: false,
      };
      setLivePopups((prev) => [...prev, full].slice(-5));
      if (ttlMs > 0) {
        window.setTimeout(() => dismissLivePopup(id), ttlMs);
      }
      return id;
    },
    [dismissLivePopup]
  );

  const fetchAdvancedViz = useCallback(async () => {
    const cached = advStatsCacheRef.current;
    if (cached && Date.now() - cached.at < 60_000) return cached;
    try {
      const res = await fetch(`/api/matches/${matchId}/advanced-stats?obs=1`, {
        cache: "no-store",
        headers: { "x-pitchline-obs": "1" },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const payload = {
        homeXg: json.homeXg ?? null,
        awayXg: json.awayXg ?? null,
        shots: (json.shots || []) as ShotPoint[],
        at: Date.now(),
      };
      advStatsCacheRef.current = payload;
      return payload;
    } catch {
      return null;
    }
  }, [matchId]);

  const attachVizToPopup = useCallback(
    async (
      popupId: string,
      prefer: VizFlashKind | null,
      context: string = "default",
      extra?: { focusStat?: string | null }
    ) => {
      const adv = await fetchAdvancedViz();
      const bags = {
        shots: adv?.shots || [],
        homeXg: adv?.homeXg ?? null,
        awayXg: adv?.awayXg ?? null,
        homeGoals: scoreSampleRef.current.home,
        awayGoals: scoreSampleRef.current.away,
        possessionSamples: [...possessionSamplesRef.current],
        statistics: statisticsRef.current,
        events: eventsRef.current.map((e) => ({
          minute: e.minute,
          type: e.type,
          teamSide: e.teamSide ?? null,
          description: e.description,
        })),
        livePlayerStats: livePlayerStatsRef.current,
        momentumSamples: [...momentumSamplesRef.current],
        focusStat: extra?.focusStat ?? null,
      };
      const viz = pickViz({
        prefer,
        context,
        bags,
        recentKinds: recentVizKindsRef.current,
      });
      if (!viz) return;
      recentVizKindsRef.current = [
        ...recentVizKindsRef.current,
        viz.kind,
      ].slice(-6);
      setLivePopups((prev) =>
        prev.map((p) => (p.id === popupId ? { ...p, viz } : p))
      );
    },
    [fetchAdvancedViz]
  );

  const sync = useCallback(
    async (silent = true) => {
      if (!apiFootballFixtureId) return;
      try {
        const res = await fetch(`/api/matches/${matchId}/sync?obs=1`, {
          method: "POST",
          headers: { "x-pitchline-obs": "1" },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!silent) console.warn("[obs-overlay] sync", json?.error);
          return;
        }

        const syncedHome =
          typeof json.homeScore === "number"
            ? json.homeScore
            : typeof json.match?.homeScore === "number"
              ? json.match.homeScore
              : null;
        const syncedAway =
          typeof json.awayScore === "number"
            ? json.awayScore
            : typeof json.match?.awayScore === "number"
              ? json.match.awayScore
              : null;
        if (syncedHome != null && syncedAway != null) {
          setHomeScore(syncedHome);
          setAwayScore(syncedAway);
          scoreRef.current = { home: syncedHome, away: syncedAway };
          scoreSampleRef.current = { home: syncedHome, away: syncedAway };
        }

        const syncedMinute =
          typeof json.match?.minute === "number"
            ? json.match.minute
            : typeof json.minute === "number"
              ? json.minute
              : null;
        if (syncedMinute != null) setMinute(syncedMinute);
        if ("minuteExtra" in (json.match || {}) || "minuteExtra" in json) {
          const ex = json.match?.minuteExtra ?? json.minuteExtra ?? null;
          setMinuteExtra(
            typeof ex === "number" && Number.isFinite(ex) ? ex : null
          );
        }

        const nextStatus =
          json.match?.status || json.status || null;
        if (typeof nextStatus === "string" && nextStatus) {
          setStatus(nextStatus);
        }
        const nextPeriod =
          json.match?.period || json.period || null;
        if (typeof nextPeriod === "string" && nextPeriod) {
          setPeriod(nextPeriod);
        }

        if (Array.isArray(json.statistics)) {
          const rows = json.statistics as StatRow[];
          setStatistics(rows);
          statisticsRef.current = rows;
        }

        if (Array.isArray(json.events)) {
          setEvents(json.events as EventRow[]);
        } else if (Array.isArray(json.match?.events)) {
          setEvents(json.match.events as EventRow[]);
        }

        if (Array.isArray(json.livePlayerStats)) {
          livePlayerStatsRef.current = json.livePlayerStats as LivePlayerStatRow[];
        }

        // Possession + momentum samples (same shape as live desk)
        {
          const rows = statisticsRef.current;
          const poss = rows.find((s) => /possession/i.test(String(s.label || "")));
          const shots =
            rows.find(
              (s) =>
                /^shots$/i.test(String(s.label || "")) ||
                /total shots/i.test(String(s.label || ""))
            ) || null;
          const parse = (v: string | number | null | undefined) => {
            if (v == null) return null;
            const n = Number(String(v).replace("%", "").replace(/[^\d.-]/g, ""));
            return Number.isFinite(n) ? n : null;
          };
          const hPoss = poss ? parse(poss.homeValue) : null;
          if (hPoss != null) {
            const arr = possessionSamplesRef.current;
            const last = arr[arr.length - 1];
            if (last == null || Math.abs(last - hPoss) >= 1) {
              possessionSamplesRef.current = [...arr, hPoss].slice(-24);
            }
          }
          const hShots = shots ? parse(shots.homeValue) : null;
          const aShots = shots ? parse(shots.awayValue) : null;
          if (hPoss != null || (hShots != null && aShots != null)) {
            const mom = momentumSamplesRef.current;
            const prev = mom[mom.length - 1];
            const same =
              prev &&
              prev.homePoss === hPoss &&
              prev.homeShots === hShots &&
              prev.awayShots === aShots &&
              prev.homeScore === scoreSampleRef.current.home &&
              prev.awayScore === scoreSampleRef.current.away;
            if (!same) {
              momentumSamplesRef.current = [
                ...mom,
                {
                  at: Date.now(),
                  homePoss: hPoss,
                  homeShots: hShots,
                  awayShots: aShots,
                  homeScore: scoreSampleRef.current.home,
                  awayScore: scoreSampleRef.current.away,
                },
              ].slice(-40);
            }
          }
        }

        const news = (json.newEvents || []) as EventRow[];
        for (const e of news) {
          const key = `${e.minute}|${e.type}|${e.description}`;
          if (seenEventKeysRef.current.has(key)) continue;
          seenEventKeysRef.current.add(key);

          const scoreline = `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`;
          if (/goal|penalty_goal|own_goal/i.test(e.type || "")) {
            const id = `${key}|${Date.now()}`;
            pushLivePopup(
              {
                id,
                kind: "goal",
                title: `GOAL ${e.minute}'`,
                subtitle: e.description,
                lines: enrichFlashLines({
                  baseLines: [e.description],
                  scoreline,
                  relevantNotes: [],
                  statistics: statisticsRef.current,
                }).slice(0, 4),
                scoreline,
              },
              15_000
            );
            window.setTimeout(
              () => void attachVizToPopup(id, "shot_map", "goal"),
              80
            );
          } else if (/sub/i.test(e.type || "")) {
            const id = `${key}|${Date.now()}`;
            pushLivePopup(
              {
                id,
                kind: "sub",
                title: `SUB ${e.minute}'`,
                subtitle: e.description,
                lines: [e.description],
                scoreline,
              },
              12_000
            );
          } else if (/yellow|red|card|var/i.test(e.type || "")) {
            const id = `${key}|${Date.now()}`;
            pushLivePopup(
              {
                id,
                kind: "fact",
                title: `${e.type} ${e.minute}'`,
                subtitle: e.description,
                lines: [e.description],
                scoreline,
              },
              12_000
            );
            window.setTimeout(
              () => void attachVizToPopup(id, "card_timeline", "card"),
              80
            );
          }
        }

        // Threshold / momentum flashes (soft-fail) — same helpers as live desk
        try {
          const liveStats = livePlayerStatsRef.current;
          const fired = firedStatTriggersRef.current;
          const thr = evaluatePlayerThresholds(liveStats, fired);
          const mom = evaluateMomentumProxy({
            statistics: statisticsRef.current,
            possessionSamples: possessionSamplesRef.current,
            fired,
            homeName,
            awayName,
          });
          const flashes = [...thr, ...mom].slice(0, 4);
          for (const fl of flashes) {
            const id = `${fl.id}|${Date.now()}`;
            pushLivePopup(
              {
                id,
                kind: "fact",
                title: fl.title,
                lines: fl.lines.slice(0, 6),
                scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
              },
              12_000
            );
            window.setTimeout(() => {
              void attachVizToPopup(
                id,
                (fl.vizHint as VizFlashKind | null) || null,
                fl.stat || "default",
                { focusStat: fl.focusStat || fl.stat }
              );
            }, 80);
          }
        } catch {
          /* soft-fail triggers */
        }

        // FT sample viz once
        const st = String(nextStatus || status || "");
        if (
          (st === "Full Time" || st === "Finished") &&
          !ftVizPreviewRef.current
        ) {
          ftVizPreviewRef.current = true;
          const id = `ft-viz|${Date.now()}`;
          pushLivePopup(
            {
              id,
              kind: "fact",
              title: "Full-time",
              lines: [
                `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
                "Sample chart from available team stats",
              ],
              scoreline: `${homeName} ${scoreRef.current.home}–${scoreRef.current.away} ${awayName}`,
            },
            18_000
          );
          window.setTimeout(
            () => void attachVizToPopup(id, "match_dna", "ht"),
            100
          );
        }

        // Soft refresh props (statistics / events) like the live desk
        try {
          router.refresh();
        } catch {
          /* ignore */
        }
      } catch {
        /* soft-fail network */
      }
    },
    [
      apiFootballFixtureId,
      matchId,
      homeName,
      awayName,
      pushLivePopup,
      attachVizToPopup,
      status,
      router,
    ]
  );

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => setConfigured(Boolean(j.apiFootball)))
      .catch(() => setConfigured(false));
  }, []);

  // Same feed as live desk: poll sync while Live; slower probe otherwise
  useEffect(() => {
    if (!configured || !apiFootballFixtureId) return;
    void sync(true);
    const ms = status === "Live" ? 18_000 : 45_000;
    const t = setInterval(() => void sync(true), ms);
    return () => clearInterval(t);
  }, [configured, apiFootballFixtureId, status, sync]);

  // HT viz once — AF maps HT→status Live but period/clock still say HT
  useEffect(() => {
    if (!isHalfTime) {
      if (status === "Live" || status === "Not Started" || status === "Assigned") {
        htVizEmittedRef.current = false;
      }
      return;
    }
    if (htVizEmittedRef.current) return;
    htVizEmittedRef.current = true;
    const id = `ht-viz|${Date.now()}`;
    pushLivePopup(
      {
        id,
        kind: "fact",
        title: "Half-time",
        lines: [
          `${homeName} ${homeScore}–${awayScore} ${awayName}`,
          "xG race / possession when available",
        ],
        scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
      },
      16_000
    );
    // Soft-fail: attachVizToPopup no-ops when advanced-stats/xG unavailable
    window.setTimeout(() => void attachVizToPopup(id, "xg_race", "ht"), 100);
  }, [
    isHalfTime,
    status,
    homeName,
    awayName,
    homeScore,
    awayScore,
    attachVizToPopup,
    pushLivePopup,
  ]);

  // Moment flash on fingerprint change (Live only)
  useEffect(() => {
    if (status !== "Live") return;
    const last = events[0];
    const shotsOn = statistics.find((s) =>
      /shots on/i.test(String(s.label || ""))
    );
    const fp = momentFingerprint({
      scoreHome: homeScore,
      scoreAway: awayScore,
      lastEventKey: last
        ? `${last.minute}|${last.type}|${last.description}`
        : null,
      onTargetHome: shotsOn ? Number(shotsOn.homeValue) : null,
      onTargetAway: shotsOn ? Number(shotsOn.awayValue) : null,
    });
    if (!shouldEmitMomentFlash(momentFpRef.current, fp)) return;
    const prev = momentFpRef.current;
    momentFpRef.current = fp;
    if (prev == null) return;
    const id = `moment|${Date.now()}`;
    pushLivePopup(
      {
        id,
        kind: "fact",
        title: "Moment",
        lines: enrichFlashLines({
          baseLines: last
            ? [`${last.minute}' ${last.description}`]
            : [`Score now ${homeName} ${homeScore}–${awayScore} ${awayName}`],
          scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
          relevantNotes: [],
          statistics,
        }).slice(0, 4),
        scoreline: `${homeName} ${homeScore}–${awayScore} ${awayName}`,
      },
      10_000
    );
    window.setTimeout(
      () => void attachVizToPopup(id, "possession", "moment"),
      80
    );
  }, [
    status,
    homeScore,
    awayScore,
    events,
    statistics,
    homeName,
    awayName,
    attachVizToPopup,
    pushLivePopup,
  ]);

  const scorebugClock = useMemo(() => {
    if (statusShort) return statusShort;
    if (status === "Live" && clockLabel) return clockLabel;
    return null;
  }, [statusShort, status, clockLabel]);

  return (
    <div
      className="obs-overlay"
      data-obs-overlay="1"
      data-match-id={matchId}
      style={{
        width: 1920,
        height: 1080,
        overflow: "hidden",
        background: "transparent",
        position: "relative",
      }}
    >
      {/* Scorebug — top center, craft TV eyebar (off via ?scorebug=0|off or ?noscorebug=1) */}
      {showScorebug ? (
      <div className="obs-overlay-scorebug pointer-events-none absolute left-1/2 top-10 z-20 flex -translate-x-1/2 flex-col items-center">
        <div className="scorebug pointer-events-auto">
          {leagueLogoUrl ? (
            <span className="scorebug-league" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={leagueLogoUrl}
                alt=""
                className="scorebug-league-img"
              />
            </span>
          ) : null}
          <div className="scorebug-crest">
            {homeLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={homeLogoUrl} alt="" className="scorebug-crest-img" />
            ) : (
              <span className="scorebug-code">{homeCode}</span>
            )}
            <span
              className="scorebug-hairline"
              style={{ backgroundColor: leftAccent }}
              aria-hidden
            />
          </div>
          <span className="scorebug-score">
            {homeScore}
            <span className="scorebug-score-sep">–</span>
            {awayScore}
          </span>
          {scorebugClock ? (
            <>
              <span className="scorebug-divider" aria-hidden />
              <span className="scorebug-clock">{scorebugClock}</span>
            </>
          ) : null}
          <div className="scorebug-crest">
            {awayLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={awayLogoUrl} alt="" className="scorebug-crest-img" />
            ) : (
              <span className="scorebug-code">{awayCode}</span>
            )}
            <span
              className="scorebug-hairline"
              style={{ backgroundColor: rightAccent }}
              aria-hidden
            />
          </div>
        </div>
      </div>
      ) : null}

      {/* Live intel + data-viz flashes — default under scorebug; ?flashes=lower → lower-third */}
      {livePopups.length > 0 ? (
        <div
          className={cn(
            "obs-overlay-flashes absolute left-1/2 z-[60] flex w-[min(94%,26rem)] -translate-x-1/2 flex-col gap-2",
            flashesLower
              ? "bottom-[20%] top-auto items-center drop-shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
              : "top-28"
          )}
          data-flashes-placement={flashesLower ? "lower" : "top"}
        >
          {livePopups.map((popup) => {
            const titleU = `${popup.title} ${popup.subtitle || ""}`.toUpperCase();
            const flashTier =
              popup.kind === "goal"
                ? "live-flash-goal"
                : popup.kind === "sub"
                  ? "live-flash-sub"
                  : /\bRED\b|VAR/.test(titleU)
                    ? "live-flash-red"
                    : /YELLOW|CARD/.test(titleU)
                      ? "live-flash-card"
                      : /INJUR|STRETCHER/.test(titleU)
                        ? "live-flash-injury"
                        : "live-flash-fact";
            const minMatch = popup.title.match(/(\d{1,3})\s*['′]/);
            const flashMinute = minMatch
              ? `${minMatch[1]}'`
              : minute > 0
                ? `${minute}'`
                : "";
            return (
              <div
                key={popup.id}
                role="dialog"
                aria-label={popup.title}
                className={cn("live-flash px-2.5 py-1.5 text-left", flashTier)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="live-flash-meta min-w-0 truncate">
                    {popup.kind === "goal"
                      ? "Goal"
                      : popup.kind === "sub"
                        ? "Sub"
                        : "Live"}
                    {popup.scoreline ? ` · ${popup.scoreline}` : ""}
                  </div>
                  {flashMinute ? (
                    <span className="live-flash-time">{flashMinute}</span>
                  ) : null}
                </div>
                <div className="live-flash-headline min-w-0">
                  {popup.title}
                  {popup.subtitle ? (
                    <span className="ml-1.5 text-[0.8em] font-bold text-slate-300">
                      {popup.subtitle}
                    </span>
                  ) : null}
                </div>
                {popup.viz ? (
                  <span className="live-flash-chip mt-1 inline-flex">
                    Advanced stats
                  </span>
                ) : null}
                {popup.lines.length > 0 ? (
                  <ul className="live-flash-body mt-1 space-y-0.5">
                    {popup.lines.map((line, i) => (
                      <li key={i} className="leading-snug">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {popup.viz ? (
                  <div className="live-flash-viz">
                    <DataVizFlashCard
                      kind={popup.viz.kind}
                      shots={popup.viz.shots}
                      homeXg={popup.viz.homeXg}
                      awayXg={popup.viz.awayXg}
                      homeGoals={popup.viz.homeGoals}
                      awayGoals={popup.viz.awayGoals}
                      homeName={homeName}
                      awayName={awayName}
                      homeColor={homeColor}
                      awayColor={awayColor}
                      possessionSamples={popup.viz.possessionSamples}
                      compare={popup.viz.compare}
                      compareTitle={popup.viz.compareTitle}
                      dna={popup.viz.dna}
                      leaderboard={popup.viz.leaderboard}
                      leaderboardTitle={popup.viz.leaderboardTitle}
                      gkName={popup.viz.gkName}
                      gkSaves={popup.viz.gkSaves}
                      gkSide={popup.viz.gkSide}
                      timelineEvents={popup.viz.timelineEvents}
                      timelineTitle={popup.viz.timelineTitle}
                      momentumSamples={popup.viz.momentumSamples}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
