import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import {
  Mic2,
  Radio,
  NotebookPen,
  MonitorPlay,
  Timer,
  ArrowRight,
  Check,
} from "lucide-react";

const pillars = [
  {
    icon: NotebookPen,
    title: "Bring your notes",
    body: "We file them where you need them. Paste your match prep — CoComms sorts it into Notes, Scripts, and profiles. No scramble through tabs when the fourth official board goes up.",
  },
  {
    icon: Radio,
    title: "Live desk that stays out of the way",
    body: "Pitch board, Scripts, dossiers, live feed, and dynamic lineups — the desk stays ready so you can stay on the call.",
  },
  {
    icon: MonitorPlay,
    title: "Broadcast-ready output",
    body: "Less sorting, more calling — your prep filed and ready when you open the mic.",
  },
];

const trialPoints = [
  "Choose at start: Unlimited OR Match Desk Pass (1 / 5 / 10)",
  "Both: card-upfront · 14 days · max 3 match desks",
  "Unlimited → £22/mo unless cancelled in Customer Portal",
  "Pass → keep purchased credits after trial (not Unlimited)",
];

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      {/* Broadcast top bar */}
      <div className="border-b border-white/10 bg-[#0b1220]">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Matchday desk · CoComms
          </span>
          <span className="hidden sm:inline text-slate-500">Prep → Live → Post</span>
        </div>
      </div>

      <header className="border-b border-white/5">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo href="/" />
          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link href="/faq" className="hidden sm:inline text-slate-400 hover:text-teal-300">
              FAQ
            </Link>
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

      <main>
        {/* Hero — matchday commentary craft */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(45,212,191,0.18),transparent_45%),radial-gradient(ellipse_at_90%_20%,rgba(244,63,94,0.12),transparent_40%),linear-gradient(180deg,#070b12_0%,#0a1524_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent" />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-200">
                <Mic2 className="h-3.5 w-3.5" />
                Built for football commentators
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.25rem] leading-[1.08]">
                The match desk you wish you had{" "}
                <span className="text-teal-300">before kick-off</span>.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
                CoComms is your commentary co-pilot — you bring the notes and the
                voice, CoComms takes care of everything else you need to make the
                match comms seamless.
              </p>
              <p className="mt-3 max-w-xl text-sm font-medium tracking-wide text-teal-200/90">
                Live feed · dynamic lineups · data viz · Scripts · pitch board
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-900/40 hover:bg-teal-300"
                >
                  Start 14-day trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Sign in to your desk
                </Link>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Choose Unlimited or a Match Desk Pass at start · 14 days · 3 desks
              </p>
            </div>

            {/* Honest placeholder — real desk demo video coming */}
            <div className="relative">
              <div className="rounded-2xl border border-white/10 bg-[#0d1524] p-4 shadow-2xl shadow-black/50 ring-1 ring-teal-500/20">
                <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  <span className="inline-flex items-center gap-1.5 text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> On air desk
                  </span>
                  <span>CoComms</span>
                </div>
                <div className="flex aspect-video flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#05080f] px-6 text-center">
                  <MonitorPlay className="h-8 w-8 text-teal-400/80" />
                  <p className="mt-3 text-sm font-semibold text-slate-200">
                    Demo video coming soon
                  </p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
                    A real walkthrough of the live desk — notes, Scripts, pitch board,
                    and feed — will land here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="mb-8 max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400/90">
              Why commentators use it
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Live desk value when the clock is running
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5"
              >
                <p.icon className="h-5 w-5 text-teal-300" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trial + price */}
        <section className="border-y border-white/5 bg-[#0a1220]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-teal-300 text-sm font-medium">
                <Timer className="h-4 w-4" />
                Trial model
              </div>
              <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
                Pick Unlimited or a Match Desk Pass before you start.
              </h2>
              <p className="mt-3 text-slate-400 text-sm leading-relaxed">
                Card-upfront when billing is configured. Unlimited converts to £22/mo
                unless you cancel in the Customer Portal. Pass pays for credits at
                start and keeps them after the same 14-day / 3-desk trial.
              </p>
              <ul className="mt-5 space-y-2">
                {trialPoints.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-teal-500/40 bg-gradient-to-br from-teal-500/15 via-[#0d1524] to-[#0d1524] p-6 shadow-xl shadow-teal-950/30">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">
                Choose at start
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="font-semibold text-teal-200">Unlimited · £22/mo</div>
                  <div className="text-xs text-slate-400 mt-0.5">14-day trial → converts unless cancelled</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <div className="font-semibold text-slate-100">Match Desk Pass · £8 / £25 / £30</div>
                  <div className="text-xs text-slate-400 mt-0.5">Same trial · keep credits after (not Unlimited)</div>
                </div>
              </div>
              <Link
                href="/signup"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300"
              >
                Choose plan & start trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="mt-3 block text-center text-xs text-slate-500 hover:text-teal-300"
              >
                Compare Unlimited vs Pass →
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Ready for the next kick-off?</h2>
          <p className="mt-2 text-slate-400 text-sm">
            Create your CoComms account, open a desk, and prep like you&apos;re already on air.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300"
            >
              Start 14-day trial
            </Link>
            <Link href="/login" className="text-sm text-slate-400 hover:text-white">
              Already have an account? Sign in
            </Link>
          </div>
        </section>
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
            <Link href="/login" className="hover:text-slate-300">
              Sign in
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
