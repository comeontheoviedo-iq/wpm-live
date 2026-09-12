"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import Link from "next/link";
import {
  User,
  Palette,
  CreditCard,
  ClipboardList,
  Mic2,
  Plug,
  MessageSquarePlus,
  Sparkles,
  HelpCircle,
  GraduationCap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/i18n/locale-provider";
import { SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import type { AfUsageSnapshot } from "@/lib/af-usage";

type Tab =
  | "profile"
  | "appearance"
  | "templates"
  | "integrations"
  | "subscription"
  | "feedback";

type PlanStatus = {
  plan: "base" | "intel";
  commercialPlan?: "unlimited";
  commercialName?: string;
  commercialPrice?: string;
  envPlan: "base" | "intel";
  override: "base" | "intel" | null;
  hasIntel: boolean;
  geminiKeyConfigured: boolean;
  canUseGeminiBrief: boolean;
  canAutoGenPack: boolean;
  stripe?: string;
  stripeConfigured?: boolean;
  copy?: {
    unlimited?: { name: string; price: string; includes: string[]; aka?: string };
    base: { name: string; price: string; includes: string[] };
    intel: { name: string; price: string; includes: string[]; softCaps?: string };
    rivalCompare?: string;
  };
};

type TrialSnapshot = {
  billingStatus: string;
  trialActive: boolean;
  trialDays: number;
  trialDeskLimit: number;
  desksUsed: number;
  desksRemaining: number | null;
  canCreateDesk: boolean;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  daysRemaining: number | null;
  convertPrice: string;
  matchPassCredits?: number;
  stripeConfigured: boolean;
  message: string;
  cancelPath: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("subscription");
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatarInitials: string;
    sharedIntelOptIn?: boolean;
  } | null>(null);
  const [apiFootball, setApiFootball] = useState(false);
  const [gemini, setGemini] = useState(false);
  const [integrationsHint, setIntegrationsHint] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [afUsage, setAfUsage] = useState<AfUsageSnapshot | null>(null);
  const { locale, setLocale, t } = useLocale();
  const [localeBusy, setLocaleBusy] = useState(false);
  const [localeMsg, setLocaleMsg] = useState<string | null>(null);
  const [sharedIntelBusy, setSharedIntelBusy] = useState(false);
  const [sharedIntelMsg, setSharedIntelMsg] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);
  const [trial, setTrial] = useState<TrialSnapshot | null>(null);


  async function setSharedIntelOptIn(enabled: boolean) {
    setSharedIntelBusy(true);
    setSharedIntelMsg(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sharedIntelOptIn: enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json.error || "Could not save preference"));
      setUser((prev) =>
        prev
          ? { ...prev, sharedIntelOptIn: Boolean(json.user?.sharedIntelOptIn) }
          : prev
      );
      setSharedIntelMsg(
        enabled
          ? "Opted in — anonymised signals only when the shared pool ships. Raw notes stay on your desk."
          : "Opt-in off. Your notes stay personal to your account."
      );
    } catch (e) {
      setSharedIntelMsg(e instanceof Error ? e.message : "Could not save preference");
    } finally {
      setSharedIntelBusy(false);
    }
  }

  function loadPlan() {
    return fetch("/api/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setPlan(j as PlanStatus);
      })
      .catch(() => undefined);
  }

  function loadTrial() {
    return fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.trial) setTrial(j.trial as TrialSnapshot);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setUser(d.user))
      .catch(() => router.push("/login"));
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((j) => {
        setApiFootball(Boolean(j.apiFootball));
        setGemini(Boolean(j.gemini));
        if (j.hint) setIntegrationsHint(String(j.hint));
        if (j.apiFootball) {
          fetch("/api/football/status")
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => {
              if (s?.usage) setAfUsage(s.usage as AfUsageSnapshot);
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    loadPlan();
    loadTrial();
  }, [router]);

  async function testApiFootball() {
    setStatusPending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/football/status");
      const json = await res.json();
      setApiFootball(Boolean(json.configured));
      setStatusMsg(json.message || (json.ok ? "Connection OK" : "Connection failed"));
      if (json.usage) setAfUsage(json.usage as AfUsageSnapshot);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Connection test failed");
    } finally {
      setStatusPending(false);
    }
  }

  async function setIntelEnabled(enable: boolean) {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableIntel: enable }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json.error || "Plan update failed"));
      setPlan(json as PlanStatus);
      setPlanMsg(String(json.message || (enable ? "Intel enabled" : "Base plan")));
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Plan update failed");
    } finally {
      setPlanBusy(false);
    }
  }

  async function startUnlimitedCheckout() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "unlimited" }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setPlanMsg(String(json.todo || "Stripe keys not configured yet."));
        return;
      }
      if (!res.ok || !json.url) throw new Error(String(json.error || "Checkout failed"));
      window.location.href = String(json.url);
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setPlanBusy(false);
    }
  }

  async function openBillingPortal() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = await res.json();
      if (res.status === 503) {
        setPlanMsg(
          String(
            json.todo ||
              "Billing keys not configured yet — use Cancel trial below for app-side cancel."
          )
        );
        return;
      }
      if (!res.ok || !json.url) throw new Error(String(json.error || json.hint || "Portal failed"));
      window.location.href = String(json.url);
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setPlanBusy(false);
    }
  }

  async function startAppTrial() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "start" }) });
      const json = await res.json();
      if (res.status === 409) {
        // Prefer Checkout when billing configured
        await startUnlimitedCheckout();
        return;
      }
      if (!res.ok) throw new Error(String(json.error || "Could not start trial"));
      if (json.trial) setTrial(json.trial as TrialSnapshot);
      setPlanMsg(String(json.message || "Trial started"));
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Could not start trial");
    } finally {
      setPlanBusy(false);
    }
  }

  async function cancelTrial() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      if (trial?.stripeConfigured) {
        await openBillingPortal();
        return;
      }
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const json = await res.json();
      if (res.status === 409 && json.usePortal) {
        await openBillingPortal();
        return;
      }
      if (!res.ok) throw new Error(String(json.error || "Cancel failed"));
      if (json.trial) setTrial(json.trial as TrialSnapshot);
      setPlanMsg(String(json.message || "Trial cancelled"));
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setPlanBusy(false);
    }
  }

  async function resumeTrial() {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(String(json.error || "Resume failed"));
      if (json.trial) setTrial(json.trial as TrialSnapshot);
      setPlanMsg(String(json.message || "Trial resumed"));
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Resume failed");
    } finally {
      setPlanBusy(false);
    }
  }

  async function buyMatchPass(credits: 1 | 5 | 10) {
    setPlanBusy(true);
    setPlanMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "match_pass",
          credits,
        }),
      });
      const json = await res.json();
      if (res.status === 503) {
        setPlanMsg(String(json.todo || "Match Desk Pass prices not configured yet."));
        return;
      }
      if (!res.ok || !json.url) throw new Error(String(json.error || "Checkout failed"));
      window.location.href = String(json.url);
    } catch (e) {
      setPlanMsg(e instanceof Error ? e.message : "Match Desk Pass checkout failed");
    } finally {
      setPlanBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading settings…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "templates", label: "Templates", icon: <Mic2 className="h-4 w-4" /> },
    { id: "integrations", label: "Integrations", icon: <Plug className="h-4 w-4" /> },
    { id: "subscription", label: "Plan", icon: <CreditCard className="h-4 w-4" /> },
    { id: "feedback", label: "Feedback", icon: <MessageSquarePlus className="h-4 w-4" /> },
  ];
  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
      <AppHeader user={user} />
      <div className="flex min-h-0 w-full items-stretch">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-2 py-2 sm:px-3 sm:py-3">
        <div className="mx-auto max-w-5xl">
        <div className="mb-4 desk-header p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Hub · Settings</p>
          <h1 className="mt-1 text-base font-bold tracking-tight sm:text-lg">Settings</h1>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            Unlimited (Basic) £22/mo — bring your notes; we file them where you need them. AI lab features are testing-only, not a separate paid tier.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
            <Link href="/faq" className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
              <HelpCircle className="h-3.5 w-3.5" /> FAQ
            </Link>
            <Link href="/training" className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline">
              <GraduationCap className="h-3.5 w-3.5" /> Training
            </Link>
            <button
              type="button"
              onClick={() => { setTab("subscription"); }}
              className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline"
            >
              <CreditCard className="h-3.5 w-3.5" /> Plan & billing
            </button>
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <aside className="space-y-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left",
                  tab === t.id
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border-l-2 border-teal-500"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </aside>
          <div className="md:col-span-3 space-y-4">
            {tab === "profile" && (
              <Card>
                <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <div><div className="text-xs text-slate-500">Name</div><div className="font-medium">{user.name}</div></div>
                  <div><div className="text-xs text-slate-500">Email</div><div className="font-medium">{user.email}</div></div>
                  <div><div className="text-xs text-slate-500">Role</div><div className="font-medium">Commentator</div></div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 mt-2">
                    <div className="flex items-center gap-2 font-medium">
                      <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      Shared CoComms intel
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Match desks and notes stay personal to your account. Opt in so anonymised note
                      signals can help grow a shared CoComms intel pool — optional, never forced.
                      Off by default. Raw notes never leave your desk unless you opt in, and even
                      then only anonymised aggregates are planned (pipeline not live yet).
                    </p>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        checked={Boolean(user.sharedIntelOptIn)}
                        disabled={sharedIntelBusy}
                        onChange={(e) => setSharedIntelOptIn(e.target.checked)}
                      />
                      <span className="text-sm">
                        Share anonymised note signals with the CoComms intel pool
                        <span className="block text-[11px] text-slate-400 mt-0.5">
                          {user.sharedIntelOptIn ? "On — you can turn this off anytime" : "Off — your prep stays on your desk"}
                        </span>
                      </span>
                    </label>
                    {sharedIntelMsg && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{sharedIntelMsg}</p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Details: Settings mirrors the Privacy FAQ. See also the FAQ page.
                    </p>
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-slate-500 mb-4">Customize how CoComms looks on your device.</p>
                  <div className="text-sm font-medium mb-2">Theme</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["light", "dark", "system"] as const).map((themeOpt) => (
                      <button key={themeOpt} type="button" onClick={() => setTheme(themeOpt)} className={cn("rounded-xl border px-3 py-3 text-sm capitalize", theme === themeOpt ? "border-teal-500 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200" : "border-slate-200 dark:border-slate-700")}>{themeOpt}</button>
                    ))}
                  </div>
                  <div className="mt-6">
                    <div className="text-sm font-medium mb-1">{t("settings.preferredLanguage")}</div>
                    <p className="text-xs text-slate-500 mb-3">{t("settings.preferredLanguageHelp")}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SUPPORTED_LOCALES.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={localeBusy}
                          onClick={async () => {
                            setLocaleBusy(true);
                            setLocaleMsg(null);
                            try {
                              await setLocale(opt.id as AppLocale);
                              setLocaleMsg(`Saved · ${opt.label}`);
                            } catch (e) {
                              setLocaleMsg(e instanceof Error ? e.message : "Could not save language");
                            } finally {
                              setLocaleBusy(false);
                            }
                          }}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-sm text-left",
                            locale === opt.id
                              ? "border-teal-500 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200"
                              : "border-slate-200 dark:border-slate-700"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {localeMsg && <p className="text-xs text-slate-500 mt-2">{localeMsg}</p>}
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "templates" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> AI commentary templates</CardTitle></CardHeader>
                <CardBody className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
                  <p>On-device template suggestions for goals, cards, VAR, corners — on-device only. Live desk shortcuts: G goal, Y yellow, R red, S sub, C corner, V VAR, H half-time, F full-time.</p>
                </CardBody>
              </Card>
            )}
            {tab === "integrations" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4" /> Integrations</CardTitle></CardHeader>
                <CardBody className="space-y-4 text-sm">
                  <p className="text-slate-500">Optional keys: live-feed + AI lab env. Commercial plan is Unlimited £22. An AI key alone does <strong>not</strong> unlock Auto Gen — AI lab gate required.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={apiFootball ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>Live feed {apiFootball ? "configured" : "not configured"}</span>
                    <span className={gemini ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>AI key {gemini ? "present" : "not set"}</span>
                    <span className={plan?.hasIntel ? "rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>Plan {plan?.plan === "intel" ? "Intel" : "Base"}</span>
                  </div>
                  {integrationsHint && <p className="text-xs text-slate-500">{integrationsHint}</p>}
                  {afUsage && (afUsage.level === "warn" || afUsage.level === "high") && afUsage.message && (
                    <div
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-xs",
                        afUsage.level === "high"
                          ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
                          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                      )}
                    >
                      <div className="font-semibold">
                        {afUsage.level === "high" ? "Live-feed usage high" : "Live-feed usage warning"}
                        {afUsage.current != null && afUsage.limit != null
                          ? ` · ${afUsage.current}/${afUsage.limit}`
                          : ""}
                      </div>
                      <p className="mt-1 opacity-90">{afUsage.message}</p>
                      {afUsage.todo && <p className="mt-1 opacity-70">{afUsage.todo}</p>}
                    </div>
                  )}
                  {afUsage?.todo && afUsage.level === "unknown" && (
                    <p className="text-xs text-slate-500">{afUsage.todo}</p>
                  )}
                  <Button type="button" variant="outline" disabled={statusPending} onClick={testApiFootball}>{statusPending ? "Testing…" : "Test live-feed connection"}</Button>
                  {statusMsg && <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{statusMsg}</p>}
                  {afUsage && afUsage.level === "ok" && afUsage.current != null && afUsage.limit != null && (
                    <p className="text-xs text-slate-500">Usage today: {afUsage.current}/{afUsage.limit} requests</p>
                  )}
                </CardBody>
              </Card>
            )}
            {tab === "subscription" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Plan</CardTitle>
                </CardHeader>
                <CardBody className="text-sm space-y-4">
                  <div className="rounded-xl p-4 text-white bg-gradient-to-r from-teal-600 to-emerald-600">
                    <div className="text-xs uppercase tracking-wide opacity-80">Commercial plan</div>
                    <div className="text-xl font-bold mt-1">
                      {plan?.commercialName || plan?.copy?.unlimited?.name || "Unlimited"} · {plan?.commercialPrice || plan?.copy?.unlimited?.price || "£22"}/mo
                    </div>
                    <p className="text-sm opacity-90 mt-1">
                      Bring your notes. Full matchday desk — no separate Intel paid tier at launch.
                    </p>
                  </div>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
                    <div className="font-medium">Trial</div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {trial?.message || "14 days · 3 match desks · converts to Unlimited £22/mo unless cancelled."}
                    </p>
                    {trial && (
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                        <span>Status: {trial.billingStatus}</span>
                        {trial.daysRemaining != null && <span>· {trial.daysRemaining}d left</span>}
                        <span>· Desks {trial.desksUsed}/{trial.trialDeskLimit}</span>
                        {(trial.matchPassCredits ?? 0) > 0 && (
                          <span>· Pass credits {trial.matchPassCredits}</span>
                        )}
                        {trial.cancelAtPeriodEnd && <span>· Will not convert to £22</span>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {(!trial || trial.billingStatus === "none" || trial.billingStatus === "expired") && (
                        <Button type="button" disabled={planBusy} onClick={startAppTrial}>
                          Start 14-day trial
                        </Button>
                      )}
                      {trial?.trialActive && !trial.cancelAtPeriodEnd && (
                        <Button type="button" variant="outline" disabled={planBusy} onClick={cancelTrial}>
                          Cancel trial
                        </Button>
                      )}
                      {trial?.trialActive && trial.cancelAtPeriodEnd && !trial.stripeConfigured && (
                        <Button type="button" variant="outline" disabled={planBusy} onClick={resumeTrial}>
                          Resume trial (will convert)
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cancel path: {trial?.cancelPath || "Settings → Plan. Billing portal when keys exist."}
                    </p>
                  </div>

                  {trial?.trialActive && !trial.cancelAtPeriodEnd && (
                    <div className="rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/40 dark:bg-violet-950/20 p-4 space-y-3">
                      <div className="font-medium">During your trial</div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Plan was chosen at start (Unlimited or Match Desk Pass). Cancel mid-trial anytime —
                        Unlimited via Customer Portal (avoids £22 conversion); Pass via Cancel trial (app-side).
                        After a Pass trial you keep purchased credits.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" disabled={planBusy} onClick={cancelTrial}>
                          Cancel trial
                        </Button>
                        {trial?.stripeConfigured && (
                          <Button type="button" variant="outline" disabled={planBusy} onClick={openBillingPortal}>
                            Manage billing (portal)
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-teal-200 dark:border-teal-900 p-4 space-y-3">
                    <div className="font-medium">Billing</div>
                    <p className="text-xs text-slate-500">
                      {plan?.stripe || "Checkout / portal when billing keys exist; otherwise app-side trial above."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={planBusy} onClick={startUnlimitedCheckout}>
                        {trial?.stripeConfigured ? "Checkout Unlimited trial (→ £22/mo)" : "Subscribe Unlimited £22"}
                      </Button>
                      <Button type="button" variant="outline" disabled={planBusy} onClick={openBillingPortal}>
                        Manage billing / cancel
                      </Button>
                    </div>
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 pt-1">
                      Match Desk Pass (top-up)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Buy extra 1 / 5 / 10 desk credits anytime. Choose-at-start Pass packs also grant the
                      14-day / 3-desk trial on first purchase.
                      {(trial?.matchPassCredits ?? 0) > 0
                        ? ` You have ${trial?.matchPassCredits} credit${(trial?.matchPassCredits ?? 0) === 1 ? "" : "s"} left.`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={planBusy} onClick={() => buyMatchPass(1)}>
                        1 · £8
                      </Button>
                      <Button type="button" variant="outline" disabled={planBusy} onClick={() => buyMatchPass(5)}>
                        5 · £25
                      </Button>
                      <Button type="button" variant="outline" disabled={planBusy} onClick={() => buyMatchPass(10)}>
                        10 · £30
                      </Button>
                    </div>
                    {planMsg && <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{planMsg}</p>}
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                      {`Unlimited · ${plan?.copy?.unlimited?.price || plan?.copy?.base.price || "£22"}/mo`}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {(plan?.copy?.unlimited?.includes || plan?.copy?.base.includes || ["Paste your match prep", "RSS", "Live sync", "Dossiers / Stats / Scripts"]).map((f) => (
                        <li key={f}>· {f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="font-medium">AI lab gate (testing — not a paid tier)</div>
                    <p className="text-xs text-slate-500">
                      Chris-only toggle in <code className="font-mono">data/plan-override.json</code>.
                      Env: <code className="font-mono">PITCHLINE_PLAN={plan?.envPlan || "base"}</code>.
                      Does not change commercial Pricing.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={planBusy || plan?.plan === "intel"} onClick={() => setIntelEnabled(true)}>Enable AI lab</Button>
                      <Button type="button" variant="outline" disabled={planBusy || plan?.plan === "base"} onClick={() => setIntelEnabled(false)}>Disable AI lab</Button>
                    </div>
                    {plan?.override && <p className="text-[11px] text-slate-400">Override active: {plan.override}</p>}
                    <p className="text-[11px] text-slate-400">
                      Lab status: {plan?.hasIntel ? "AI features unlocked (if AI key set)" : "Notes paste / RSS only"}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{plan?.copy?.rivalCompare || "Unlimited £22/mo — no Intel upsell."}</p>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                    <div className="font-medium text-sm">Help & billing</div>
                    <p className="text-xs text-slate-500">
                      Self-serve answers before the demo video ships. Manage subscription or cancel via the portal when billing is configured.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href="/faq">
                        <Button type="button" variant="outline" className="gap-1.5">
                          <HelpCircle className="h-3.5 w-3.5" /> FAQ
                        </Button>
                      </Link>
                      <Link href="/training">
                        <Button type="button" variant="outline" className="gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5" /> Training
                        </Button>
                      </Link>
                      <Button type="button" variant="outline" disabled={planBusy} onClick={openBillingPortal}>
                        Manage billing (portal)
                      </Button>
                      <Link href="/pricing" className="inline-flex items-center text-sm text-teal-600 dark:text-teal-400 font-medium hover:underline px-2">
                        View pricing →
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "feedback" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> Bug / Improvement</CardTitle></CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <p className="text-slate-500">Send a bug or improvement note. Captures page URL and user agent. Sticky Feedback button also available on every page.</p>
                  <FeedbackWidget compact />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
        </div>
      </main>
      </div>
    </div>
  );
}
