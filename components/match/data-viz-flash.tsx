"use client";

import { cn } from "@/lib/utils";

export type ShotPoint = {
  x: number;
  y: number;
  xg: number;
  result: string;
  side: "home" | "away";
  player?: string;
  minute?: number;
};

export type VizFlashKind = "shot_map" | "xg_race" | "possession";

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
    return (
      <p className={cn("text-[11px] text-slate-500", className)}>
        Shot map not available yet.
      </p>
    );
  }
  return (
    <div className={cn("relative w-full", className)}>
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 mb-1">
        Shot map · Advanced stats
      </div>
      <svg viewBox="0 0 100 68" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-950/90">
        <rect x="0" y="0" width="100" height="68" fill="#064e3b" />
        <rect x="0.5" y="0.5" width="99" height="67" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
        <line x1="50" y1="0" x2="50" y2="68" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
        <circle cx="50" cy="34" r="9" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        <rect x="0" y="20" width="12" height="28" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
        <rect x="88" y="20" width="12" height="28" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
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
      <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
        xG race · Advanced stats
      </div>
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
      <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div className="h-full" style={{ width: `${(homeXg / t) * 100}%`, backgroundColor: homeColor }} />
        <div className="h-full" style={{ width: `${(awayXg / t) * 100}%`, backgroundColor: awayColor }} />
      </div>
    </div>
  );
}

export function PossessionSparkline({
  samples,
  homeColor = "#0ea5e9",
  awayColor = "#f43f5e",
  className,
}: {
  samples: number[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}) {
  if (samples.length < 2) {
    return (
      <p className={cn("text-[11px] text-slate-500", className)}>
        Possession trend needs more samples.
      </p>
    );
  }
  const w = 120;
  const h = 36;
  const pts = samples.map((v, i) => {
    const x = (i / (samples.length - 1)) * w;
    const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
    return `${x},${y}`;
  });
  const last = samples[samples.length - 1];
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
          Possession trend
        </div>
        <div className="text-[11px] font-semibold tabular-nums">
          <span style={{ color: homeColor }}>{Math.round(last)}%</span>
          <span className="text-slate-400"> – </span>
          <span style={{ color: awayColor }}>{Math.round(100 - last)}%</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9 rounded bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
        <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(148,163,184,0.4)" strokeWidth="0.5" strokeDasharray="2 2" />
        <polyline fill="none" stroke={homeColor} strokeWidth="1.8" points={pts.join(" ")} />
      </svg>
    </div>
  );
}

export function DataVizFlashCard({
  kind,
  shots,
  homeXg,
  awayXg,
  homeName,
  awayName,
  homeColor,
  awayColor,
  possessionSamples,
}: {
  kind: VizFlashKind;
  shots?: ShotPoint[];
  homeXg?: number | null;
  awayXg?: number | null;
  homeName?: string;
  awayName?: string;
  homeColor?: string;
  awayColor?: string;
  possessionSamples?: number[];
}) {
  return (
    <div className="mt-2 rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/90 dark:bg-slate-950/80 p-2.5">
      {kind === "shot_map" && shots ? (
        <ShotMapMini shots={shots} homeColor={homeColor} awayColor={awayColor} />
      ) : null}
      {kind === "xg_race" && homeXg != null && awayXg != null ? (
        <XgRaceBar
          homeXg={homeXg}
          awayXg={awayXg}
          homeName={homeName || "Home"}
          awayName={awayName || "Away"}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
      {kind === "possession" && possessionSamples ? (
        <PossessionSparkline
          samples={possessionSamples}
          homeColor={homeColor}
          awayColor={awayColor}
        />
      ) : null}
    </div>
  );
}
