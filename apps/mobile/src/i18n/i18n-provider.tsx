import * as Localization from "expo-localization";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { configureFormat } from "@/src/lib/format";
import { storage } from "@/src/utils/storage";
import { dictionaries, LANGUAGES, type LanguageId, type Locale, type TranslationKey } from "./translations";

const KEY = "bureau.i18n.language";

/** Bureau ships in French; the device language only wins when the user picks "System". */
const DEFAULT_LANGUAGE: LanguageId = "fr";

const INTL_TAG: Record<Locale, string> = { fr: "fr-FR", en: "en-US", es: "es-ES" };

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

type I18nValue = {
  language: LanguageId;
  locale: Locale;
  setLanguage: (id: LanguageId) => void;
  t: Translate;
};

const I18nContext = createContext<I18nValue | null>(null);

function deviceLocale(): Locale {
  const code = Localization.getLocales()[0]?.languageCode ?? "fr";
  return code === "en" || code === "es" ? code : "fr";
}

function resolve(id: LanguageId): Locale {
  return id === "system" ? deviceLocale() : id;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageId>(DEFAULT_LANGUAGE);

  useEffect(() => {
    let alive = true;
    void storage.getItem<string>(KEY, "").then((stored) => {
      if (!alive) return;
      if (LANGUAGES.some((l) => l.id === stored)) setLanguageState(stored as LanguageId);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setLanguage = useCallback((id: LanguageId) => {
    setLanguageState(id);
    void storage.setItem(KEY, id);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const locale = resolve(language);
    const dict = dictionaries[locale];
    const fallback = dictionaries.en;

    const t: Translate = (key, vars) => {
      let out = dict[key] ?? fallback[key] ?? String(key);
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${name}\\}`, "g"), String(replacement));
        }
      }
      return out;
    };

    return { language, locale, setLanguage, t };
  }, [language, setLanguage]);

  // Keep the date/relative helpers in sync with the active locale.
  useEffect(() => {
    configureFormat(INTL_TAG[value.locale], (key) => value.t(key as TranslationKey));
  }, [value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Sugar for the common case: `const t = useT();` */
export function useT(): Translate {
  return useI18n().t;
}

export { LANGUAGES };
export type { LanguageId, Locale };
