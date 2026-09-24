"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const unlimitedFeatures = [
  "Paste your match prep — sorted into Notes, Scripts, profiles",
  "News RSS",
  "Live-feed sync",
  "Notes buckets + relevance heuristics",
  "Dossiers, Stats, Scripts, Print",
  "Unlimited match desks on your account after trial",
];

const passPacks: { credits: 1 | 5 | 10; price: string; label: string }[] = [
  { credits: 1, price: "£8", label: "1 Match Desk Pass" },
  { credits: 5, price: "£25", label: "5 Match Desk Pass" },
  { credits: 10, price: "£30", label: "10 Match Desk Pass" },
];

export default function PricingPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedPass, setSelectedPass] = useState<1 | 5 | 10>(5);
  const [region, setRegion] = useState<{
    currency: "gbp" | "usd" | "eur";
    symbol: string;
    unlimited: number;
    founding: { code: string; price: number; months: number } | null;
  }>({ currency: "gbp", symbol: "£", unlimited: 22, founding: null });
  const [promo, setPromo] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const raw = (qs.get("promo") || qs.get("code") || "").trim().toUpperCase();
    if (/^[A-Z0-9]{3,64}$/.test(raw)) {
      document.cookie = `cocomms_promo=${encodeURIComponent(raw)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      setPromo(raw);
    } else {
      const m = document.cookie.match(/(?:^|;\s*)cocomms_promo=([^;]+)/);
      if (m) setPromo(decodeURIComponent(m[1]));
    }
    fetch("/api/billing/region")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && j.currency) setRegion(j);
      })
      .catch(() => {});
  }, []);

  const foundingActive = Boolean(region.founding && promo === region.founding.code);

  async function startUnlimitedCheckout() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "unlimited", promo }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        window.location.href = "/signup?plan=unlimited";
        return;
      }
      if (res.status === 503) {
        setMsg(
          "Billing not configured yet — create an account to start the 14-day / 3-desk app-side trial. Chris: add Polar keys on pitchline-app (docs/POLAR_BILLING.md)."
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

  async function startPassCheckout(credits: 1 | 5 | 10) {
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
        window.location.href = `/signup?plan=pass&credits=${credits}`;
        return;
      }
      if (res.status === 503) {
        setMsg(
          String(
            json.todo ||
              "Match Desk Pass not configured yet — set POLAR_PRODUCT_PASS_1 / _5 / _10 (or Stripe) in Netlify."
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
            <Link href="/faq" className="text-slate-400 hover:text-teal-300 hidden sm:inline">
              FAQ
            </Link>
            <Link href="/login" className="text-slate-300 hover:text-white">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
            >
              Choose plan
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Choose at start: Unlimited or Match Desk Pass
          </h1>
          <p className="mt-3 text-slate-400">
            Both include a 14-day trial with max 3 match desks and card-upfront
            Checkout. Unlimited converts to {region.symbol}{region.unlimited}/mo unless cancelled. Pass pays
            for 1 / 5 / 10 credits up front — after trial you keep those credits
            (not Unlimited).
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-teal-500/50 shadow-lg shadow-teal-900/20 bg-gradient-to-b from-teal-500/10 to-[#0d1524] p-6 flex flex-col">
            <div className="text-sm font-semibold text-teal-300">
              Unlimited
              <span className="ml-2 text-xs font-normal text-slate-500">also called Basic</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {foundingActive && region.founding ? (
                <>
                  <span className="text-3xl font-bold">
                    {region.symbol}
                    {region.founding.price}
                  </span>
                  <span className="text-lg text-slate-500 line-through">
                    {region.symbol}
                    {region.unlimited}
                  </span>
                  <span className="text-sm text-slate-400">/mo after trial</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-bold">
                    {region.symbol}
                    {region.unlimited}
                  </span>
                  <span className="text-sm text-slate-400">/mo after trial</span>
                </>
              )}
            </div>
            {foundingActive && region.founding ? (
              <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
                Founding Commentator rate applied ({region.founding.code}): {region.symbol}
                {region.founding.price}/mo locked for {region.founding.months} months, then{" "}
                {region.symbol}
                {region.unlimited}/mo. First 50 seats, until 31 Oct 2026.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                14-day trial · card upfront · cancel anytime. Have a code? Enter it at checkout.
              </p>
            )}
            <ul className="mt-4 space-y-2 flex-1">
              {unlimitedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-teal-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <Link href="/signup?plan=unlimited" className="block">
                <Button className="w-full" variant="primary">
                  Choose Unlimited trial
                </Button>
              </Link>
              <Button
                className="w-full"
                variant="outline"
                disabled={busy}
                onClick={startUnlimitedCheckout}
              >
                {busy ? "Starting checkout…" : "Checkout Unlimited (card-upfront)"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-[#0d1524] p-6 flex flex-col">
            <div className="text-sm font-semibold text-slate-200">Match Desk Pass</div>
            <p className="mt-2 text-sm text-slate-400">
              Pay for a pack at start. Same 14-day / 3-desk trial in-app. After
              trial you have the purchased credits — one credit = one desk.
            </p>
            <ul className="mt-4 space-y-3 flex-1">
              {passPacks.map((p) => (
                <li key={p.credits}>
                  <button
                    type="button"
                    onClick={() => setSelectedPass(p.credits)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      selectedPass === p.credits
                        ? "border-teal-500/70 bg-teal-500/10"
                        : "border-white/10 hover:border-white/25"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-xs text-slate-500">{p.price} one-time · card-upfront</div>
                    </div>
                    <span className="text-xs text-teal-300">
                      {selectedPass === p.credits ? "Selected" : "Select"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 space-y-2">
              <Link href={`/signup?plan=pass&credits=${selectedPass}`} className="block">
                <Button className="w-full" variant="primary">
                  Choose {selectedPass}-pass trial
                </Button>
              </Link>
              <Button
                className="w-full"
                variant="outline"
                disabled={busy}
                onClick={() => startPassCheckout(selectedPass)}
              >
                {busy ? "Starting checkout…" : `Checkout Pass ${selectedPass}`}
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Already on a trial? Settings → Plan for cancel / portal / top-up packs.
            </p>
          </div>
        </div>
        <section className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-center text-xl font-semibold">For stations and clubs</h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Shared Unlimited seats for a commentary team, billed monthly in GBP. After purchase,
            reply to your receipt with your commentators&apos; emails and we set up the seats,
            usually the same day.
          </p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {[
              {
                name: "Station",
                price: "£49",
                seats: 3,
                who: "Hospital, community and student radio sport desks",
                href: "https://buy.polar.sh/polar_cl_4JgIFonlIyLs8hFzhZKzbpGlC92B0xYlBWM8s2eYTOP",
              },
              {
                name: "Club",
                price: "£99",
                seats: 5,
                who: "Club media teams and small productions",
                href: "https://buy.polar.sh/polar_cl_7b6b7iCdFHobdlTinPApsKNk3AyupLl81EDgV47zEdp",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-white/15 bg-[#0d1524] p-6 flex flex-col">
                <div className="text-sm font-semibold text-slate-200">{t.name}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{t.price}</span>
                  <span className="text-sm text-slate-400">/mo · {t.seats} seats</span>
                </div>
                <p className="mt-2 text-sm text-slate-400 flex-1">{t.who}</p>
                <div className="mt-6 space-y-2">
                  <a href={t.href} className="block" target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" variant="primary">
                      Buy {t.name}
                    </Button>
                  </a>
                  <a
                    href={`mailto:chris@ronniedogmedia.com?subject=${encodeURIComponent(`CoComms ${t.name} plan`)}`}
                    className="block"
                  >
                    <Button className="w-full" variant="outline">
                      Talk to us
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
        {msg && (
          <p className="mt-6 text-center text-xs text-slate-400 whitespace-pre-wrap max-w-xl mx-auto">
            {msg}
          </p>
        )}
        <p className="mt-8 text-center text-xs text-slate-500">
          Questions?{" "}
          <Link href="/faq" className="text-teal-400 hover:underline">
            FAQ
          </Link>
          {" · "}
          <Link href="/signup" className="text-teal-400 hover:underline">
            Start trial
          </Link>
        </p>
      </main>
    </div>
  );
}
