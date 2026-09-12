"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Mic2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-teal-700 via-emerald-700 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,#5eead4,transparent_40%),radial-gradient(circle_at_80%_60%,#34d399,transparent_35%)]" />
        <Logo href="/" />
        <div className="relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs mb-4 backdrop-blur">
            <Mic2 className="h-3.5 w-3.5" />
            Commentary desk
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Prep sharper. Call cleaner. Go live without the scramble.
          </h1>
          <p className="text-teal-50/90 text-sm leading-relaxed">
            CoComms is your matchday workspace — speaks, squad boards, injuries,
            venue intel, and a live event composer that stays out of your way.
          </p>
        </div>
        <p className="relative z-10 text-xs text-teal-100/70">
          Matchday workspace for broadcast commentary
        </p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Logo href="/" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Sign in
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Enter your CoComms credentials
          </p>
          <p className="text-sm text-slate-500 mb-4">
            New here?{" "}
            <a href="/signup" className="text-teal-600 font-medium hover:underline">
              Start a free trial
            </a>
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
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
              {pending ? "Signing in…" : "Enter desk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
