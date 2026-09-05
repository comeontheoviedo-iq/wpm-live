import { nationalityToIso } from "./flags";

/** Map nationality / ISO → BCP-47 lang hint for speechSynthesis. */
const ISO_TO_LANG: Record<string, string> = {
  hr: "hr-HR",
  gb: "en-GB",
  "gb-eng": "en-GB",
  "gb-sct": "en-GB",
  "gb-wls": "en-GB",
  "gb-nir": "en-GB",
  ie: "en-IE",
  us: "en-US",
  au: "en-AU",
  nz: "en-NZ",
  ca: "en-CA",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  br: "pt-BR",
  nl: "nl-NL",
  be: "nl-BE",
  pl: "pl-PL",
  dk: "da-DK",
  se: "sv-SE",
  no: "nb-NO",
  fi: "fi-FI",
  cz: "cs-CZ",
  sk: "sk-SK",
  si: "sl-SI",
  rs: "sr-RS",
  ba: "bs-BA",
  hu: "hu-HU",
  ro: "ro-RO",
  bg: "bg-BG",
  gr: "el-GR",
  tr: "tr-TR",
  ru: "ru-RU",
  ua: "uk-UA",
  ar: "es-AR",
  mx: "es-MX",
  jp: "ja-JP",
  kr: "ko-KR",
  cn: "zh-CN",
  ng: "en-NG",
  gh: "en-GH",
  sn: "fr-SN",
  ci: "fr-FR",
  ma: "fr-FR",
  dz: "fr-FR",
  cm: "fr-FR",
  zw: "en-GB",
  za: "en-ZA",
  jm: "en-JM",
  al: "sq-AL",
  mk: "mk-MK",
  ge: "ka-GE",
  il: "he-IL",
  ir: "fa-IR",
};

export function speechLangFromNationality(
  nationality?: string | null
): string {
  const iso = nationalityToIso(nationality);
  if (iso && ISO_TO_LANG[iso]) return ISO_TO_LANG[iso];
  if (iso && ISO_TO_LANG[iso.split("-")[0]]) return ISO_TO_LANG[iso.split("-")[0]];
  return "en-GB";
}

export function speakPronunciation(
  text: string,
  langHint?: string | null
): boolean {
  if (typeof window === "undefined") return false;
  const t = text.trim();
  if (!t || !window.speechSynthesis) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = langHint || "en-GB";
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
