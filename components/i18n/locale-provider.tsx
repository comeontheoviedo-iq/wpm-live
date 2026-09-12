"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  t as translate,
  type AppLocale,
} from "@/lib/i18n";

const STORAGE_KEY = "cocomms-preferred-locale";

type Ctx = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  t: (key: string) => string;
  ready: boolean;
};

const LocaleCtx = createContext<Ctx>({
  locale: DEFAULT_LOCALE,
  setLocale: async () => undefined,
  t: (key) => translate(DEFAULT_LOCALE, key),
  ready: false,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = normalizeLocale(
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    );
    setLocaleState(cached);
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j?.user?.preferredLocale) return;
        const next = normalizeLocale(j.user.preferredLocale);
        setLocaleState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback(async (nextRaw: AppLocale) => {
    const next = normalizeLocale(nextRaw);
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: next }),
      });
    } catch {
      /* offline / unauth — local preference still applied */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      t: (key: string) => translate(locale, key),
      ready,
    }),
    [locale, setLocale, ready]
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale() {
  return useContext(LocaleCtx);
}
