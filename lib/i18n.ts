/**
 * Preferred-language / locale foundation (CoComms i18n scaffold).
 * Preference list is broad (major world + football markets). Full UI
 * catalogue is still sparse — t() falls back to en-GB when a locale
 * has no STRINGS entry.
 */

/** BCP-47 ids accepted by preference / normalizeLocale. en-GB is default. */
export const LOCALE_IDS = [
  "en-GB",
  "en-US",
  "ar-SA",
  "bg-BG",
  "bn-BD",
  "ca-ES",
  "cs-CZ",
  "da-DK",
  "de-DE",
  "el-GR",
  "es-ES",
  "es-MX",
  "fa-IR",
  "fi-FI",
  "fr-FR",
  "he-IL",
  "hi-IN",
  "hr-HR",
  "hu-HU",
  "id-ID",
  "it-IT",
  "ja-JP",
  "ko-KR",
  "ms-MY",
  "nb-NO",
  "nl-NL",
  "pl-PL",
  "pt-BR",
  "pt-PT",
  "ro-RO",
  "ru-RU",
  "sk-SK",
  "sr-RS",
  "sv-SE",
  "sw-KE",
  "th-TH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "zh-CN",
  "zh-TW",
] as const;

export type AppLocale = (typeof LOCALE_IDS)[number];

export const DEFAULT_LOCALE: AppLocale = "en-GB";

/** Native / friendly label via Intl.DisplayNames (English gloss for search). */
export function localeDisplayLabel(id: string): string {
  const parts = id.split("-");
  const lang = parts[0] || id;
  const region = parts[1];
  try {
    const native = new Intl.DisplayNames([id], { type: "language" }).of(lang);
    const english = new Intl.DisplayNames(["en"], { type: "language" }).of(lang);
    let label = native || english || id;
    if (region) {
      const regionName =
        new Intl.DisplayNames(["en"], { type: "region" }).of(region) || region;
      // Distinguish regional variants (en-GB vs en-US, zh-CN vs zh-TW, etc.)
      if (lang === "en" || lang === "zh" || lang === "pt" || lang === "es") {
        label = `${english || native} (${regionName})`;
      } else if (native && english && native.toLowerCase() !== english.toLowerCase()) {
        label = `${native} · ${english}`;
      }
    } else if (native && english && native.toLowerCase() !== english.toLowerCase()) {
      label = `${native} · ${english}`;
    }
    return label;
  } catch {
    return id;
  }
}

export type LocaleOption = { id: AppLocale; label: string };

export const SUPPORTED_LOCALES: readonly LocaleOption[] = LOCALE_IDS.map((id) => ({
  id,
  label: localeDisplayLabel(id),
}));

const LOCALE_SET = new Set<string>(LOCALE_IDS);

export function normalizeLocale(raw?: string | null): AppLocale {
  const v = (raw || "").trim();
  if (LOCALE_SET.has(v)) return v as AppLocale;
  // Case-insensitive exact id
  const lower = v.toLowerCase();
  const exact = LOCALE_IDS.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  const base = lower.split("-")[0];
  if (!base) return DEFAULT_LOCALE;
  // Prefer default region for English
  if (base === "en") return "en-GB";
  if (base === "pt") return "pt-PT";
  if (base === "zh") return "zh-CN";
  if (base === "es") return "es-ES";
  if (base === "no" || base === "nn") return "nb-NO";
  const hit = LOCALE_IDS.find((id) => id.toLowerCase().startsWith(`${base}-`));
  return hit ?? DEFAULT_LOCALE;
}

type Dict = Record<string, string>;

/** Partial catalogue — missing locales fall back to en-GB in t(). */
const EN_GB: Dict = {
  "header.commentaryDesk": "Commentary desk",
  "settings.preferredLanguage": "Preferred language",
  "settings.preferredLanguageHelp":
    "Saved on your account. Full UI translations come later — this sets the locale foundation.",
  "settings.preferredLanguageSearch": "Search languages…",
  "settings.requestLanguage": "Request a new language",
  "settings.requestLanguageHelp":
    "Not on the list? Tell us the language (and optional note). We log requests for the translation backlog.",
  "settings.requestLanguageName": "Language name",
  "settings.requestLanguageNote": "Optional note",
  "settings.requestLanguageSubmit": "Submit request",
  "settings.requestLanguageThanks": "Thanks — request logged.",
  "feed.syncLive": "Sync live feed",
  "feed.linked": "Live feed linked",
};

