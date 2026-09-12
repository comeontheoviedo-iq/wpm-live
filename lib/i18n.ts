/**
 * Preferred-language / locale foundation (CoComms i18n scaffold).
 * Full catalogue later — preference + a few high-visibility strings for now.
 */

export const SUPPORTED_LOCALES = [
  { id: "en-GB", label: "English (UK)" },
  { id: "en-US", label: "English (US)" },
  { id: "tr-TR", label: "Türkçe" },
  { id: "fr-FR", label: "Français" },
  { id: "de-DE", label: "Deutsch" },
  { id: "es-ES", label: "Español" },
  { id: "pt-PT", label: "Português" },
  { id: "it-IT", label: "Italiano" },
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]["id"];

export const DEFAULT_LOCALE: AppLocale = "en-GB";

export function normalizeLocale(raw?: string | null): AppLocale {
  const v = (raw || "").trim();
  if (SUPPORTED_LOCALES.some((l) => l.id === v)) return v as AppLocale;
  const base = v.split("-")[0]?.toLowerCase();
  const hit = SUPPORTED_LOCALES.find((l) => l.id.toLowerCase().startsWith(`${base}-`));
  return hit?.id ?? DEFAULT_LOCALE;
}

type Dict = Record<string, string>;

const STRINGS: Record<AppLocale, Dict> = {
  "en-GB": {
    "header.commentaryDesk": "Commentary desk",
    "settings.preferredLanguage": "Preferred language",
    "settings.preferredLanguageHelp":
      "Saved on your account. Full UI translations come later — this sets the locale foundation.",
    "feed.syncLive": "Sync live feed",
    "feed.linked": "Live feed linked",
  },
  "en-US": {
    "header.commentaryDesk": "Commentary desk",
    "settings.preferredLanguage": "Preferred language",
    "settings.preferredLanguageHelp":
      "Saved on your account. Full UI translations come later — this sets the locale foundation.",
    "feed.syncLive": "Sync live feed",
    "feed.linked": "Live feed linked",
  },
  "tr-TR": {
    "header.commentaryDesk": "Yorumcu masası",
    "settings.preferredLanguage": "Tercih edilen dil",
    "settings.preferredLanguageHelp":
      "Hesabınıza kaydedilir. Tam arayüz çevirileri sonra gelecek — bu yerel dil temelidir.",
    "feed.syncLive": "Canlı veriyi senkronize et",
    "feed.linked": "Canlı veri bağlı",
  },
  "fr-FR": {
    "header.commentaryDesk": "Pupitre commentaire",
    "settings.preferredLanguage": "Langue préférée",
    "settings.preferredLanguageHelp":
      "Enregistré sur votre compte. Traductions UI complètes plus tard — fondation de locale.",
    "feed.syncLive": "Sync flux live",
    "feed.linked": "Flux live lié",
  },
  "de-DE": {
    "header.commentaryDesk": "Kommentarplatz",
    "settings.preferredLanguage": "Bevorzugte Sprache",
    "settings.preferredLanguageHelp":
      "Auf Ihrem Konto gespeichert. Volle UI-Übersetzungen folgen — Locale-Grundlage.",
    "feed.syncLive": "Live-Feed synchronisieren",
    "feed.linked": "Live-Feed verknüpft",
  },
  "es-ES": {
    "header.commentaryDesk": "Mesa de comentario",
    "settings.preferredLanguage": "Idioma preferido",
    "settings.preferredLanguageHelp":
      "Guardado en tu cuenta. Traducciones completas después — base de locale.",
    "feed.syncLive": "Sincronizar feed en vivo",
    "feed.linked": "Feed en vivo vinculado",
  },
  "pt-PT": {
    "header.commentaryDesk": "Mesa de comentário",
    "settings.preferredLanguage": "Idioma preferido",
    "settings.preferredLanguageHelp":
      "Guardado na sua conta. Traduções UI completas depois — base de locale.",
    "feed.syncLive": "Sincronizar feed ao vivo",
    "feed.linked": "Feed ao vivo ligado",
  },
  "it-IT": {
    "header.commentaryDesk": "Desk commento",
    "settings.preferredLanguage": "Lingua preferita",
    "settings.preferredLanguageHelp":
      "Salvato sul tuo account. Traduzioni UI complete dopo — base locale.",
    "feed.syncLive": "Sincronizza feed live",
    "feed.linked": "Feed live collegato",
  },
};

export function t(locale: string | null | undefined, key: string): string {
  const loc = normalizeLocale(locale);
  return STRINGS[loc]?.[key] || STRINGS[DEFAULT_LOCALE][key] || key;
}
