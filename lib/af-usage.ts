/**
 * API-Football daily usage alert helpers.
 * Prefers live `/status` metering (requests.current / limit_day).
 * Optional env AF_DAILY_REQUEST_BUDGET when upstream omits limit_day.
 */

import { getApiStatus, type AfStatus } from "./api-football";

/** Warn when usage reaches this fraction of the daily limit (peak-window headroom). */
export const AF_USAGE_WARN_RATIO = 0.6;
/** Stronger alert — approaching hard cap. */
export const AF_USAGE_HIGH_RATIO = 0.7;

export type AfUsageLevel = "ok" | "warn" | "high" | "unknown";

export type AfUsageSnapshot = {
  level: AfUsageLevel;
  current: number | null;
  limit: number | null;
  ratio: number | null;
  source: "status" | "env_budget" | "none";
  /** True when limit came from AF_DAILY_REQUEST_BUDGET, not /status. */
  usedEnvBudget: boolean;
  message: string | null;
  todo: string | null;
};

function envDailyBudget(): number | null {
  const raw = process.env.AF_DAILY_REQUEST_BUDGET?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function evaluateAfUsage(status: AfStatus | null | undefined): AfUsageSnapshot {
  const current =
    status?.requests?.current != null && Number.isFinite(status.requests.current)
      ? Number(status.requests.current)
      : null;
  let limit =
    status?.requests?.limit_day != null && Number.isFinite(status.requests.limit_day)
      ? Number(status.requests.limit_day)
      : null;
  let source: AfUsageSnapshot["source"] = "none";
  let usedEnvBudget = false;
  let todo: string | null = null;

  if (current != null && limit != null && limit > 0) {
    source = "status";
  } else if (current != null) {
    const budget = envDailyBudget();
    if (budget != null) {
      limit = budget;
      source = "env_budget";
      usedEnvBudget = true;
      todo =
        "AF /status did not expose limit_day — using AF_DAILY_REQUEST_BUDGET. " +
        "Confirm the figure matches your API-Football plan dashboard.";
    } else {
      todo =
        "TODO: AF /status did not expose requests.limit_day and AF_DAILY_REQUEST_BUDGET is unset. " +
        "Set AF_DAILY_REQUEST_BUDGET to your plan’s daily request cap for usage alerts.";
    }
  } else if (!status?.requests) {
    todo =
      "TODO: Live-feed /status returned no requests metering. " +
      "Usage alert stays idle until the feed exposes current/limit or AF_DAILY_REQUEST_BUDGET is set.";
  }

  if (current == null || limit == null || limit <= 0) {
    return {
      level: "unknown",
      current,
      limit,
      ratio: null,
      source,
      usedEnvBudget,
      message: null,
      todo,
    };
  }

  const ratio = current / limit;
  let level: AfUsageLevel = "ok";
  if (ratio >= AF_USAGE_HIGH_RATIO) level = "high";
  else if (ratio >= AF_USAGE_WARN_RATIO) level = "warn";

  const pct = Math.round(ratio * 100);
  let message: string | null = null;
  if (level === "warn") {
    message =
      `Live-feed usage is at ${current}/${limit} requests today (${pct}%). ` +
      `Approaching the daily cap — reduce extra Full Syncs before peak windows.`;
  } else if (level === "high") {
    message =
      `Live-feed usage is high: ${current}/${limit} (${pct}%). ` +
      `Pause non-essential syncs; fixture fan-in is active for shared live desks.`;
  }

  return {
    level,
    current,
    limit,
    ratio,
    source,
    usedEnvBudget,
    message,
    todo,
  };
}

/** Fetch /status and evaluate. Logs when warn/high. Safe no-op without a key. */
export async function checkAfUsageAlert(opts?: {
  log?: boolean;
}): Promise<AfUsageSnapshot> {
  try {
    const status = await getApiStatus();
    const snap = evaluateAfUsage(status);
    if (opts?.log !== false && (snap.level === "warn" || snap.level === "high")) {
      console.warn("[af-usage]", snap.level, snap.message || snap.todo);
    }
    return snap;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      level: "unknown",
      current: null,
      limit: null,
      ratio: null,
      source: "none",
      usedEnvBudget: false,
      message: null,
      todo: `Could not read live-feed usage: ${msg}`,
    };
  }
}
