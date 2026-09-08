"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import {
  User,
  Palette,
  CreditCard,
  ClipboardList,
  Mic2,
  Plug,
  MessageSquarePlus,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab =
  | "profile"
  | "appearance"
  | "templates"
  | "integrations"
  | "subscription"
  | "feedback";

type PlanStatus = {
  plan: "base" | "intel";
  envPlan: "base" | "intel";
  override: "base" | "intel" | null;
  hasIntel: boolean;
  geminiKeyConfigured: boolean;
  canUseGeminiBrief: boolean;
  canAutoGenPack: boolean;
  stripe?: string;
  copy?: {
    base: { name: string; price: string; includes: string[] };
    intel: { name: string; price: string; includes: string[]; softCaps?: string };
    rivalCompare?: string;
  };
};

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("subscription");
  const [user, setUser] = useState<{
    name: string;
    email: string;
    avatarInitials: string;
  } | null>(null);
  const [apiFootball, setApiFootball] = useState(false);
  const [gemini, setGemini] = useState(false);
  const [integrationsHint, setIntegrationsHint] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  function loadPlan() {
    return fetch("/api/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setPlan(j as PlanStatus);
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
      })
      .catch(() => undefined);
    loadPlan();
  }, [router]);

  async function testApiFootball() {
    setStatusPending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/football/status");
      const json = await res.json();
      setApiFootball(Boolean(json.configured));
      setStatusMsg(json.message || (json.ok ? "Connection OK" : "Connection failed"));
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
            BYO research is the default on Base. Gemini features require the Intel add-on.
          </p>
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
                    {(["light", "dark", "system"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setTheme(t)} className={cn("rounded-xl border px-3 py-3 text-sm capitalize", theme === t ? "border-teal-500 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200" : "border-slate-200 dark:border-slate-700")}>{t}</button>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "templates" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> AI commentary templates</CardTitle></CardHeader>
                <CardBody className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
                  <p>On-device template suggestions for goals, cards, VAR, corners — no Gemini. Live desk shortcuts: G goal, Y yellow, R red, S sub, C corner, V VAR, H half-time, F full-time.</p>
                </CardBody>
              </Card>
            )}
            {tab === "integrations" && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="h-4 w-4" /> Integrations</CardTitle></CardHeader>
                <CardBody className="space-y-4 text-sm">
                  <p className="text-slate-500">Optional keys in <code className="font-mono">.env</code>: live-feed key, <code className="font-mono">GEMINI_API_KEY</code>, plan env. A Gemini key alone does <strong>not</strong> unlock Auto Gen / briefs on Base — Intel plan required.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={apiFootball ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>Live feed {apiFootball ? "configured" : "not configured"}</span>
                    <span className={gemini ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>Gemini key {gemini ? "present" : "not set"}</span>
                    <span className={plan?.hasIntel ? "rounded-full bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200 px-2.5 py-1 text-xs font-medium" : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"}>Plan {plan?.plan === "intel" ? "Intel" : "Base"}</span>
                  </div>
                  {integrationsHint && <p className="text-xs text-slate-500">{integrationsHint}</p>}
                  <Button type="button" variant="outline" disabled={statusPending} onClick={testApiFootball}>{statusPending ? "Testing…" : "Test live-feed connection"}</Button>
                  {statusMsg && <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{statusMsg}</p>}
                </CardBody>
              </Card>
            )}
            {tab === "subscription" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Plan</CardTitle>
                </CardHeader>
                <CardBody className="text-sm space-y-4">
                  <div className={cn("rounded-xl p-4 text-white", plan?.hasIntel ? "bg-gradient-to-r from-violet-600 to-teal-600" : "bg-gradient-to-r from-teal-600 to-emerald-600")}>
                    <div className="text-xs uppercase tracking-wide opacity-80">Current plan</div>
                    <div className="text-xl font-bold mt-1">{plan?.hasIntel ? "Intel" : "Base (Matchday)"}</div>
                    <p className="text-sm opacity-90 mt-1">
                      {plan?.hasIntel
                        ? "Gemini brief, Auto Gen packs, note-draft, optional re-rank unlocked."
                        : "BYO Notebook + RSS + live-feed sync. Gemini features gated until Intel."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                    <div className="font-medium">Enable Intel features</div>
                    <p className="text-xs text-slate-500">
                      Testing toggle for Chris — stored in <code className="font-mono">data/plan-override.json</code>.
                      Env default: plan env = <code className="font-mono">{plan?.envPlan || "base"}</code>.
                      Stripe billing comes later ({plan?.stripe || "scaffold only"}).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={planBusy || plan?.plan === "intel"} onClick={() => setIntelEnabled(true)}>Turn on Intel</Button>
                      <Button type="button" variant="outline" disabled={planBusy || plan?.plan === "base"} onClick={() => setIntelEnabled(false)}>Back to Base</Button>
                    </div>
                    {planMsg && <p className="text-xs text-slate-600 dark:text-slate-300">{planMsg}</p>}
                    {plan?.override && <p className="text-[11px] text-slate-400">Override active: {plan.override} (wins over env)</p>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <div className="text-xs font-semibold text-teal-700 dark:text-teal-300">{`Base · ${plan?.copy?.base.price || "£19.99"}/mo`}</div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {(plan?.copy?.base.includes || ["BYO Notebook", "RSS news", "Live-feed sync", "Heuristics", "OBS / dossiers / Stats"]).map((f) => (
                          <li key={f}>· {f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-violet-200 dark:border-violet-900 p-3">
                      <div className="text-xs font-semibold text-violet-700 dark:text-violet-300">Intel · +£7/mo</div>
                      <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        {(plan?.copy?.intel.includes || ["Web brief", "Auto Gen", "Note-draft", "Re-rank"]).map((f) => (
                          <li key={f}>· {f}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] text-slate-400">{plan?.copy?.intel.softCaps || "Soft caps later: ~20 briefs / 10 pack gens."}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{plan?.copy?.rivalCompare || "Compare to ~£35/mo rival desks."}</p>
                  <a href="/pricing" className="inline-block text-teal-600 font-medium hover:underline">View pricing →</a>
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
