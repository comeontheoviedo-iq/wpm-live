import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const baseFeatures = [
  "BYO Notebook / Research paste (local organise — no Gemini)",
  "News RSS only",
  "Diet AF live sync",
  "Notes buckets + relevance heuristics (no Gemini re-rank)",
  "OBS overlay, dossiers, Stats, Speaks, Print",
];

const intelFeatures = [
  "Everything in Base",
  "News Gemini web brief",
  "Auto Gen pack (pack-generate)",
  "Player note-draft",
  "Optional Gemini relevant re-rank",
];

export default function PricingPage() {
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
            Matchday desk first. Intel when you need it.
          </h1>
          <p className="mt-3 text-slate-500">
            Base keeps commentary prep affordable. Gemini features sit behind the
            Intel add-on — BYO research is the default. Compare to ~£35/mo rivals.
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Stripe checkout not live yet — demo unlocks the desk; enable Intel in
            Settings for testing.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          <div className="rounded-2xl border border-teal-500 shadow-lg shadow-teal-900/10 bg-gradient-to-b from-teal-50 to-white dark:from-teal-950 dark:to-slate-900 p-6 flex flex-col">
            <div className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Base (Matchday)
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">£19.99</span>
              <span className="text-sm text-slate-500">/mo</span>
              <span className="text-xs text-slate-400 line-through">£15 intro</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Solo / freelance matchday core — your Notebook, RSS, AF sync.
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              {baseFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="mt-6">
              <Button className="w-full" variant="primary">
                Start on Base
              </Button>
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 flex flex-col">
            <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
              Intel add-on
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold">+£7</span>
              <span className="text-sm text-slate-500">/mo</span>
              <span className="text-xs text-slate-400">(~£26.99 total)</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Gemini web brief, Auto Gen packs, note-draft, optional re-rank.
            </p>
            <ul className="mt-4 space-y-2 flex-1">
              {intelFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Soft caps (metering later): ~20 web briefs / mo · ~10 pack gens / mo.
            </p>
            <Link href="/settings" className="mt-6">
              <Button className="w-full" variant="outline">
                Enable Intel in Settings (test)
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
