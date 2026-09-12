"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Mic2, Check } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      // If billing is configured, nudge toward card-upfront checkout after register
      if (data.trial?.stripeConfigured) {
        try {
          const checkout = await fetch("/api/billing/checkout", { method: "POST" });
          const cj = await checkout.json().catch(() => ({}));
          if (checkout.ok && cj.url) {
            window.location.href = String(cj.url);
            return;
          }
        } catch {
          /* fall through to desk */
        }
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#070b12]">
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-[#0a1524] via-teal-950 to-[#070b12] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,#2dd4bf55,transparent_40%),radial-gradient(circle_at_80%_70%,#f43f5e33,transparent_35%)]" />
        <Logo href="/" />
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs mb-4 backdrop-blur">
            <Mic2 className="h-3.5 w-3.5" />
            14-day trial · 3 match desks
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Open your CoComms desk
          </h1>
          <p className="text-teal-50/80 text-sm leading-relaxed mb-6">
            Trial converts to Unlimited £22/mo unless you cancel in Settings.
            Card-upfront when billing is live; app-side trial until then.
          </p>
          <ul className="space-y-2 text-sm text-teal-50/90">
            {[
              "BYO Notebook + live feed sync",
              "Speaks, pitch board, dossiers, OBS",
              "Cancel before conversion — no surprise charge path",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="h-4 w-4 text-teal-300 shrink-0 mt-0.5" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-teal-100/50">
          Commentary prep & live desk
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10 bg-[var(--background)] text-[var(--foreground)]">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo href="/" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Start your trial</h2>
          <p className="text-sm text-slate-500 mb-6">
            14 days · 3 match desks · then £22/mo Unlimited unless cancelled
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-300">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="Your name"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-300">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-300">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </label>
            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? "Creating account…" : "Start 14-day trial"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-600 font-medium hover:underline">
              Sign in
            </Link>
          </p>
          <p className="mt-2 text-xs text-slate-500">
            <Link href="/" className="hover:underline">
              ← Back to CoComms
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
