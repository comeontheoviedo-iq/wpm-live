"use client";

import { cn } from "@/lib/utils";
import type {
  CompareStat,
  LeaderboardRow,
  MomentumSample,
  ShotPoint,
  TimelineEvent,
  VizFlashKind,
} from "@/lib/viz-build";
export type { ShotPoint, VizFlashKind };


function Label({ children }: { children: import("react").ReactNode }) {
  return (
    <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500">
      {children}
    </div>
  );
}

function Soft({ children, className }: { children: import("react").ReactNode; className?: string }) {
  return (
    <p className={cn("text-[10px] text-slate-500", className)}>{children}</p>
  );
}

export function ShotMapMini({
  shots,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  shots: ShotPoint[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (!shots.length) {
    return <Soft className={className}>Shot map not available yet.</Soft>;
  }
  return (
    <div className={cn("relative w-full", className)}>
      <Label>Shot map</Label>
      <svg
        viewBox="0 0 100 68"
        className="w-full rounded-[2px] border border-white/10 bg-emerald-950/80"
      >
        <rect x="0" y="0" width="100" height="68" fill="#064e3b" />
        <rect
          x="0.5"
          y="0.5"
          width="99"
          height="67"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.6"
        />
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="68"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="0.5"
        />
        <circle
          cx="50"
          cy="34"
          r="9"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
        <rect
          x="0"
          y="20"
          width="12"
          height="28"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
        <rect
          x="88"
          y="20"
          width="12"
          height="28"
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
        {shots.map((s, i) => {
          const cx = Math.max(1, Math.min(99, s.x * 100));
          const cy = Math.max(1, Math.min(67, s.y * 68));
          const r = Math.max(1.2, Math.min(4.5, 1 + s.xg * 6));
          const isGoal = /goal/i.test(s.result);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={s.side === "home" ? homeColor : awayColor}
              fillOpacity={isGoal ? 1 : 0.55}
              stroke={isGoal ? "#fff" : "transparent"}
              strokeWidth={isGoal ? 0.6 : 0}
            >
              <title>{`${s.player || "Shot"} · xG ${s.xg.toFixed(2)} · ${s.result}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-slate-500">
        <span style={{ color: homeColor }}>● Home</span>
        <span>size ≈ xG · ring = goal</span>
        <span style={{ color: awayColor }}>Away ●</span>
      </div>
    </div>
  );
}

export function XgRaceBar({
  homeXg,
  awayXg,
  homeName,
  awayName,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  homeXg: number;
  awayXg: number;
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  const t = homeXg + awayXg || 1;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>xG race</Label>
      <div className="flex items-end justify-between gap-2 text-xs">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[10px] text-slate-500">{homeName}</div>
          <div className="text-lg font-black tabular-nums" style={{ color: homeColor }}>
            {homeXg.toFixed(2)}
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400 pb-1">xG</div>
        <div className="min-w-0 flex-1 text-right">
          <div className="truncate text-[10px] text-slate-500">{awayName}</div>
          <div className="text-lg font-black tabular-nums" style={{ color: awayColor }}>
            {awayXg.toFixed(2)}
          </div>
        </div>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full"
          style={{ width: `${(homeXg / t) * 100}%`, backgroundColor: homeColor }}
        />
        <div
          className="h-full"
          style={{ width: `${(awayXg / t) * 100}%`, backgroundColor: awayColor }}
        />
      </div>
    </div>
  );
}

/** Cumulative xG race over match minutes (needs shot.minute). */
export function XgTimeline({
  shots,
  homeName,
  awayName,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  shots: ShotPoint[];
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  const timed = shots
    .filter((s) => typeof s.minute === "number" && Number.isFinite(s.xg))
    .slice()
    .sort((a, b) => (a.minute || 0) - (b.minute || 0));
  if (timed.length < 2) {
    return <Soft className={className}>xG timeline needs shot minutes.</Soft>;
  }
  const maxMin = Math.max(90, ...timed.map((s) => s.minute || 0));
  let hCum = 0;
  let aCum = 0;
  const hPts: { m: number; v: number }[] = [{ m: 0, v: 0 }];
  const aPts: { m: number; v: number }[] = [{ m: 0, v: 0 }];
  for (const s of timed) {
    if (s.side === "home") {
      hCum += s.xg;
      hPts.push({ m: s.minute!, v: hCum });
    } else {
      aCum += s.xg;
      aPts.push({ m: s.minute!, v: aCum });
    }
  }
  hPts.push({ m: maxMin, v: hCum });
  aPts.push({ m: maxMin, v: aCum });
  const maxY = Math.max(0.5, hCum, aCum) * 1.1;
  const w = 200;
  const h = 56;
  const toXY = (m: number, v: number) => {
    const x = (m / maxMin) * w;
    const y = h - (v / maxY) * (h - 4) - 2;
    return `${x},${y}`;
  };
  return (
    <div className={cn("space-y-1", className)}>
      <Label>xG timeline</Label>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-12 w-full rounded-[2px] border border-white/[0.06] bg-black/30"
      >
        <polyline
          fill="none"
          stroke={homeColor}
          strokeWidth="1.8"
          points={hPts.map((p) => toXY(p.m, p.v)).join(" ")}
        />
        <polyline
          fill="none"
          stroke={awayColor}
          strokeWidth="1.8"
          points={aPts.map((p) => toXY(p.m, p.v)).join(" ")}
        />
      </svg>
      <div className="flex justify-between text-[9px] tabular-nums text-slate-500">
        <span style={{ color: homeColor }}>
          {homeName} {hCum.toFixed(2)}
        </span>
        <span>0′ → {maxMin}′</span>
        <span style={{ color: awayColor }}>
          {awayName} {aCum.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function outcomeBucket(result: string): string {
  const r = (result || "").toLowerCase();
  if (/goal/.test(r)) return "Goal";
  if (/saved|on.?target|shoton/.test(r)) return "On target";
  if (/block/.test(r)) return "Blocked";
  if (/miss|off|wood|wide/.test(r)) return "Off target";
  return "Other";
}

const OUTCOME_COLORS: Record<string, string> = {
  Goal: "#22c55e",
  "On target": "#0ea5e9",
  Blocked: "#a855f7",
  "Off target": "#94a3b8",
  Other: "#64748b",
};

export function ShotOutcomeMix({
  shots,
  className,
}: {
  shots: ShotPoint[];
  className?: string;
}) {
  if (!shots.length) return <Soft className={className}>No shot outcomes yet.</Soft>;
  const counts = new Map<string, number>();
  for (const s of shots) {
    const k = outcomeBucket(s.result);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const entries = [...counts.entries()].filter(([, n]) => n > 0);
  if (entries.length < 2) {
    return <Soft className={className}>Need more shot outcomes to chart.</Soft>;
  }
  const total = entries.reduce((a, [, n]) => a + n, 0) || 1;
  // Doughnut
  const cx = 40;
  const cy = 40;
  const r = 28;
  const rInner = 14;
  let angle = -Math.PI / 2;
  const arcs: { d: string; fill: string; key: string }[] = [];
  for (const [key, n] of entries) {
    const sweep = (n / total) * Math.PI * 2;
    const a2 = angle + sweep;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy + r * Math.sin(a2);
    const xi1 = cx + rInner * Math.cos(a2);
    const yi1 = cy + rInner * Math.sin(a2);
    const xi2 = cx + rInner * Math.cos(angle);
    const yi2 = cy + rInner * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${rInner} ${rInner} 0 ${large} 0 ${xi2} ${yi2} Z`;
    arcs.push({ d, fill: OUTCOME_COLORS[key] || "#64748b", key });
    angle = a2;
  }
  return (
    <div className={cn("space-y-1", className)}>
      <Label>Shot outcomes</Label>
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 80 80" className="h-16 w-16 shrink-0">
          {arcs.map((a) => (
            <path key={a.key} d={a.d} fill={a.fill} />
          ))}
          <text
            x="40"
            y="43"
            textAnchor="middle"
            className="fill-slate-300"
            style={{ fontSize: 11, fontWeight: 700 }}
          >
            {total}
          </text>
        </svg>
        <ul className="min-w-0 flex-1 space-y-0.5 text-[10px]">
          {entries.map(([k, n]) => (
            <li key={k} className="flex justify-between gap-2">
              <span className="flex items-center gap-1 truncate">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: OUTCOME_COLORS[k] }}
                />
                {k}
              </span>
              <span className="font-semibold tabular-nums text-slate-200">
                {n}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function XgVsGoals({
  homeXg,
  awayXg,
  homeGoals,
  awayGoals,
  homeName,
  awayName,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  homeXg: number;
  awayXg: number;
  homeGoals: number;
  awayGoals: number;
  homeName: string;
  awayName: string;
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  const max = Math.max(homeXg, awayXg, homeGoals, awayGoals, 0.5);
  const row = (label: string, home: number, away: number, fmt: (n: number) => string) => (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[9px] text-slate-500">
        <span className="tabular-nums font-semibold" style={{ color: homeColor }}>
          {fmt(home)}
        </span>
        <span>{label}</span>
        <span className="tabular-nums font-semibold" style={{ color: awayColor }}>
          {fmt(away)}
        </span>
      </div>
      <div className="flex h-2 gap-0.5">
        <div className="flex flex-1 justify-end overflow-hidden rounded-l bg-white/5">
          <div
            className="h-full rounded-l"
            style={{ width: `${(home / max) * 100}%`, backgroundColor: homeColor }}
          />
        </div>
        <div className="flex flex-1 overflow-hidden rounded-r bg-white/5">
          <div
            className="h-full rounded-r"
            style={{ width: `${(away / max) * 100}%`, backgroundColor: awayColor }}
          />
        </div>
      </div>
    </div>
  );
  return (
    <div className={cn("space-y-2", className)}>
      <Label>xG vs goals</Label>
      <div className="flex justify-between text-[10px] text-slate-500">
        <span className="truncate">{homeName}</span>
        <span className="truncate">{awayName}</span>
      </div>
      {row("xG", homeXg, awayXg, (n) => n.toFixed(2))}
      {row("Goals", homeGoals, awayGoals, (n) => String(n))}
    </div>
  );
}

export function PossessionSparkline({
  samples,
  compare,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  samples: number[];
  compare?: CompareStat[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (samples.length >= 2) {
    const w = 120;
    const h = 36;
    const pts = samples.map((v, i) => {
      const x = (i / (samples.length - 1)) * w;
      const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
      return `${x},${y}`;
    });
    const last = samples[samples.length - 1]!;
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between">
          <Label>Possession trend</Label>
          <div className="text-[11px] font-semibold tabular-nums">
            <span style={{ color: homeColor }}>{Math.round(last)}%</span>
            <span className="text-slate-400"> – </span>
            <span style={{ color: awayColor }}>{Math.round(100 - last)}%</span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-8 w-full rounded-[2px] border border-white/[0.06] bg-black/30"
        >
          <line
            x1="0"
            y1={h / 2}
            x2={w}
            y2={h / 2}
            stroke="rgba(148,163,184,0.4)"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
          <polyline fill="none" stroke={homeColor} strokeWidth="1.8" points={pts.join(" ")} />
        </svg>
      </div>
    );
  }
  const poss = compare?.[0];
  if (poss) {
    return (
      <CompareBars
        title="Possession"
        rows={[poss]}
        homeColor={homeColor}
        awayColor={awayColor}
        className={className}
        suffix="%"
      />
    );
  }
  return <Soft className={className}>Possession trend needs more samples.</Soft>;
}

export function CompareBars({
  title,
  rows,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
  suffix = "",
}: {
  title: string;
  rows: CompareStat[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
  suffix?: string;
}) {
  if (!rows.length) return <Soft className={className}>No team stats yet.</Soft>;
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{title}</Label>
      {rows.map((row) => {
        const max = Math.max(row.home, row.away, 0.001);
        return (
          <div key={row.label} className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-slate-500">
              <span className="tabular-nums font-semibold" style={{ color: homeColor }}>
                {row.home}
                {suffix}
              </span>
              <span className="truncate px-1">{row.label}</span>
              <span className="tabular-nums font-semibold" style={{ color: awayColor }}>
                {row.away}
                {suffix}
              </span>
            </div>
            <div className="flex h-2 gap-0.5">
              <div className="flex flex-1 justify-end overflow-hidden rounded-l bg-white/5">
                <div
                  className="h-full rounded-l"
                  style={{
                    width: `${(row.home / max) * 100}%`,
                    backgroundColor: homeColor,
                  }}
                />
              </div>
              <div className="flex flex-1 overflow-hidden rounded-r bg-white/5">
                <div
                  className="h-full rounded-r"
                  style={{
                    width: `${(row.away / max) * 100}%`,
                    backgroundColor: awayColor,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MatchDnaRadar({
  dna,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  dna: CompareStat[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (dna.length < 3) {
    return <Soft className={className}>Match DNA needs ≥3 team stats.</Soft>;
  }
  const n = dna.length;
  const cx = 50;
  const cy = 50;
  const r = 38;
  const angleAt = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, t: number) => {
    const a = angleAt(i);
    return [cx + r * t * Math.cos(a), cy + r * t * Math.sin(a)] as const;
  };
  const poly = (side: "home" | "away") => {
    const pts = dna.map((d, i) => {
      const max = Math.max(d.home, d.away, 0.001);
      const v = side === "home" ? d.home : d.away;
      return pt(i, Math.max(0.08, v / max));
    });
    return pts.map(([x, y]) => `${x},${y}`).join(" ");
  };
  const ring = (t: number) =>
    dna.map((_, i) => {
      const [x, y] = pt(i, t);
      return `${x},${y}`;
    }).join(" ");
  return (
    <div className={cn("space-y-1", className)}>
      <Label>Match DNA</Label>
      <svg viewBox="0 0 100 100" className="mx-auto h-28 w-28">
        {[0.33, 0.66, 1].map((t) => (
          <polygon
            key={t}
            points={ring(t)}
            fill="none"
            stroke="rgba(148,163,184,0.35)"
            strokeWidth="0.5"
          />
        ))}
        {dna.map((d, i) => {
          const [x, y] = pt(i, 1);
          return (
            <line
              key={d.label}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="0.4"
            />
          );
        })}
        <polygon points={poly("home")} fill={homeColor} fillOpacity={0.25} stroke={homeColor} strokeWidth="1.2" />
        <polygon points={poly("away")} fill={awayColor} fillOpacity={0.25} stroke={awayColor} strokeWidth="1.2" />
        {dna.map((d, i) => {
          const [x, y] = pt(i, 1.18);
          return (
            <text
              key={d.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 5.5, fill: "#94a3b8" }}
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function LeaderboardBars({
  title,
  rows,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  title: string;
  rows: LeaderboardRow[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (!rows.length) return <Soft className={className}>No player leaders yet.</Soft>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{title} leaders</Label>
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={`${r.name}-${i}`} className="space-y-0.5">
            <div className="flex justify-between gap-2 text-[10px]">
              <span className="truncate font-medium text-slate-200">
                {r.name}
              </span>
              <span
                className="tabular-nums font-bold"
                style={{ color: r.side === "home" ? homeColor : awayColor }}
              >
                {r.value}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  backgroundColor: r.side === "home" ? homeColor : awayColor,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GkSaveBar({
  name,
  saves,
  side,
  compare,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  name?: string;
  saves?: number;
  side?: "home" | "away";
  compare?: CompareStat[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (compare?.length) {
    return (
      <CompareBars
        title="Goalkeeper saves"
        rows={compare}
        homeColor={homeColor}
        awayColor={awayColor}
        className={className}
      />
    );
  }
  if (name == null || saves == null || side == null) {
    return <Soft className={className}>Save tally not available.</Soft>;
  }
  const color = side === "home" ? homeColor : awayColor;
  const w = Math.min(100, 20 + saves * 12);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>Goalkeeper saves</Label>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-slate-200">
            {name}
          </div>
          <div className="text-2xl font-black tabular-nums" style={{ color }}>
            {saves}
          </div>
        </div>
        <div className="mb-1 h-7 w-24 overflow-hidden rounded-[2px] bg-white/5">
          <div className="h-full rounded" style={{ width: `${w}%`, backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

export function EventTimelineMini({
  title,
  events,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  title: string;
  events: TimelineEvent[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (!events.length) return <Soft className={className}>No events to plot.</Soft>;
  const maxMin = Math.max(90, ...events.map((e) => e.minute));
  return (
    <div className={cn("space-y-1", className)}>
      <Label>{title}</Label>
      <div className="relative h-9 rounded-[2px] border border-white/[0.06] bg-black/30 px-1">
        <div className="absolute left-1 right-1 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        {events.map((e, i) => {
          const left = `${(e.minute / maxMin) * 100}%`;
          const isRed = /red/i.test(e.type);
          const isGoal = /goal/i.test(e.type);
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left }}
              title={`${e.minute}' ${e.label || e.type}`}
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white shadow",
                  isGoal && "ring-1 ring-white"
                )}
                style={{
                  backgroundColor: isRed
                    ? "#dc2626"
                    : e.side === "home"
                      ? homeColor
                      : awayColor,
                }}
              >
                {e.minute}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>0′</span>
        <span>{maxMin}′</span>
      </div>
    </div>
  );
}

export function MomentumProxyChart({
  samples,
  compare,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  samples: MomentumSample[];
  compare?: CompareStat[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (samples.length >= 2) {
    const w = 160;
    const h = 40;
    const shotDiffs = samples.map((s) => {
      if (s.homeShots == null || s.awayShots == null) return null;
      return s.homeShots - s.awayShots;
    });
    const usable = shotDiffs.map((d, i) => ({ d, i })).filter((x) => x.d != null) as {
      d: number;
      i: number;
    }[];
    if (usable.length >= 2) {
      const maxAbs = Math.max(1, ...usable.map((x) => Math.abs(x.d)));
      const pts = usable.map(({ d, i }) => {
        const x = (i / (samples.length - 1)) * w;
        const y = h / 2 - (d / maxAbs) * (h / 2 - 2);
        return `${x},${y}`;
      });
      return (
        <div className={cn("space-y-1", className)}>
          <Label>Momentum proxy · shot differential</Label>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="h-9 w-full rounded-[2px] border border-white/[0.06] bg-black/30"
          >
            <line
              x1="0"
              y1={h / 2}
              x2={w}
              y2={h / 2}
              stroke="rgba(148,163,184,0.4)"
              strokeWidth="0.5"
              strokeDasharray="2 2"
            />
            <polyline fill="none" stroke={homeColor} strokeWidth="1.6" points={pts.join(" ")} />
          </svg>
          <div className="text-[9px] text-slate-500">
            Home−away shots over polls · not an AF momentum field
          </div>
        </div>
      );
    }
  }
  if (compare?.length) {
    return (
      <CompareBars
        title="Momentum proxy"
        rows={compare}
        homeColor={homeColor}
        awayColor={awayColor}
        className={className}
      />
    );
  }
  return <Soft className={className}>Momentum proxy needs more samples.</Soft>;
}

export function DataVizFlashCard({
  kind,
  shots,
  homeXg,
  awayXg,
  homeGoals,
  awayGoals,
  homeName,
  awayName,
  homeColor,
  awayColor,
  possessionSamples,
  compare,
  compareTitle,
  dna,
  leaderboard,
  leaderboardTitle,
  gkName,
  gkSaves,
  gkSide,
  timelineEvents,
  timelineTitle,
  momentumSamples,
}: {
  kind: VizFlashKind;
  shots?: ShotPoint[];
  homeXg?: number | null;
  awayXg?: number | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homeName?: string;
  awayName?: string;
  homeColor?: string;
  awayColor?: string;
  possessionSamples?: number[];
  compare?: CompareStat[];
  compareTitle?: string;
  dna?: CompareStat[];
  leaderboard?: LeaderboardRow[];
  leaderboardTitle?: string;
  gkName?: string;
  gkSaves?: number;
  gkSide?: "home" | "away";
  timelineEvents?: TimelineEvent[];
  timelineTitle?: string;
  momentumSamples?: MomentumSample[];
}) {
  const hn = homeName || "Home";
  const an = awayName || "Away";
  return (
    <div className="min-w-0">
      {kind === "shot_map" && shots ? (
        <ShotMapMini shots={shots} homeColor={homeColor} awayColor={awayColor} />
      ) : null}
      {kind === "xg_race" && homeXg != null && awayXg != null ? (
        <XgRaceBar
          homeXg={homeXg}
          awayXg={awayXg}
          homeName={hn}
          awayName={an}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "xg_timeline" && shots ? (
        <XgTimeline
          shots={shots}
          homeName={hn}
          awayName={an}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "shot_outcome" && shots ? <ShotOutcomeMix shots={shots} /> : null}
      {kind === "xg_vs_goals" &&
      homeXg != null &&
      awayXg != null &&
      homeGoals != null &&
      awayGoals != null ? (
        <XgVsGoals
          homeXg={homeXg}
          awayXg={awayXg}
          homeGoals={homeGoals}
          awayGoals={awayGoals}
          homeName={hn}
          awayName={an}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "possession" ? (
        <PossessionSparkline
          samples={possessionSamples || []}
          compare={compare}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "shots_compare" && compare ? (
        <CompareBars
          title={compareTitle || "Shots"}
          rows={compare}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "corners_fouls" && compare ? (
        <CompareBars
          title={compareTitle || "Corners & fouls"}
          rows={compare}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "pass_pct" && compare ? (
        <CompareBars
          title={compareTitle || "Pass accuracy"}
          rows={compare}
          homeColor={homeColor}
          awayColor={awayColor}
          suffix="%"
        />
      ) : null}
      {kind === "match_dna" && dna ? (
        <MatchDnaRadar dna={dna} homeColor={homeColor} awayColor={awayColor} />
      ) : null}
      {kind === "leaderboard" && leaderboard ? (
        <LeaderboardBars
          title={leaderboardTitle || "Leaders"}
          rows={leaderboard}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "gk_saves" ? (
        <GkSaveBar
          name={gkName}
          saves={gkSaves}
          side={gkSide}
          compare={compare}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "goal_timeline" && timelineEvents ? (
        <EventTimelineMini
          title={timelineTitle || "Goals"}
          events={timelineEvents}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "card_timeline" && timelineEvents ? (
        <EventTimelineMini
          title={timelineTitle || "Cards"}
          events={timelineEvents}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "momentum_proxy" ? (
        <MomentumProxyChart
          samples={momentumSamples || []}
          compare={compare}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
    </div>
  );
}
