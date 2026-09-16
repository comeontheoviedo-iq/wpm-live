"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "Could not send reset email"));
        return;
      }
      setMessage(
        String(
          data.message ||
            "If an account exists for that email, we sent a password reset link."
        )
      );
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-[var(--background)]">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <Logo href="/" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          Forgot password
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter your email and we&apos;ll send a reset link if an account exists.
          Passwords are hashed — we cannot resend your old one.
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
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 rounded-lg px-3 py-2">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/login" className="text-teal-600 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
