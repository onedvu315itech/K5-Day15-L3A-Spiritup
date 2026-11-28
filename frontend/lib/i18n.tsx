"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

export type Locale = "vi" | "en";

const LOCALE_STORAGE_KEY = "partaway:v1:locale";
const emptySubscribe = () => () => {};

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
  t: (vi: string, en: string) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "vi",
  setLocale: () => {},
  toggleLocale: () => {},
  t: (vi) => vi,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [overrideLocale, setOverrideLocale] = useState<Locale | null>(null);

  const storedLocale: Locale = (() => {
    if (!isClient) return "vi";
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      return saved === "en" ? "en" : "vi";
    } catch {
      return "vi";
    }
  })();

  const locale: Locale = overrideLocale ?? storedLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setOverrideLocale(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === "vi" ? "en" : "vi");
  }, [locale, setLocale]);

  const t = useCallback(
    (vi: string, en: string) => (locale === "en" ? en : vi),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
