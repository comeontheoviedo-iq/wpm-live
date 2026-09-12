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
    <div className="min-h-screen bg-[#05080f] text-slate-100 antialiased">
      {/* Broadcast top bar — craft TV, not SaaS ribbon */}
      <div className="border-b border-white/[0.08] bg-[#070b12]">
        <div className="mx-auto flex h-8 max-w-6xl items-center justify-between px-4 font-[family-name:var(--font-plex-mono)] text-[10px] font-semibold uppercase tracking-[0.22em] text-teal-300/85">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-[1px] bg-[var(--live,#e11d48)]" />
            Matchday desk · CoComms
          </span>
          <span className="hidden sm:inline tracking-[0.18em] text-slate-500">
            Prep → Live → Post
          </span>
        </div>
      </div>

      <header className="border-b border-white/[0.06] bg-[#070b12]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo href="/" />
          <nav className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link
              href="/faq"
              className="hidden sm:inline text-slate-400 hover:text-teal-300"
            >
              FAQ
            </Link>
            <Link
              href="/pricing"
              className="hidden sm:inline text-slate-400 hover:text-teal-300"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="px-2 py-1 text-slate-300 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-[2px] bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero — broadcast desk personality */}
        <section className="relative overflow-hidden border-b border-white/[0.06]">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden
            style={{
              backgroundImage: `
                radial-gradient(ellipse at 18% 0%, rgba(45,212,191,0.16), transparent 42%),
                radial-gradient(ellipse at 88% 12%, rgba(245,158,11,0.08), transparent 38%),
                linear-gradient(180deg, #05080f 0%, #0a1220 55%, #070b12 100%)
              `,
            }}
          />
          {/* Soft pitch grid — craft, not stock SaaS blobs */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            aria-hidden
            style={{
              backgroundImage: `
                linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)
              `,
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at 50% 40%, black 20%, transparent 72%)",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-teal-500/45 to-transparent" />

          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-14 lg:py-24">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-[2px] border border-teal-500/35 bg-teal-500/[0.08] px-3 py-1 font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">
                <Mic2 className="h-3.5 w-3.5" />
                Built for football commentators
              </div>
              <h1 className="max-w-[18ch] text-[2.35rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[3.35rem]">
                The match desk you wish you had{" "}
                <span className="bg-gradient-to-r from-teal-300 to-teal-200 bg-clip-text text-transparent">
                  before kick-off
                </span>
                .
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg sm:leading-relaxed">
                CoComms is your commentary co-pilot — you bring the notes and the
                voice, CoComms takes care of everything else you need to make the
                match comms seamless.
              </p>
              <p className="mt-4 font-[family-name:var(--font-plex-mono)] text-[11px] font-medium uppercase tracking-[0.14em] text-teal-200/90">
                Live feed · dynamic lineups · data viz · Scripts · pitch board
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-[2px] bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_12px_32px_rgba(13,148,136,0.28)] hover:bg-teal-300"
                >
                  Start 14-day trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-[2px] border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 hover:border-white/25 hover:bg-white/[0.06]"
                >
                  Sign in to your desk
                </Link>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Choose Unlimited or a Match Desk Pass at start · 14 days · 3
                desks
              </p>
            </div>

            {/* Trailer frame — scorebug / broadcast plate, keep Homepage Trailer embed */}
            <div className="relative">
              <div
                className="absolute -inset-3 rounded-[3px] opacity-60 blur-2xl"
                aria-hidden
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(45,212,191,0.18), transparent 65%)",
                }}
              />
              <div className="relative overflow-hidden rounded-[3px] border border-white/12 bg-[#05080f] shadow-[0_24px_60px_rgba(0,0,0,0.65),0_0_0_1px_rgba(0,0,0,0.5)]">
                {/* Scorebug-style titlebar */}
                <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0d12] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 items-center gap-1.5 rounded-[2px] bg-[var(--live,#e11d48)] px-1.5 font-[family-name:var(--font-plex-mono)] text-[9px] font-bold uppercase tracking-[0.14em] text-white">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      On air
                    </span>
                    <span className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Homepage Trailer
                    </span>
                  </div>
                  <span className="hidden font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.14em] text-slate-600 sm:inline">
                    Trailer · ~40s
                  </span>
                </div>
                <div className="relative aspect-video bg-[#03050a]">
                  {/* Corner ticks — broadcast plate */}
                  <span
                    className="pointer-events-none absolute left-2 top-2 h-3 w-3 border-l border-t border-teal-400/50"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute right-2 top-2 h-3 w-3 border-r border-t border-teal-400/50"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 left-2 h-3 w-3 border-b border-l border-teal-400/50"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute bottom-2 right-2 h-3 w-3 border-b border-r border-teal-400/50"
                    aria-hidden
                  />
                  <video
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    preload="metadata"
                  >
                    <source
                      src="/videos/cocomms-trailer.mp4"
                      type="video/mp4"
                    />
                    Your browser does not support the demo video.
                  </video>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0a0d12] px-3 py-2">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    ~40s trailer — pitch alive, ticker, STATS, LEAGUE & HOOKS.
                  </p>
                  <span className="shrink-0 font-[family-name:var(--font-plex-mono)] text-[9px] uppercase tracking-[0.12em] text-amber-400/80">
                    Stay on the call
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-9 max-w-2xl">
            <p className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-teal-400/90">
              Why commentators use it
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
              Live desk value when the clock is running
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-[3px] border border-white/10 bg-gradient-to-b from-white/[0.035] to-transparent p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[2px] border border-teal-500/25 bg-teal-500/10">
                  <p.icon className="h-4 w-4 text-teal-300" />
                </div>
                <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Trial + price */}
        <section className="border-y border-white/[0.06] bg-[#080d16]">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 font-[family-name:var(--font-plex-mono)] text-[11px] font-bold uppercase tracking-[0.14em] text-teal-300">
                <Timer className="h-3.5 w-3.5" />
                Trial model
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] sm:text-3xl">
                Pick Unlimited or a Match Desk Pass before you start.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Card-upfront when billing is configured. Unlimited converts to
                £22/mo unless you cancel in the Customer Portal. Pass pays for
                credits at start and keeps them after the same 14-day / 3-desk
                trial.
              </p>
              <ul className="mt-5 space-y-2">
                {trialPoints.map((t) => (
                  <li
                    key={t}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[3px] border border-teal-500/35 bg-gradient-to-br from-teal-500/12 via-[#0b1220] to-[#0b1220] p-6 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="font-[family-name:var(--font-plex-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-teal-300">
                Choose at start
              </div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="rounded-[2px] border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="font-semibold text-teal-200">
                    Unlimited · £22/mo
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    14-day trial → converts unless cancelled
                  </div>
                </div>
                <div className="rounded-[2px] border border-white/10 bg-black/25 px-3 py-2.5">
                  <div className="font-semibold text-slate-100">
                    Match Desk Pass · £8 / £25 / £30
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    Same trial · keep credits after (not Unlimited)
                  </div>
                </div>
              </div>
              <Link
                href="/signup"
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[2px] bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300"
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

        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-[-0.025em]">
            Ready for the next kick-off?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Create your CoComms account, open a desk, and prep like you&apos;re
            already on air.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-[2px] bg-teal-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-300"
            >
              Start 14-day trial
            </Link>
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
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
