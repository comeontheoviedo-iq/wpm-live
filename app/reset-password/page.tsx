"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      setPending(false);
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match");
      setPending(false);
      return;
    }
    if (!token) {
      setError("Missing reset token — open the link from your email");
      setPending(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(data.error || "Could not reset password"));
        return;
      }
      setMessage("Password updated. You can sign in now.");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1200);
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8">
        <Logo href="/" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
        Choose a new password
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Enter a new password for your CoComms account. Link expires in 1 hour.
      </p>
      {!token && (
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
          No reset token in this link. Request a new one from{" "}
          <Link href="/forgot-password" className="underline font-medium">
            Forgot password
          </Link>
          .
        </p>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pending || !token}
        >
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-slate-500">
        <Link href="/login" className="text-teal-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 sm:p-10 bg-[var(--background)]">
      <Suspense
        fallback={
          <p className="text-sm text-slate-500">Loading reset form…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
