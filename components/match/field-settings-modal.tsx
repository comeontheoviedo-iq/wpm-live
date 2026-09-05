"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { ModalHeader } from "@/components/ui/modal-header";
import { TabStrip } from "@/components/ui/tabs";
import {
  type FieldSettings,
  type FieldSettingsTab,
  type CardStatField,
  type CurrencyCode,
  type HeightUnit,
  ALL_CARD_FIELDS,
  DEFAULT_FIELD_SETTINGS,
  formatPctLabel,
  scaleFactor,
  pickVisibleFields,
  currencySymbol,
  formatHeightValue,
  formatMarketValue,
} from "@/lib/field-settings";

const TABS: { key: FieldSettingsTab; label: string; enabled: boolean }[] = [
  { key: "player", label: "Player", enabled: true },
  { key: "keeper", label: "Keeper", enabled: false },
  { key: "coach", label: "Coach", enabled: false },
  { key: "referee", label: "Referee", enabled: false },
];

const SAMPLE: Record<CardStatField, string> = {
  APP: "12",
  S_GOL: "3",
  S_AST: "1",
  M_APP: "1",
  M_MIN: "27",
  M_GOL: "1",
  M_AST: "0",
  RTG: "7.2",
  AGE: "27",
  SUB: "-",
  HGT: "182",
  WGT: "74",
  FOT: "R",
  SV: "3",
  CS: "2",
  VAL: "€12m",
};

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
  const picked = pickVisibleFields(settings, "outfield");
  const labelOf = (id: CardStatField) =>
    ALL_CARD_FIELDS.find((f) => f.id === id)?.label || id;
  const valueOf = (id: CardStatField) => {
    if (id === "HGT") return formatHeightValue(182, settings.heightUnit);
    if (id === "VAL") return formatMarketValue(12_000_000, settings.currency);
    return SAMPLE[id];
  };
  const cells = picked.map((id) => [labelOf(id), valueOf(id)] as const);
  const row1 = cells.slice(0, cols);
  const row2 =
    settings.dataRows === 2 ? cells.slice(cols, cols * 2) : [];

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-emerald-900/90 p-4 min-h-[160px] justify-center">
      <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/80">
        Live preview · S = season · M = match
      </span>
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
      >
        <div
          className="flex flex-col overflow-hidden rounded-md border-[1.5px] border-slate-800 bg-white shadow-md text-slate-900"
          style={{ width: baseW }}
        >
          <div className="flex items-start justify-between px-1 pt-0.5">
            <span className="text-[15px] font-black leading-none tabular-nums">
              9
            </span>
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
          <div className="bg-[#F4EFE3] px-0.5 py-0.5 border-t border-black/10">
            <div
              className="grid gap-px"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              }}
            >
              {row1.map(([l, v]) => (
                <div key={l} className="min-w-0 text-center leading-none">
                  <div className="text-[6px] font-semibold uppercase text-slate-500 truncate">
                    {l}
                  </div>
                  <div className="text-[9px] font-bold tabular-nums truncate">
                    {v}
                  </div>
                </div>
              ))}
            </div>
            {row2.length > 0 && (
              <div
                className="mt-0.5 grid gap-px border-t border-black/5 pt-0.5"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {row2.map(([l, v]) => (
                  <div key={l} className="min-w-0 text-center leading-none">
                    <div className="text-[6px] font-semibold uppercase text-slate-500 truncate">
                      {l}
                    </div>
                    <div className="text-[9px] font-bold tabular-nums truncate">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <span className="text-[10px] text-emerald-100/70">
        Marker {formatPctLabel(markerPct)} · Name{" "}
        {formatPctLabel(settings.nameSizePct)} · {currencySymbol(settings.currency)}{" "}
        · {settings.heightUnit === "ftin" ? "ft/in" : "cm"}
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
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="tabular-nums text-slate-500">
          {formatPctLabel(value)}
        </span>
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

  function toggleField(id: CardStatField) {
    const has = settings.visibleFields.includes(id);
    const next = has
      ? settings.visibleFields.filter((x) => x !== id)
      : [...settings.visibleFields, id];
    // Keep at least one field
    if (!next.length) return;
    patch({ visibleFields: next });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in"
        aria-label="Close field settings"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-settings-title"
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-lg animate-slide-up dark:border-slate-700 dark:bg-slate-950"
      >
        <ModalHeader
          title={
            <span id="field-settings-title" className="text-sm font-bold sm:text-sm">
              Field Settings · Pitch Card
            </span>
          }
          subtitle={
            <>
              Customise card data · saved in this browser
              {isFullscreen ? " · fullscreen active" : ""}
            </>
          }
          leading={<SlidersHorizontal className="h-4 w-4 text-teal-600" />}
          onClose={onClose}
        />

        <TabStrip
          className="shrink-0"
          variant="underline"
          value={tab}
          onChange={(key) => setTab(key)}
          items={TABS.map((t) => ({
            key: t.key,
            label: t.label,
            disabled: !t.enabled,
            title: t.enabled ? t.label : "Coming soon",
          }))}
        />

        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_150px] overflow-y-auto min-h-0">
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

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Card data fields
              </div>
              <p className="text-[10px] text-slate-500">
                Toggle what appears on pitch cards. Order follows the list;
                row × columns sets how many show.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CARD_FIELDS.filter((f) => f.outfield).map((f) => {
                  const on = settings.visibleFields.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      title={f.hint}
                      onClick={() => toggleField(f.id)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        on
                          ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                          : "border-slate-200 dark:border-slate-700 text-slate-400 line-through"
                      )}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Height units
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      ["cm", "cm"],
                      ["ftin", "ft/in"],
                    ] as [HeightUnit, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch({ heightUnit: id })}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                        settings.heightUnit === id
                          ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                          : "border-slate-200 dark:border-slate-700 text-slate-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Market value currency
                </div>
                <div className="flex gap-1.5">
                  {(
                    [
                      ["EUR", "€"],
                      ["GBP", "£"],
                      ["USD", "$"],
                    ] as [CurrencyCode, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => patch({ currency: id })}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                        settings.currency === id
                          ? "border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
                          : "border-slate-200 dark:border-slate-700 text-slate-600"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-slate-400">
                  Used when VAL is enabled (shows — if value unknown).
                </p>
              </div>
            </div>

            {!settings.userAdjusted && isFullscreen && (
              <p className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/40 rounded-md px-2 py-1.5">
                Fullscreen uses the same size as windowed (no auto-inflate).
                Pitch still shrinks cards if needed so they never overlap.
              </p>
            )}
            <button
              type="button"
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
              onClick={() =>
                onChange({
                  ...DEFAULT_FIELD_SETTINGS,
                  visibleFields: [...DEFAULT_FIELD_SETTINGS.visibleFields],
                  userAdjusted: false,
                })
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
