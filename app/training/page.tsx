import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import {
  ArrowRight,
  Clapperboard,
  GraduationCap,
  NotebookPen,
  Check,
} from "lucide-react";

const steps = [
  {
    n: "1",
    title: "Signup",
    body: "Create your CoComms account and pick Unlimited or a Match Desk Pass at the start.",
  },
  {
    n: "2",
    title: "Pick plan",
    body: "Card-upfront when billing is live. Unlimited → £22/mo after trial unless cancelled. Pass keeps credits after the same 14-day / 3-desk trial.",
  },
  {
    n: "3",
    title: "Create a desk",
    body: "Open Dashboard and create a match desk for your fixture (trial cap: 3 desks).",
  },
  {
    n: "4",
    title: "Paste your match prep",
    body: "Bring your notes. We file them where you need them — CoComms sorts prep into Notes, Scripts, and profiles.",
  },
  {
    n: "5",
    title: "Organise",
    body: "Sort buckets, pin hooks, and tidy Scripts so you are not scrambling when the board goes up.",
  },
  {
    n: "6",
    title: "Matchday desk",
    body: "Go live with pitch board, event composer, dossiers, and overlays — ready for the broadcast call.",
  },
];

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <div className="border-b border-white/10 bg-[#0b1220]">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
            Training desk · CoComms
          </span>
          <span className="hidden sm:inline text-slate-500">Quick-start</span>
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

      <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <div className="mb-10 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[11px] font-medium text-teal-200">
            <GraduationCap className="h-3.5 w-3.5" />
            Self-serve training
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Training hub</h1>
          <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
            Watch the Matchday Cut or the How-to below, then follow the written quick-start — Signup → plan → desk →
            paste prep → organise → matchday.
          </p>
        </div>

        <section className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400/90 mb-4">
            Videos
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#05080f] aspect-video">
                <video
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                >
                  <source
                    src="/videos/cocomms-matchday-demo.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
              <h3 className="mt-4 font-semibold flex items-center gap-2">
                <Clapperboard className="h-4 w-4 text-teal-300" />
                Demo video — Matchday Cut
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                ~45s co-pilot cut — notes, live feed, lineups, desk.
              </p>
              <span className="mt-3 inline-block rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                Live
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#05080f] aspect-video">
                <video
                  className="h-full w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                >
                  <source
                    src="/videos/cocomms-howto.mp4"
                    type="video/mp4"
                  />
                </video>
              </div>
              <h3 className="mt-4 font-semibold flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-teal-300" />
                How-to video
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                ~60s — signup, desk, Research dump, Notes/Scripts, live basics.
              </p>
              <span className="mt-3 inline-block rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                Live
              </span>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-teal-400/90 mb-4">
            Written quick-start
          </p>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li
                key={s.n}
                className="flex gap-4 rounded-2xl border border-white/10 bg-[#0d1524]/80 px-4 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-sm font-bold text-teal-300 border border-teal-500/30">
                  {s.n}
                </span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-slate-400 leading-relaxed">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-500">
            {[
              "Trial: 14 days · 3 desks · card-upfront",
              "Cancel anytime from Settings / Customer Portal",
              "Bring your notes — CoComms files them where you need them",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0a1220] p-6">
          <h2 className="font-semibold">Helpful links</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href="/faq"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:border-teal-500/40 hover:text-teal-200"
            >
              FAQ
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:border-teal-500/40 hover:text-teal-200"
            >
              Pricing
            </Link>
            <Link
              href="/settings"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:border-teal-500/40 hover:text-teal-200"
            >
              Settings · billing
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-400 px-3 py-2 font-semibold text-slate-950 hover:bg-teal-300"
            >
              Start trial
              <ArrowRight className="h-4 w-4" />
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
            <Link href="/training" className="hover:text-slate-300">
              Training
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
