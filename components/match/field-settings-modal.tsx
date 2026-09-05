"use client";

import { useMemo, useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type FieldSettings,
  type FieldSettingsTab,
  DEFAULT_FIELD_SETTINGS,
  formatPctLabel,
  scaleFactor,
} from "@/lib/field-settings";

const TABS: { key: FieldSettingsTab; label: string; enabled: boolean }[] = [
  { key: "player", label: "Player", enabled: true },
  { key: "keeper", label: "Keeper", enabled: false },
  { key: "coach", label: "Coach", enabled: false },
  { key: "referee", label: "Referee", enabled: false },
];

function PreviewCard({
  settings,
  markerPct,
}: {
  settings: FieldSettings;
  markerPct: number;
}) {
  const scale = scaleFactor(markerPct);
  const nameScale = scaleFactor(settings.nameSizePct);
  const cols = settings.fieldsPerRow;
  const baseW = 76;
  const cells =
    cols === 3
      ? [
          ["APP", "12"],
          ["GOL", "3"],
          ["AST", "1"],
        ]
      : cols === 5
        ? [
            ["APP", "12"],
            ["GOL", "3"],
            ["AST", "1"],
            ["RTG", "7.2"],
            ["AGE", "27"],
          ]
        : [
            ["APP", "12"],
            ["GOL", "3"],
            ["AST", "1"],
            ["RTG", "7.2"],
          ];
  const row2 =
    settings.dataRows === 2
      ? cols === 3
        ? [
            ["AGE", "27"],
            ["GOL", "0"],
            ["SUB", "-"],
          ]
        : cols === 5
          ? [
              ["AGE", "27"],
              ["HGT", "182"],
              ["WGT", "74"],
              ["FOT", "R"],
              ["SUB", "-"],
            ]
          : [
              ["AGE", "27"],
              ["GOL", "0"],
              ["AST", "0"],
              ["SUB", "-"],
            ]
      : null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-900/90 p-4 min-h-[160px] justify-center">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/80">
        Live preview
      </span>
      <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
        <div
          className="flex flex-col overflow-hidden rounded-md border-[1.5px] border-slate-800 bg-white shadow-md text-slate-900"
          style={{ width: baseW }}
        >
          <div className="flex items-start justify-between px-1 pt-0.5">
            <span className="text-[15px] font-black leading-none tabular-nums">9</span>
            <span className="text-[7px] font-bold uppercase">ST</span>
          </div>
          <div className="flex flex-col items-center px-1 pb-1">
            <span className="h-9 w-9 rounded-sm bg-slate-200" />
            <span
              className="mt-0.5 w-full truncate text-center font-extrabold uppercase leading-tight tracking-wide"
              style={{ fontSize: `${9 * nameScale}px` }}
            >
              SAMPLE
            </span>
          </div>
          <div className="bg-[#FFF8E7] px-0.5 py-0.5 border-t border-black/10">
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {cells.map(([l, v]) => (
                <div key={l} className="min-w-0 text-center leading-none">
                  <div className="text-[6px] font-semibold uppercase text-slate-500 truncate">
                    {l}
                  </div>
                  <div className="text-[9px] font-bold tabular-nums truncate">{v}</div>
                </div>
              ))}
            </div>
            {row2 && (
              <div
                className="mt-0.5 grid gap-px border-t border-black/5 pt-0.5"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {row2.map(([l, v]) => (
                  <div key={l} className="min-w-0 text-center leading-none">
                    <div className="text-[6px] font-semibold uppercase text-slate-500 truncate">
                      {l}
                    </div>
                    <div className="text-[9px] font-bold tabular-nums truncate">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <span className="text-[10px] text-emerald-100/70">
        Marker {formatPctLabel(markerPct)} · Name {formatPctLabel(settings.nameSizePct)}
      </span>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
        <span className="tabular-nums text-slate-500">{formatPctLabel(value)}</span>
      </div>
      <input
        type="range"
        min={-40}
        max={40}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-600"
      />
      <div className="flex justify-between text-[9px] text-slate-400">
        <span>-40%</span>
        <span>Default</span>
        <span>+40%</span>
      </div>
    </label>
  );
}

export function FieldSettingsModal({
  open,
  onClose,
  settings,
  markerPct,
  onChange,
  isFullscreen,
}: {
  open: boolean;
  onClose: () => void;
  settings: FieldSettings;
  /** Effective marker % shown in preview (may include fullscreen bump). */
  markerPct: number;
  onChange: (next: FieldSettings) => void;
  isFullscreen?: boolean;
}) {
  const [tab, setTab] = useState<FieldSettingsTab>("player");

  const patch = useMemo(
    () => (partial: Partial<FieldSettings>) => {
      onChange({ ...settings, ...partial, userAdjusted: true });
    },
    [onChange, settings]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Close field settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-settings-title"
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <SlidersHorizontal className="h-4 w-4 text-teal-600" />
          <div className="min-w-0 flex-1">
            <h2 id="field-settings-title" className="text-sm font-bold">
              Field Settings · Pitch Card
            </h2>
            <p className="text-[10px] text-slate-500">
              SportsCom-style marker controls · saved in this browser
              {isFullscreen ? " · fullscreen active" : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 dark:border-slate-800 px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={!t.enabled}
              onClick={() => t.enabled && setTab(t.key)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-[11px] font-semibold border-b-2 -mb-px",
                tab === t.key && t.enabled
                  ? "border-teal-600 text-teal-700 dark:text-teal-300"
                  : "border-transparent text-slate-400",
                !t.enabled && "opacity-40 cursor-not-allowed"
              )}
              title={t.enabled ? t.label : "Coming soon"}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_140px]">
          <div className="space-y-4">
            <SliderRow
              label="Marker size"
              value={settings.markerSizePct}
              onChange={(markerSizePct) => patch({ markerSizePct })}
            />
            <SliderRow
              label="Name text size"
              value={settings.nameSizePct}
              onChange={(nameSizePct) => patch({ nameSizePct })}
            />
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Data rows
              </div>
              <div className="flex gap-2">
                {([1, 2] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ dataRows: n })}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[11px] font-semibold",
                      settings.dataRows === n
                        ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                        : "border-slate-200 dark:border-slate-700 text-slate-600"
                    )}
                  >
                    {n} row{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Fields per row
              </div>
              <div className="flex gap-2">
                {([3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => patch({ fieldsPerRow: n })}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-[11px] font-semibold",
                      settings.fieldsPerRow === n
                        ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                        : "border-slate-200 dark:border-slate-700 text-slate-600"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {!settings.userAdjusted && isFullscreen && (
              <p className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 rounded-md px-2 py-1.5">
                Fullscreen uses the same size as windowed (no auto-inflate). Pitch still shrinks cards if needed so they never overlap.
              </p>
            )}
            <button
              type="button"
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              onClick={() =>
                onChange({ ...DEFAULT_FIELD_SETTINGS, userAdjusted: false })
              }
            >
              Reset to defaults
            </button>
          </div>
          <PreviewCard settings={settings} markerPct={markerPct} />
        </div>
      </div>
    </div>
  );
}
