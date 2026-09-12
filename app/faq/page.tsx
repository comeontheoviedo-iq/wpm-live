import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ArrowRight, HelpCircle } from "lucide-react";

const faqs: { q: string; a: string }[] = [
  {
    q: "What is CoComms?",
    a: "CoComms is your commentary co-pilot — you bring the notes and the voice, CoComms takes care of everything else you need to make the match comms seamless. Live feed, dynamic lineups, data viz, Scripts, pitch board, and dossiers on one desk.",
  },
  {
    q: "How does the trial work?",
    a: "You get 14 days and up to 3 match desks. Both Unlimited and Match Desk Pass are card-upfront when billing is configured. Choose your path at signup — no mid-trial plan switch required.",
  },
  {
    q: "What do I choose at the start?",
    a: "Unlimited (£22/mo after trial) or a Match Desk Pass pack (1 · £8 / 5 · £25 / 10 · £30). Unlimited converts to the subscription unless you cancel. Pass pays for credits up front and keeps those credits after the same 14-day / 3-desk trial.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Unlimited: cancel in the Stripe Customer Portal (Settings → Plan → Manage billing) so you do not convert to £22/mo. Pass: Cancel trial in Settings. You keep access until the trial end date when cancelled mid-trial.",
  },
  {
    q: "How do I bring my notes into CoComms?",
    a: "Bring your notes. We file them where you need them. Paste your match prep into Research — CoComms sorts it into Notes, Scripts, and profiles so you keep your own voice for day-one prep.",
  },
  {
    q: "What’s included on Unlimited?",
    a: "Bring your notes and Research paste, live feed with dynamic lineups, data viz, Notes, Scripts, pitch board, dossiers, Stats, Print, and unlimited match desks on your account after the trial.",
  },
  {
    q: "How do Match Desk Pass credits work after the trial?",
    a: "One credit = one match desk. After the 14-day / 3-desk trial, Pass customers keep purchased credits and spend one when creating a desk. Top up 1 / 5 / 10 packs anytime from Settings.",
  },
  {
    q: "What about my data and privacy?",
    a: "Match desks and notes stay personal to your account. You can opt in so anonymised notes help grow a shared CoComms intel pool — optional, never forced. Use Settings to manage billing; cancel anytime.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="border-b border-white/10 bg-[#0b1220]">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Support desk · CoComms
          </span>
          <span className="hidden sm:inline text-slate-500">FAQ</span>
        </div>
      </div>

      <header className="border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo href="/" />
          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link href="/pricing" className="hidden sm:inline text-slate-400 hover:text-teal-300">
              Pricing
            </Link>
            <Link href="/login" className="text-slate-300 hover:text-white px-2 py-1">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-200">
            <HelpCircle className="h-3.5 w-3.5" />
            Answers before kick-off
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
            Warm, short answers for trial, plans, notes, and cancel. Signed-in accounts
            can open Training from Settings anytime.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent open:border-teal-500/30 open:bg-teal-500/[0.04]"
            >
              <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-slate-100 marker:content-none [&::-webkit-details-marker]:hidden flex items-start justify-between gap-3">
                <span>{item.q}</span>
                <span className="mt-0.5 shrink-0 text-teal-400/80 text-lg leading-none group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed text-slate-400 border-t border-white/5 pt-3">
                {item.a}
              </div>
            </details>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-500/10 via-[#0d1524] to-[#0d1524] p-6">
          <h2 className="font-semibold text-teal-100">Still deciding?</h2>
          <p className="mt-2 text-sm text-slate-400">
            Compare Unlimited vs Pass, or start the 14-day trial and cancel anytime from Settings.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-teal-300"
            >
              Start 14-day trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="text-sm text-slate-400 hover:text-teal-300 px-1">
              View pricing →
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <Logo href="/" />
          <div className="flex flex-wrap gap-4">
            <Link href="/faq" className="hover:text-slate-300">
              FAQ
            </Link>
            <Link href="/pricing" className="hover:text-slate-300">
              Pricing
            </Link>
            <Link href="/signup" className="hover:text-slate-300">
              Trial signup
            </Link>
          </div>
          <p>© {new Date().getFullYear()} CoComms</p>
        </div>
      </footer>
    </div>
  );
}
