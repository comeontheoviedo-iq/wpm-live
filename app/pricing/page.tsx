"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const unlimitedFeatures = [
  "BYO Notebook / Research paste (core — no Gemini required)",
  "News RSS",
  "Live-feed sync",
  "Notes buckets + relevance heuristics",
  "OBS overlay, dossiers, Stats, Speaks, Print",
  "Unlimited match desks on your account",
];

export default function PricingPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/login?next=/pricing";
        return;
      }
      if (res.status === 503) {
        setMsg(
          String(
            json.todo ||
              "Stripe keys not set yet — sign in to use the desk. Chris: add STRIPE_SECRET_KEY + STRIPE_PRICE_UNLIMITED in Netlify."
          )
        );
        return;
      }
      if (!res.ok || !json.url) {
        throw new Error(String(json.error || "Checkout unavailable"));
      }
      window.location.href = String(json.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Logo href="/login" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/settings" className="text-slate-500 hover:text-teal-600 hidden sm:inline">
              Settings
            </Link>
            <Link href="/login" className="text-teal-600 font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            One plan. Unlimited matchday desk.
          </h1>
          <p className="mt-3 text-slate-500">
            Unlimited (Basic) at £22/mo — BYO Notebook is the core. No separate
            Intel tier at launch. Compare to ~£35/mo rivals.
          </p>
        </div>
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border border-teal-500 shadow-lg shadow-teal-900/10 bg-gradient-to-b from-teal-50 to-white dark:from-teal-950 dark:to-slate-900 p-6 flex flex-col">
            <div className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Unlimited
              <span className="ml-2 text-xs font-normal text-slate-500">also called Basic</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">£22</span>
              <span className="text-sm text-slate-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Full commentary prep desk — your Notebook, RSS, live sync, OBS.
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              {unlimitedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <Button
                className="w-full"
                variant="primary"
                disabled={busy}
                onClick={startCheckout}
              >
                {busy ? "Starting checkout…" : "Get Unlimited — £22/mo"}
              </Button>
              <Link href="/login" className="block">
                <Button className="w-full" variant="outline">
                  Sign in to the desk
                </Button>
              </Link>
            </div>
            {msg && (
              <p className="mt-3 text-xs text-slate-500 whitespace-pre-wrap">{msg}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
