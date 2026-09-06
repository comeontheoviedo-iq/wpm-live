"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "pitchline-theme";
const BROADCAST_MIGRATE_KEY = "pitchline-broadcast-dark-v1";

const ThemeCtx = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}>({ theme: "dark", setTheme: () => {}, resolved: "dark" });

function applyDom(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  const apply = useCallback((t: Theme) => {
    // Explicit light only when user toggles light; system/dark → dark desk.
    const isDark = t !== "light";
    applyDom(isDark);
    setResolved(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    // One-time migrate: prior light/system defaults left the desk looking SaaS-light.
    if (!localStorage.getItem(BROADCAST_MIGRATE_KEY)) {
      localStorage.setItem(BROADCAST_MIGRATE_KEY, "1");
      localStorage.setItem(STORAGE_KEY, "dark");
    }
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
    const initial: Theme = saved === "light" ? "light" : "dark";
    setThemeState(initial);
    apply(initial);
  }, [apply]);

  const setTheme = (t: Theme) => {
    const next: Theme = t === "system" ? "dark" : t;
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  };

  return (
    <ThemeCtx.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}
