import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Starter",
    price: "£19",
    blurb: "Solo commentators covering local leagues.",
    features: [
      "2 match days / month",
      "Speaks & checklist",
      "Pitch board",
      "Print pack",
    ],
  },
  {
    name: "Pro",
    price: "£49",
    blurb: "Working freelancers who live on matchday.",
    features: [
      "Unlimited match days",
      "Live event composer",
      "AI commentary templates",
      "Injuries, scorers, keepers",
      "Dark mode & mobile desk",
    ],
    highlight: true,
  },
  {
    name: "Desk",
    price: "£129",
    blurb: "Stations and multi-commentator crews.",
    features: [
      "Everything in Pro",
      "Shared workspaces",
      "Export API (soon)",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Logo href="/login" />
          <Link href="/login" className="text-sm text-teal-600 font-medium">
            Sign in
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Pricing that fits the gantry, not the boardroom
          </h1>
          <p className="mt-3 text-slate-500">
            Mock pricing for the Pitchline demo. No payment required — sign in
            with the demo account and explore the full desk.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl border p-6 flex flex-col ${
                t.highlight
                  ? "border-teal-500 shadow-lg shadow-teal-900/10 bg-gradient-to-b from-teal-50 to-white dark:from-teal-950 dark:to-slate-900"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                {t.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{t.price}</span>
                <span className="text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-slate-500">{t.blurb}</p>
              <ul className="mt-4 space-y-2 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="mt-6">
                <Button
                  className="w-full"
                  variant={t.highlight ? "primary" : "outline"}
                >
                  Try demo
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
