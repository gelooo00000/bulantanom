"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "bulantanom_theme";
const DEFAULT_THEME: Theme = "dark";

/**
 * Applies a theme by swapping the two class pairs the stylesheet already
 * uses: `.dark`/`:root` for the shared token palette, and
 * `.landing-dark`/`.landing-light` for the landing/auth glass tokens.
 *
 * Both live on <html> so Base UI popovers, selects and dialogs — which
 * portal to document.body, outside any React tree — inherit the theme too.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("landing-dark", theme === "dark");
  root.classList.toggle("landing-light", theme === "light");
}

/**
 * Runs before first paint, inlined in <head>. Without it the document would
 * render with the default theme and visibly flash on hydration.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (t !== "light" && t !== "dark") t = ${JSON.stringify(DEFAULT_THEME)};
    var r = document.documentElement;
    r.classList.toggle("dark", t === "dark");
    r.classList.toggle("landing-dark", t === "dark");
    r.classList.toggle("landing-light", t === "light");
  } catch (e) {}
})();
`;

/*
 * The DOM is the source of truth: the inline script sets the classes on
 * <html> before paint, and this store just reads them back. Using an external
 * store rather than state-plus-effect means the correct theme is available on
 * the very first client render — no post-hydration correction, and no
 * setState inside an effect.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs of the same app in sync.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing with storage disabled: the theme still applies for
      // this session, it just will not survive a reload.
    }
    listeners.forEach((notify) => notify());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider.");
  return context;
}
