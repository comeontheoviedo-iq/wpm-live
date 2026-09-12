"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const unlimitedFeatures = [
  "BYO Notebook / Research paste (core)",
  "News RSS",
  "Live-feed sync",
  "Notes buckets + relevance heuristics",
  "OBS overlay, dossiers, Stats, Speaks, Print",
  "Unlimited match desks on your account",
];

const passPacks: { credits: 1 | 5 | 10; price: string; label: string }[] = [
  { credits: 1, price: "£8", label: "1 Match Desk Pass" },
  { credits: 5, price: "£25", label: "5 Match Desk Pass" },
  { credits: 10, price: "£30", label: "10 Match Desk Pass" },
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
        window.location.href = "/signup?next=/pricing";
        return;
      }
      if (res.status === 503) {
        setMsg(
          "Billing not configured yet — create an account to start the 14-day / 3-desk app-side trial. Chris: add billing keys + Unlimited £22 price in Netlify for card-upfront Checkout."
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

  async function buyPass(credits: 1 | 5 | 10) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "match_pass", credits }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/signup?next=/pricing";
        return;
      }
      if (res.status === 503) {
        setMsg(
          String(
            json.todo ||
              "Match Desk Pass not configured yet — set STRIPE_PRICE_PASS_1 / _5 / _10 in Netlify."
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
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Logo href="/" />
          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-slate-400 hover:text-teal-300 hidden sm:inline">
              Home
            </Link>
            <Link href="/login" className="text-slate-300 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
            >
              Start trial
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            One plan. Unlimited matchday desk.
          </h1>
          <p className="mt-3 text-slate-400">
            Start with a 14-day trial (3 match desks). Converts to Unlimited £22/mo
            unless you cancel in Settings. Prefer pay-per-match? Buy a Match Desk Pass
            pack — mid-trial you can switch so Unlimited does not convert. BYO Notebook
            is the core.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-teal-500/50 shadow-lg shadow-teal-900/20 bg-gradient-to-b from-teal-500/10 to-[#0d1524] p-6 flex flex-col">
            <div className="text-sm font-semibold text-teal-300">
              Unlimited
              <span className="ml-2 text-xs font-normal text-slate-500">also called Basic</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">£22</span>
              <span className="text-sm text-slate-400">/mo after trial</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Card-upfront trial when billing is live · 14 days · 3 desks · then £22/mo
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              {unlimitedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <Link href="/signup" className="block">
                <Button className="w-full" variant="primary">
                  Start 14-day trial
                </Button>
              </Link>
              <Button
                className="w-full"
                variant="outline"
                disabled={busy}
                onClick={startCheckout}
              >
                {busy ? "Starting checkout…" : "Checkout / card-upfront trial"}
              </Button>
              <Link href="/login" className="block">
                <Button className="w-full" variant="outline">
                  Sign in to the desk
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-[#0d1524] p-6 flex flex-col">
            <div className="text-sm font-semibold text-slate-200">Match Desk Pass</div>
            <p className="mt-2 text-sm text-slate-400">
              Pay-per-match packs. One credit = one match desk. Mid-trial: switch from
              Settings to avoid Unlimited conversion.
            </p>
            <ul className="mt-4 space-y-3 flex-1">
              {passPacks.map((p) => (
                <li
                  key={p.credits}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5"
                >
                  <div>
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.price} one-time</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => buyPass(p.credits)}
                  >
                    Buy
                  </Button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              Already on a trial? Open Settings → Plan for Cancel / Stay on Unlimited /
              Switch to Match Desk Pass.
            </p>
          </div>
        </div>
        {msg && (
          <p className="mt-6 text-center text-xs text-slate-400 whitespace-pre-wrap max-w-xl mx-auto">
            {msg}
          </p>
        )}
      </main>
    </div>
  );
}
