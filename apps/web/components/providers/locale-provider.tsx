"use client";

import { NextIntlClientProvider } from "next-intl";
import { createContext, useContext, useEffect, useState } from "react";
import frMessages from "../../messages/fr.json";
import enMessages from "../../messages/en.json";
import { useUserPrefs, useUpdatePrefs } from "@a2e/core";
import { coreFlags } from "@/lib/core-flags";

type Locale = "fr" | "en";

const allMessages: Record<Locale, any> = { fr: frMessages, en: enMessages };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "fr",
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const corePrefs = useUserPrefs();
  const coreUpdatePrefs = useUpdatePrefs();

  // Restore saved locale on mount (client only).
  // When the core prefs flag is ON, prefer the core locale over localStorage.
  useEffect(() => {
    if (coreFlags.prefs && corePrefs?.locale) {
      const saved = corePrefs.locale as Locale;
      if (saved === "en" || saved === "fr") {
        setLocaleState(saved);
        localStorage.setItem("locale", saved);
        return;
      }
    }
    const saved = localStorage.getItem("locale");
    if (saved === "en" || saved === "fr") {
      setLocaleState(saved);
    }
  }, [corePrefs?.locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
    // Sync to core (cross-app) when the flag is ON
    if (coreFlags.prefs) {
      coreUpdatePrefs({ locale: l }).catch(() => {});
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={allMessages[locale]} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