const STRINGS: Partial<Record<AppLocale, Dict>> = {
  "en-GB": EN_GB,
  "en-US": {
    "header.commentaryDesk": "Commentary desk",
    "settings.preferredLanguage": "Preferred language",
    "settings.preferredLanguageHelp":
      "Saved on your account. Full UI translations come later — this sets the locale foundation.",
    "settings.preferredLanguageSearch": "Search languages…",
    "settings.requestLanguage": "Request a new language",
    "settings.requestLanguageHelp":
      "Not on the list? Tell us the language (and optional note). We log requests for the translation backlog.",
    "settings.requestLanguageName": "Language name",
    "settings.requestLanguageNote": "Optional note",
    "settings.requestLanguageSubmit": "Submit request",
    "settings.requestLanguageThanks": "Thanks — request logged.",
    "feed.syncLive": "Sync live feed",
    "feed.linked": "Live feed linked",
  },
  "tr-TR": {
    "header.commentaryDesk": "Yorumcu masası",
    "settings.preferredLanguage": "Tercih edilen dil",
    "settings.preferredLanguageHelp":
      "Hesabınıza kaydedilir. Tam arayüz çevirileri sonra gelecek — bu yerel dil temelidir.",
    "settings.preferredLanguageSearch": "Dil ara…",
    "feed.syncLive": "Canlı veriyi senkronize et",
    "feed.linked": "Canlı veri bağlı",
  },
  "fr-FR": {
    "header.commentaryDesk": "Pupitre commentaire",
    "settings.preferredLanguage": "Langue préférée",
    "settings.preferredLanguageHelp":
      "Enregistré sur votre compte. Traductions UI complètes plus tard — fondation de locale.",
    "settings.preferredLanguageSearch": "Rechercher une langue…",
    "feed.syncLive": "Sync flux live",
    "feed.linked": "Flux live lié",
  },
  "de-DE": {
    "header.commentaryDesk": "Kommentarplatz",
    "settings.preferredLanguage": "Bevorzugte Sprache",
    "settings.preferredLanguageHelp":
      "Auf Ihrem Konto gespeichert. Volle UI-Übersetzungen folgen — Locale-Grundlage.",
    "settings.preferredLanguageSearch": "Sprache suchen…",
    "feed.syncLive": "Live-Feed synchronisieren",
    "feed.linked": "Live-Feed verknüpft",
  },
  "es-ES": {
    "header.commentaryDesk": "Mesa de comentario",
    "settings.preferredLanguage": "Idioma preferido",
    "settings.preferredLanguageHelp":
      "Guardado en tu cuenta. Traducciones completas después — base de locale.",
    "settings.preferredLanguageSearch": "Buscar idioma…",
    "feed.syncLive": "Sincronizar feed en vivo",
    "feed.linked": "Feed en vivo vinculado",
  },
  "pt-PT": {
    "header.commentaryDesk": "Mesa de comentário",
    "settings.preferredLanguage": "Idioma preferido",
    "settings.preferredLanguageHelp":
      "Guardado na sua conta. Traduções UI completas depois — base de locale.",
    "settings.preferredLanguageSearch": "Pesquisar idioma…",
    "feed.syncLive": "Sincronizar feed ao vivo",
    "feed.linked": "Feed ao vivo ligado",
  },
  "it-IT": {
    "header.commentaryDesk": "Desk commento",
    "settings.preferredLanguage": "Lingua preferita",
    "settings.preferredLanguageHelp":
      "Salvato sul tuo account. Traduzioni UI complete dopo — base locale.",
    "settings.preferredLanguageSearch": "Cerca lingua…",
    "feed.syncLive": "Sincronizza feed live",
    "feed.linked": "Feed live collegato",
  },
};

export function t(locale: string | null | undefined, key: string): string {
  const loc = normalizeLocale(locale);
  return STRINGS[loc]?.[key] || EN_GB[key] || key;
}

/** Locales sorted for picker: English first, then A–Z by label. */
export function localesForPicker(): LocaleOption[] {
  const english = SUPPORTED_LOCALES.filter((l) => l.id.startsWith("en-"));
  const rest = SUPPORTED_LOCALES.filter((l) => !l.id.startsWith("en-")).slice().sort((a, b) =>
    a.label.localeCompare(b.label, "en")
  );
  return [...english, ...rest];
}
