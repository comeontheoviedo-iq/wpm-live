"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import {
  User,
  Palette,
  CreditCard,
  ClipboardList,
  Mic2,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "profile" | "appearance" | "templates" | "integrations" | "subscription";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<Tab>("appearance");
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading settings…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
    {
      id: "appearance",
      label: "Appearance",
      icon: <Palette className="h-4 w-4" />,
    },
    {
      id: "templates",
      label: "Templates",
      icon: <Mic2 className="h-4 w-4" />,
    },
    {
      id: "integrations",
      label: "Integrations",
      icon: <Plug className="h-4 w-4" />,
    },
    {
      id: "subscription",
      label: "Subscription",
      icon: <CreditCard className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      <main className="mx-auto max-w-5xl px-3 sm:px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-teal-600 font-medium">Dashboard › Settings</p>
          <h1 className="text-2xl font-bold mt-1">Settings</h1>
          <p className="text-sm text-slate-500">
            Manage your account, theme, and commentary templates.
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
          <div className="md:col-span-3">
            {tab === "profile" && (
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-500">Name</div>
                    <div className="font-medium">{user.name}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="font-medium">{user.email}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Role</div>
                    <div className="font-medium">Commentator</div>
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "appearance" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Appearance
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <p className="text-sm text-slate-500 mb-4">
                    Customize how Pitchline looks on your device.
                  </p>
                  <div className="text-sm font-medium mb-2">Theme</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["light", "dark", "system"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTheme(t)}
                        className={cn(
                          "rounded-xl border px-3 py-3 text-sm capitalize",
                          theme === t
                            ? "border-teal-500 bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-200"
                            : "border-slate-200 dark:border-slate-700"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                    More appearance options coming soon: compact mode, font size,
                    accent color.
                  </div>
                </CardBody>
              </Card>
            )}
            {tab === "templates" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" /> AI commentary templates
                  </CardTitle>
                </CardHeader>
                <CardBody className="text-sm space-y-2 text-slate-600 dark:text-slate-300">
                  <p>
                    Pitchline ships with on-device template suggestions for goals,
                    cards, VAR, corners, and more. No external API calls —
                    suggestions are generated from local templates with match
                    context filled in.
                  </p>
                  <p>
                    Shortcuts on the live desk: G goal, Y yellow, R red, S sub, C
                    corner, V VAR, H half-time, F full-time.
                  </p>
                </CardBody>
              </Card>
            )}
            {tab === "integrations" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plug className="h-4 w-4" /> Integrations
                  </CardTitle>
                </CardHeader>
                <CardBody className="space-y-4 text-sm">
                  <p className="text-slate-500">
                    Optional keys live in <code className="font-mono">.env</code> /{" "}
                    <code className="font-mono">.env.local</code>. Exact names:{" "}
                    <code className="font-mono">API_FOOTBALL_KEY</code>,{" "}
                    <code className="font-mono">GEMINI_API_KEY</code>. Restart the
                    Next.js server after edits. Status:{" "}
                    <code className="font-mono">/api/integrations</code>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={
                        apiFootball
                          ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium"
                          : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"
                      }
                    >
                      API-Football {apiFootball ? "configured" : "not configured"}
                    </span>
                    <span
                      className={
                        gemini
                          ? "rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 px-2.5 py-1 text-xs font-medium"
                          : "rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 text-xs font-medium"
                      }
                    >
                      Gemini {gemini ? "configured" : "not configured"}
                    </span>
                  </div>
                  {integrationsHint && (
                    <p className="text-xs text-slate-500">{integrationsHint}</p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={statusPending}
                    onClick={testApiFootball}
                  >
                    {statusPending ? "Testing…" : "Test API-Football connection"}
                  </Button>
                  {statusMsg && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                      {statusMsg}
                    </p>
                  )}
                </CardBody>
              </Card>
            )}
            {tab === "subscription" && (
              <Card>
                <CardHeader>
                  <CardTitle>Subscription</CardTitle>
                </CardHeader>
                <CardBody className="text-sm">
                  <div className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white p-4">
                    <div className="text-xs uppercase tracking-wide opacity-80">
                      Current plan
                    </div>
                    <div className="text-xl font-bold mt-1">Demo Pro</div>
                    <p className="text-sm opacity-90 mt-1">
                      Full matchday desk unlocked for this demo environment.
                    </p>
                  </div>
                  <a
                    href="/pricing"
                    className="inline-block mt-4 text-teal-600 font-medium hover:underline"
                  >
                    View pricing →
                  </a>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
