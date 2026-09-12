/**
 * Match-scoped News: curated RSS (league-aware) + Gemini grounded web brief.
 * RSS-first by default (tight per-feed timeouts); Gemini brief optional / background.
 * Soft-fail per feed; ~7 min cache with stale-while-revalidate. Never invent headlines.
 */

import { generateWithGemini, isGeminiConfigured } from "@/lib/gemini";
import { canUseGeminiBrief, getEffectivePlan, hasIntel } from "@/lib/plan";
import { namesLooselyMatch, normalizePlayerKey } from "@/lib/player-name";
import { decodeHtmlEntities } from "@/lib/utils";

export type NewsScope = "all" | "home" | "away" | "league" | "players";

export type NewsRegion = "global" | "en" | "es" | "it" | "de" | "fr" | "tr" | "club";

export type NewsEntityBadge = {
  kind: "club" | "player" | "league";
  id: string;
  label: string;
  side?: "home" | "away";
};

export type NewsItem = {
  id: string;
  headline: string;
  sourceName: string;
  publishedAt: string | null;
  url: string | null;
  snippet: string | null;
  provenance: "rss" | "web_brief";
  feedKey?: string;
  region: NewsRegion;
  lang: string;
  entities: NewsEntityBadge[];
  scopes: NewsScope[];
};

export type NewsFeedStatus = {
  key: string;
  label: string;
  region: NewsRegion;
  lang: string;
  ok: boolean;
  count: number;
  mode: "rss" | "web_brief" | "skipped";
  error?: string;
};

export type NewsMatchContext = {
  matchId: string;
  competition: string;
  homeClub: { id: string; name: string; shortName: string };
  awayClub: { id: string; name: string; shortName: string };
  players: {
    id: string;
    name: string;
    side: "home" | "away";
    isStarter?: boolean;
  }[];
};

export type NewsPayload = {
  matchId: string;
  fetchedAt: string;
  cached: boolean;
  /** True when serving an expired cache entry while a refresh runs in the background */
  stale?: boolean;
  cacheTtlMs: number;
  items: NewsItem[];
  feeds: NewsFeedStatus[];
  gemini: { configured: boolean; used: boolean; grounded?: boolean; error?: string; pending?: boolean; available?: boolean; plan?: string };
  /** False when response is RSS-only (brief not requested / not yet merged) */
  briefIncluded: boolean;
  warnings: string[];
  regionsActive: NewsRegion[];
};

const CACHE_TTL_MS = 7 * 60_000;
/** Per-feed RSS abort — keep first paint snappy even if a source hangs */
const RSS_TIMEOUT_MS = 2_500;

type CacheEntry = { at: number; payload: NewsPayload };
const cache = new Map<string, CacheEntry>();
/** In-flight revalidations keyed by matchId (+brief flag) to avoid stampedes */
const revalidating = new Map<string, Promise<void>>();

type LeagueBucket = "pl" | "la_liga" | "serie_a" | "bundesliga" | "ligue1" | "super_lig" | "scotland" | "other";

type FeedDef = {
  key: string;
  label: string;
  /** Working RSS URL when known; omit for web-brief-only sources */
  rssUrl?: string;
  region: NewsRegion;
  lang: string;
  /** Competition buckets this feed is primary for */
  leagues: LeagueBucket[];
  /** Always fetch (BBC / Guardian) */
  always?: boolean;
  /** Domain hint for Gemini when RSS missing or as supplement */
  domain?: string;
  /** Prefer Gemini domain filter instead of / as well as RSS */
  webBrief?: boolean;
};

/**
 * Curated catalogue — only fetchable RSS or explicit web-brief domains.
 * footystats / whoscored intentionally omitted (stats, not headlines).
 * adamchoi skipped (stats/betting, not news-like RSS).
 */
const FEED_CATALOGUE: FeedDef[] = [
  // Always-on global football
  {
    key: "bbc_football",
    label: "BBC Sport Football",
    rssUrl: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    region: "global",
    lang: "en",
    leagues: [],
    always: true,
    domain: "bbc.co.uk",
  },
  {
    key: "guardian_football",
    label: "The Guardian Football",
    rssUrl: "https://www.theguardian.com/football/rss",
    region: "global",
    lang: "en",
    leagues: [],
    always: true,
    domain: "theguardian.com",
  },
  // EN extras
  {
    key: "sky_sports_football",
    label: "Sky Sports Football",
    rssUrl: "https://www.skysports.com/rss/12040",
    region: "en",
    lang: "en",
    leagues: ["pl", "scotland"],
    domain: "skysports.com",
  },
  {
    key: "espn_fc",
    label: "ESPN FC",
    rssUrl: "https://www.espn.com/espn/rss/soccer/news",
    region: "en",
    lang: "en",
    leagues: ["pl", "la_liga", "serie_a", "bundesliga", "ligue1"],
    domain: "espn.com",
  },
  {
    key: "goal_com",
    label: "Goal.com",
    region: "en",
    lang: "en",
    leagues: ["pl", "la_liga", "serie_a", "bundesliga", "ligue1", "super_lig"],
    domain: "goal.com",
    webBrief: true,
  },
  // Spain
  {
    key: "gfn_spain",
    label: "Get Football News Spain",
    rssUrl: "https://www.getfootballnewsspain.com/feed/",
    region: "es",
    lang: "en",
    leagues: ["la_liga"],
    domain: "getfootballnewsspain.com",
  },
  {
    key: "as_primera",
    label: "AS Primera",
    rssUrl: "https://as.com/rss/futbol/primera.xml",
    region: "es",
    lang: "es",
    leagues: ["la_liga"],
    domain: "as.com",
  },
  {
    key: "marca_primera",
    label: "Marca Primera",
    rssUrl: "https://e00-marca.uecdn.es/rss/futbol/primera-division.xml",
    region: "es",
    lang: "es",
    leagues: ["la_liga"],
    domain: "marca.com",
  },
  {
    key: "mundo_deportivo",
    label: "Mundo Deportivo",
    rssUrl: "https://www.mundodeportivo.com/rss/futbol",
    region: "es",
    lang: "es",
    leagues: ["la_liga"],
    domain: "mundodeportivo.com",
  },
  // Italy
  {
    key: "gfn_italy",
    label: "Get Football News Italy",
    rssUrl: "https://www.getfootballnewsitaly.com/feed/",
    region: "it",
    lang: "en",
    leagues: ["serie_a"],
    domain: "getfootballnewsitaly.com",
  },
  {
    key: "football_italia",
    label: "Football Italia",
    rssUrl: "https://www.football-italia.net/feed/",
    region: "it",
    lang: "en",
    leagues: ["serie_a"],
    domain: "football-italia.net",
  },
  {
    key: "corriere_sport",
    label: "Corriere dello Sport",
    rssUrl: "https://www.corrieredellosport.it/rss/calcio",
    region: "it",
    lang: "it",
    leagues: ["serie_a"],
    domain: "corrieredellosport.it",
  },
  {
    key: "gazzetta",
    label: "Gazzetta dello Sport",
    rssUrl: "https://www.gazzetta.it/dynamic-feed/rss/section/Calcio.xml",
    region: "it",
    lang: "it",
    leagues: ["serie_a"],
    domain: "gazzetta.it",
  },
  {
    key: "serie_a_official",
    label: "Serie A News",
    region: "it",
    lang: "en",
    leagues: ["serie_a"],
    domain: "legaseriea.it",
    webBrief: true,
  },
  // Germany
  {
    key: "bulinews",
    label: "BuLiNews",
    rssUrl: "https://bulinews.com/feed/",
    region: "de",
    lang: "en",
    leagues: ["bundesliga"],
    domain: "bulinews.com",
  },
  {
    key: "gfn_germany",
    label: "Get Football News Germany",
    rssUrl: "https://www.getfootballnewsgermany.com/feed/",
    region: "de",
    lang: "en",
    leagues: ["bundesliga"],
    domain: "getfootballnewsgermany.com",
  },
  {
    key: "bundesliga_official",
    label: "Bundesliga.com",
    region: "de",
    lang: "en",
    leagues: ["bundesliga"],
    domain: "bundesliga.com",
    webBrief: true,
  },
  // France
  {
    key: "gfn_france",
    label: "Get Football News France",
    rssUrl: "https://www.getfootballnewsfrance.com/feed/",
    region: "fr",
    lang: "en",
    leagues: ["ligue1"],
    domain: "getfootballnewsfrance.com",
  },
  {
    key: "ligue1_official",
    label: "Ligue 1",
    region: "fr",
    lang: "en",
    leagues: ["ligue1"],
    domain: "ligue1.com",
    webBrief: true,
  },
  {
    key: "lequipe",
    label: "L'Équipe",
    region: "fr",
    lang: "fr",
    leagues: ["ligue1"],
    domain: "lequipe.fr",
    webBrief: true,
  },
  // Turkey
  {
    key: "turkish_football",
    label: "Turkish Football",
    rssUrl: "https://turkish-football.com/feed/",
    region: "tr",
    lang: "en",
    leagues: ["super_lig"],
    domain: "turkish-football.com",
  },
];

const REGION_ORDER: NewsRegion[] = ["global", "en", "es", "it", "de", "fr", "tr", "club"];

const REGION_LABELS: Record<NewsRegion, string> = {
  global: "Global",
  en: "England / UK",
  es: "Spain",
  it: "Italy",
  de: "Germany",
  fr: "France",
  tr: "Turkey",
  club: "Club",
};

export function newsRegionLabel(region: NewsRegion): string {
  return REGION_LABELS[region] || region;
}

export function competitionBucket(competition: string): LeagueBucket {
  const c = competition.toLowerCase();
  if (/premier\s*league|epl/.test(c)) return "pl";
  if (/la\s*liga|laliga/.test(c)) return "la_liga";
  if (/serie\s*a/.test(c)) return "serie_a";
  if (/bundesliga/.test(c)) return "bundesliga";
  if (/ligue\s*1/.test(c)) return "ligue1";
  if (/s[uü]per\s*lig|superlig|turkish/.test(c)) return "super_lig";
  if (/scottish|premiership/.test(c)) return "scotland";
  return "other";
}

function feedsForCompetition(competition: string): FeedDef[] {
  const bucket = competitionBucket(competition);
  const selected: FeedDef[] = [];
  const seen = new Set<string>();
  for (const f of FEED_CATALOGUE) {
    const hit =
      f.always ||
      f.leagues.includes(bucket) ||
      // light EN extras for unknown comps
      (bucket === "other" && (f.key === "espn_fc" || f.key === "sky_sports_football"));
    if (!hit) continue;
    if (seen.has(f.key)) continue;
    seen.add(f.key);
    selected.push(f);
  }
  return selected;
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(s: string): string {
  return decodeHtmlEntities(s);
}

function tagContent(block: string, tag: string): string | null {
  const cdata = block.match(
    new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i")
  );
  if (cdata) return decodeXmlEntities(cdata[1].trim());
  const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (plain) return stripTags(plain[1]);
  return null;
}

function parseRssItems(xml: string): {
  title: string;
  link: string | null;
  pubDate: string | null;
  description: string | null;
}[] {
  const items: {
    title: string;
    link: string | null;
    pubDate: string | null;
    description: string | null;
  }[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml))) {
    const block = m[1];
    const title = tagContent(block, "title");
    if (!title) continue;
    let link = tagContent(block, "link");
    if (!link) {
      const guid = tagContent(block, "guid");
      if (guid && /^https?:\/\//i.test(guid)) link = guid;
    }
    const pubDate = tagContent(block, "pubDate") || tagContent(block, "dc:date");
    const description =
      tagContent(block, "description") || tagContent(block, "content:encoded");
    items.push({
      title,
      link: link || null,
      pubDate: pubDate || null,
      description: description ? description.slice(0, 400) : null,
    });
  }
  return items;
}

function looksLikeRss(body: string): boolean {
  const head = body.slice(0, 800).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<item");
}

async function fetchRssFeed(
  feed: FeedDef
): Promise<{ items: ReturnType<typeof parseRssItems>; status: NewsFeedStatus }> {
  if (!feed.rssUrl) {
    return {
      items: [],
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: false,
        count: 0,
        mode: "skipped",
        error: "No RSS URL",
      },
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RSS_TIMEOUT_MS);
  try {
    const res = await fetch(feed.rssUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "PitchlineNews/1.0 (match desk)",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        items: [],
        status: {
          key: feed.key,
          label: feed.label,
          region: feed.region,
          lang: feed.lang,
          ok: false,
          count: 0,
          mode: "rss",
          error: `HTTP ${res.status}`,
        },
      };
    }
    const xml = await res.text();
    if (!looksLikeRss(xml)) {
      return {
        items: [],
        status: {
          key: feed.key,
          label: feed.label,
          region: feed.region,
          lang: feed.lang,
          ok: false,
          count: 0,
          mode: "rss",
          error: "Not RSS",
        },
      };
    }
    const items = parseRssItems(xml);
    return {
      items,
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: true,
        count: items.length,
        mode: "rss",
      },
    };
  } catch (e) {
    const aborted =
      (e instanceof Error && e.name === "AbortError") ||
      String(e).toLowerCase().includes("abort");
    return {
      items: [],
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: false,
        count: 0,
        mode: "rss",
        error: aborted
          ? "Timeout"
          : e instanceof Error
            ? e.message.slice(0, 120)
            : "Fetch failed",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function clubAliases(name: string, shortName: string): string[] {
  const out = new Set<string>();
  for (const n of [name, shortName]) {
    const t = n.trim();
    if (!t) continue;
    out.add(t);
    const stripped = t
      .replace(/\b(FC|AFC|CF|SK|FK|AS|AC|SC|United|City|Town|Spor)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.length >= 3) out.add(stripped);
  }
  const ascii = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I");
  if (ascii !== name) out.add(ascii);
  // Common nicknames
  const lower = name.toLowerCase();
  if (lower.includes("fenerbah")) out.add("Fenerbahce");
  if (lower.includes("beşiktaş") || lower.includes("besiktas")) out.add("Besiktas");
  if (lower.includes("newcastle")) out.add("Magpies");
  return [...out];
}

function textMentions(haystack: string, needles: string[]): boolean {
  const h = normalizePlayerKey(haystack);
  if (!h) return false;
  for (const n of needles) {
    const key = normalizePlayerKey(n);
    if (key.length >= 4 && h.includes(key)) return true;
    if (key.length >= 3 && new RegExp(`\\b${key}\\b`, "i").test(h)) return true;
  }
  return false;
}

function tagEntities(
  headline: string,
  snippet: string | null,
  ctx: NewsMatchContext
): { entities: NewsEntityBadge[]; scopes: NewsScope[] } {
  const text = `${headline} ${snippet || ""}`;
  const entities: NewsEntityBadge[] = [];
  const scopes = new Set<NewsScope>(["all"]);

  const homeAliases = clubAliases(ctx.homeClub.name, ctx.homeClub.shortName);
  const awayAliases = clubAliases(ctx.awayClub.name, ctx.awayClub.shortName);

  if (textMentions(text, homeAliases)) {
    entities.push({
      kind: "club",
      id: ctx.homeClub.id,
      label: ctx.homeClub.shortName || ctx.homeClub.name,
      side: "home",
    });
    scopes.add("home");
  }
  if (textMentions(text, awayAliases)) {
    entities.push({
      kind: "club",
      id: ctx.awayClub.id,
      label: ctx.awayClub.shortName || ctx.awayClub.name,
      side: "away",
    });
    scopes.add("away");
  }

  const comp = ctx.competition?.trim();
  if (comp && textMentions(text, [comp])) {
    entities.push({ kind: "league", id: "league", label: comp });
    scopes.add("league");
  }

  const starters = ctx.players.filter((p) => p.isStarter);
  const pool = starters.length ? starters : ctx.players;
  for (const p of pool) {
    if (!p.name || p.name.length < 3) continue;
    const last = p.name.split(/\s+/).filter(Boolean).pop() || "";
    const hit =
      namesLooselyMatch(headline, p.name) ||
      (last.length >= 4 && normalizePlayerKey(text).includes(normalizePlayerKey(last)));
    if (!hit) continue;
    if (homeAliases.some((a) => namesLooselyMatch(a, p.name))) continue;
    if (awayAliases.some((a) => namesLooselyMatch(a, p.name))) continue;
    entities.push({
      kind: "player",
      id: p.id,
      label: p.name,
      side: p.side,
    });
    scopes.add("players");
    scopes.add(p.side);
  }

  return { entities, scopes: [...scopes] };
}

function itemId(provenance: string, url: string | null, headline: string): string {
  const base = (url || headline).toLowerCase().replace(/\s+/g, " ").slice(0, 160);
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) | 0;
  return `${provenance}_${Math.abs(hash).toString(36)}`;
}

function normalizeTitleKey(title: string): string {
  return normalizePlayerKey(title)
    .replace(/\b(the|a|an|vs|v)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeItems(items: NewsItem[]): NewsItem[] {
  const byUrl = new Set<string>();
  const byTitle = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of items) {
    if (it.url) {
      const u = it.url.replace(/\/$/, "").toLowerCase();
      if (byUrl.has(u)) continue;
      byUrl.add(u);
    }
    const tk = normalizeTitleKey(it.headline);
    if (tk.length >= 12 && byTitle.has(tk)) continue;
    if (tk.length >= 12) byTitle.add(tk);
    out.push(it);
  }
  return out;
}

function parseIsoOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T12:00:00.000Z`
    : trimmed;
  const d = new Date(dayOnly);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\[\s*citation[^\]]*\]/gi, "")
    .replace(/\[\d+\]/g, "")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();

  const tryParse = (raw: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { headlines?: unknown }).headlines)
      ) {
        return (parsed as { headlines: unknown[] }).headlines;
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    const fromObj = tryParse(cleaned.slice(objStart, objEnd + 1));
    if (fromObj) return fromObj;
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start >= 0 && end > start) {
    const fromArr = tryParse(cleaned.slice(start, end + 1));
    if (fromArr) return fromArr;
  }
  return null;
}

function mapBriefItems(
  arr: unknown[],
  ctx: NewsMatchContext,
  meta: { region: NewsRegion; lang: string; sourceFallback: string; feedKey?: string }
): NewsItem[] {
  const items: NewsItem[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const headline = String(row.headline || row.title || "").trim();
    if (!headline || headline.length < 8) continue;
    const urlRaw = row.url != null ? String(row.url).trim() : "";
    const url = /^https?:\/\//i.test(urlRaw) ? urlRaw : null;
    const sourceName =
      String(row.sourceName || row.source || meta.sourceFallback).trim() ||
      meta.sourceFallback;
    const snippetRaw = row.snippet != null ? String(row.snippet).trim() : "";
    const { entities, scopes } = tagEntities(headline, snippetRaw || null, ctx);
    items.push({
      id: itemId("web_brief", url, headline),
      headline,
      sourceName,
      publishedAt: parseIsoOrNull(
        row.publishedAt != null ? String(row.publishedAt) : null
      ),
      url,
      snippet: snippetRaw ? snippetRaw.slice(0, 400) : null,
      provenance: "web_brief",
      feedKey: meta.feedKey,
      region: meta.region,
      lang: meta.lang,
      entities,
      scopes,
    });
  }
  return items;
}

async function fetchGeminiMatchBrief(
  ctx: NewsMatchContext
): Promise<{ items: NewsItem[]; grounded: boolean; error?: string }> {
  if (!canUseGeminiBrief()) {
    if (!hasIntel()) {
      return { items: [], grounded: false, error: "Intel add-on required for Gemini web brief" };
    }
    return { items: [], grounded: false, error: "GEMINI_API_KEY not set" };
  }

  const systemPrompt = [
    "You are a football news briefing assistant for live match commentators.",
    "Return ONLY factual recent headlines grounded in web search results.",
    "Never invent stories, quotes, scores, or URLs.",
    "If search does not provide a URL, set url to null.",
    'Respond with a single JSON object only (no markdown). Shape: {"headlines":[{"headline":"...","url":null,"sourceName":"...","publishedAt":null,"snippet":null}]}.',
    "Max 8 headlines. Prefer the last 7 days. Label sourceName as the publisher site name.",
  ].join(" ");

  const userPrompt = [
    `Latest factual headlines about ${ctx.homeClub.name} vs ${ctx.awayClub.name}.`,
    `Also include notable recent club news for ${ctx.homeClub.name} and ${ctx.awayClub.name}`,
    ctx.competition ? `in the context of ${ctx.competition}.` : ".",
    "Focus on team news, injuries, managerial comments, and match preview or reaction facts.",
  ].join(" ");

  try {
    const result = await generateWithGemini(systemPrompt, userPrompt, {
      googleSearch: true,
      temperature: 0.2,
      maxOutputTokens: 2048,
      timeoutMs: 90_000,
    });
    if (result.stub) {
      return { items: [], grounded: false, error: "Gemini stub (no API key)" };
    }
    let arr = extractJsonArray(result.text);
    if (!arr) {
      // Retry once: ask model to emit bare JSON without search chrome
      try {
        const retry = await generateWithGemini(
          'Convert the following into JSON only: {"headlines":[{"headline":"","url":null,"sourceName":"","publishedAt":null,"snippet":null}]}. No markdown. Drop any item lacking a real headline.',
          result.text.slice(0, 6000),
          { googleSearch: false, temperature: 0, maxOutputTokens: 2048, timeoutMs: 45_000 }
        );
        arr = extractJsonArray(retry.text);
      } catch {
        /* ignore retry errors */
      }
    }
    if (!arr) {
      const preview = result.text.replace(/\s+/g, " ").slice(0, 120);
      return {
        items: [],
        grounded: Boolean(result.grounded),
        error: `Could not parse grounded brief JSON (${preview}…)`,
      };
    }
    return {
      items: mapBriefItems(arr, ctx, {
        region: "global",
        lang: "en",
        sourceFallback: "Web brief",
        feedKey: "web_brief_match",
      }),
      grounded: Boolean(result.grounded),
    };
  } catch (e) {
    return {
      items: [],
      grounded: false,
      error: e instanceof Error ? e.message.slice(0, 200) : "Gemini brief failed",
    };
  }
}

async function fetchGeminiDomainBrief(
  ctx: NewsMatchContext,
  feed: FeedDef
): Promise<{ items: NewsItem[]; status: NewsFeedStatus }> {
  if (!canUseGeminiBrief() || !feed.domain) {
    return {
      items: [],
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: false,
        count: 0,
        mode: "web_brief",
        error: !feed.domain ? "No domain" : "GEMINI_API_KEY not set",
      },
    };
  }

  const systemPrompt = [
    "You extract factual football headlines from web search.",
    "Never invent. Prefer results from the given publisher domain.",
    "If a result is not clearly from that domain, skip it.",
    'JSON only: {"headlines":[{"headline":"...","url":null,"sourceName":"...","publishedAt":null,"snippet":null}]}. Max 5.',
  ].join(" ");

  const userPrompt = [
    `From site ${feed.domain} (publisher: ${feed.label}), latest headlines relevant to`,
    `${ctx.homeClub.name}, ${ctx.awayClub.name}`,
    ctx.competition ? `, or ${ctx.competition}` : "",
    ". Prefer club-specific items; if none, general league news from that site is ok.",
  ].join("");

  try {
    const result = await generateWithGemini(systemPrompt, userPrompt, {
      googleSearch: true,
      temperature: 0.15,
      maxOutputTokens: 1536,
      timeoutMs: 75_000,
    });
    if (result.stub) {
      return {
        items: [],
        status: {
          key: feed.key,
          label: feed.label,
          region: feed.region,
          lang: feed.lang,
          ok: false,
          count: 0,
          mode: "web_brief",
          error: "Gemini stub",
        },
      };
    }
    const arr = extractJsonArray(result.text);
    if (!arr) {
      return {
        items: [],
        status: {
          key: feed.key,
          label: feed.label,
          region: feed.region,
          lang: feed.lang,
          ok: false,
          count: 0,
          mode: "web_brief",
          error: "Parse failed",
        },
      };
    }
    const items = mapBriefItems(arr, ctx, {
      region: feed.region,
      lang: feed.lang,
      sourceFallback: feed.label,
      feedKey: feed.key,
    }).map((it) => ({
      ...it,
      // Prefer catalogue label for provenance consistency
      sourceName: feed.label,
    }));
    return {
      items,
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: true,
        count: items.length,
        mode: "web_brief",
      },
    };
  } catch (e) {
    return {
      items: [],
      status: {
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: false,
        count: 0,
        mode: "web_brief",
        error: e instanceof Error ? e.message.slice(0, 120) : "Brief failed",
      },
    };
  }
}

function filterRssForMatch(
  raw: ReturnType<typeof parseRssItems>,
  feed: FeedDef,
  ctx: NewsMatchContext
): NewsItem[] {
  const homeAliases = clubAliases(ctx.homeClub.name, ctx.homeClub.shortName);
  const awayAliases = clubAliases(ctx.awayClub.name, ctx.awayClub.shortName);
  const starterNames = ctx.players.filter((p) => p.isStarter).map((p) => p.name);
  const isRegional = !feed.always && feed.region !== "global";

  const scored = raw.map((r) => {
    const blob = `${r.title} ${r.description || ""}`;
    let score = 0;
    let clubOrPlayer = false;
    if (textMentions(blob, homeAliases)) {
      score += 3;
      clubOrPlayer = true;
    }
    if (textMentions(blob, awayAliases)) {
      score += 3;
      clubOrPlayer = true;
    }
    if (ctx.competition && textMentions(blob, [ctx.competition])) score += 1;
    for (const name of starterNames) {
      const last = name.split(/\s+/).pop() || "";
      if (
        last.length >= 5 &&
        normalizePlayerKey(blob).includes(normalizePlayerKey(last))
      ) {
        score += 2;
        clubOrPlayer = true;
        break;
      }
    }
    return { r, score, clubOrPlayer };
  });

  const relevant = scored.filter((s) => s.clubOrPlayer);
  let pick: typeof scored;
  if (relevant.length) {
    pick = relevant.sort((a, b) => b.score - a.score).slice(0, isRegional ? 20 : 25);
  } else if (
    isRegional &&
    feed.region !== "en" &&
    feed.region !== "global"
  ) {
    // League-specialist non-EN feeds may still show a thin desk slice for context
    pick = scored.slice(0, 8);
  } else {
    // BBC/Guardian/Sky/ESPN with no club/player hit → do not flood the desk
    pick = [];
  }

  return pick.map(({ r }) => {
    const { entities, scopes } = tagEntities(r.title, r.description, ctx);
    return {
      id: itemId("rss", r.link, r.title),
      headline: r.title,
      sourceName: feed.label,
      publishedAt: parseIsoOrNull(r.pubDate),
      url: r.link,
      snippet: r.description,
      provenance: "rss" as const,
      feedKey: feed.key,
      region: feed.region,
      lang: feed.lang,
      entities,
      scopes,
    };
  });
}

export function filterNewsByScope(items: NewsItem[], scope: NewsScope): NewsItem[] {
  if (scope === "all") return items;
  return items.filter((it) => it.scopes.includes(scope));
}

export function groupNewsByRegion(
  items: NewsItem[]
): { region: NewsRegion; label: string; items: NewsItem[] }[] {
  const map = new Map<NewsRegion, NewsItem[]>();
  for (const it of items) {
    const list = map.get(it.region) || [];
    list.push(it);
    map.set(it.region, list);
  }
  return REGION_ORDER.filter((r) => map.has(r)).map((region) => ({
    region,
    label: newsRegionLabel(region),
    items: map.get(region) || [],
  }));
}

export type GetMatchNewsOpts = {
  force?: boolean;
  /** When true, also run Gemini match + domain briefs (slow). Default false = RSS-only. */
  brief?: boolean;
};

async function collectRssNews(ctx: NewsMatchContext): Promise<{
  items: NewsItem[];
  feeds: NewsFeedStatus[];
  warnings: string[];
  regionsActive: NewsRegion[];
}> {
  const warnings: string[] = [];
  const feeds: NewsFeedStatus[] = [];
  const collected: NewsItem[] = [];
  const selected = feedsForCompetition(ctx.competition);
  const regionsActive = [...new Set(selected.map((f) => f.region))];
  const rssFeeds = selected.filter((f) => f.rssUrl);

  // Soft-fail: fetchRssFeed never throws, but allSettled guards future changes
  const settled = await Promise.allSettled(rssFeeds.map((f) => fetchRssFeed(f)));
  for (let i = 0; i < rssFeeds.length; i++) {
    const feed = rssFeeds[i];
    const result = settled[i];
    if (result.status === "rejected") {
      const err =
        result.reason instanceof Error
          ? result.reason.message.slice(0, 120)
          : "Fetch failed";
      feeds.push({
        key: feed.key,
        label: feed.label,
        region: feed.region,
        lang: feed.lang,
        ok: false,
        count: 0,
        mode: "rss",
        error: err,
      });
      warnings.push(`${feed.label}: ${err}`);
      continue;
    }
    const { items, status } = result.value;
    feeds.push(status);
    if (!status.ok) {
      warnings.push(`${feed.label}: ${status.error || "failed"}`);
      continue;
    }
    collected.push(...filterRssForMatch(items, feed, ctx));
  }

  // Record web-only catalogue entries as pending/skipped until brief runs
  const webOnlyFeeds = selected.filter((f) => f.webBrief && !f.rssUrl);
  for (const feed of webOnlyFeeds) {
    feeds.push({
      key: feed.key,
      label: feed.label,
      region: feed.region,
      lang: feed.lang,
      ok: true,
      count: 0,
      mode: "skipped",
      error: "Awaiting brief enrich",
    });
  }

  return { items: collected, feeds, warnings, regionsActive };
}

async function collectBriefNews(
  ctx: NewsMatchContext,
  rssItems: NewsItem[]
): Promise<{
  items: NewsItem[];
  feeds: NewsFeedStatus[];
  warnings: string[];
  gemini: NewsPayload["gemini"];
}> {
  const warnings: string[] = [];
  const feeds: NewsFeedStatus[] = [];
  const collected: NewsItem[] = [];
  const selected = feedsForCompetition(ctx.competition);
  const webOnlyFeeds = selected.filter((f) => f.webBrief && !f.rssUrl);

  const clubHitsSoFar = rssItems.filter(
    (it) => it.scopes.includes("home") || it.scopes.includes("away")
  ).length;

  const domainJobs = webOnlyFeeds.map(async (feed) => {
    if (feed.key === "goal_com" && clubHitsSoFar >= 3) {
      return {
        items: [] as NewsItem[],
        status: {
          key: feed.key,
          label: feed.label,
          region: feed.region,
          lang: feed.lang,
          ok: true,
          count: 0,
          mode: "skipped" as const,
          error: "Skipped — RSS club coverage sufficient",
        },
      };
    }
    return fetchGeminiDomainBrief(ctx, feed);
  });

  const domainSettled = await Promise.allSettled(domainJobs);
  for (const result of domainSettled) {
    if (result.status === "rejected") {
      warnings.push(
        result.reason instanceof Error
          ? result.reason.message.slice(0, 120)
          : "Domain brief failed"
      );
      continue;
    }
    feeds.push(result.value.status);
    collected.push(...result.value.items);
    if (!result.value.status.ok && result.value.status.error) {
      warnings.push(`${result.value.status.label}: ${result.value.status.error}`);
    }
  }

  const geminiConfigured = canUseGeminiBrief();
  const brief = await fetchGeminiMatchBrief(ctx);
  const geminiUsed = geminiConfigured && !brief.error?.includes("not set");
  if (brief.error) {
    if (geminiConfigured) warnings.push(`Web brief: ${brief.error}`);
  }
  collected.push(...brief.items);

  return {
    items: collected,
    feeds,
    warnings,
    gemini: {
      configured: isGeminiConfigured(),
      available: geminiConfigured,
      plan: getEffectivePlan(),
      used: geminiUsed,
      grounded: brief.grounded,
      error: brief.error,
      pending: false,
    },
  };
}

function finalizePayload(
  ctx: NewsMatchContext,
  parts: {
    items: NewsItem[];
    feeds: NewsFeedStatus[];
    warnings: string[];
    regionsActive: NewsRegion[];
    gemini: NewsPayload["gemini"];
    briefIncluded: boolean;
    cached?: boolean;
    stale?: boolean;
  }
): NewsPayload {
  const clubHit = parts.items.some(
    (it) =>
      it.scopes.includes("home") ||
      it.scopes.includes("away") ||
      it.provenance === "web_brief"
  );
  const warnings = [...parts.warnings];
  const bucket = competitionBucket(ctx.competition);
  if (!clubHit) {
    warnings.push(
      bucket === "super_lig"
        ? `UK global RSS is often thin for Süper Lig clubs — Turkish Football + Web brief are the main coverage paths for ${ctx.homeClub.shortName} / ${ctx.awayClub.shortName}.`
        : `Few club-specific hits for ${ctx.homeClub.shortName} / ${ctx.awayClub.shortName}. Try Enrich or Refresh when Gemini is configured.`
    );
  }

  const items = dedupeItems(parts.items).sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return {
    matchId: ctx.matchId,
    fetchedAt: new Date().toISOString(),
    cached: Boolean(parts.cached),
    stale: parts.stale,
    cacheTtlMs: CACHE_TTL_MS,
    items,
    feeds: parts.feeds,
    gemini: parts.gemini,
    briefIncluded: parts.briefIncluded,
    warnings,
    regionsActive: parts.regionsActive,
  };
}

async function buildFreshNews(
  ctx: NewsMatchContext,
  wantBrief: boolean
): Promise<NewsPayload> {
  const rss = await collectRssNews(ctx);
  if (!wantBrief) {
    return finalizePayload(ctx, {
      items: rss.items,
      feeds: rss.feeds,
      warnings: rss.warnings,
      regionsActive: rss.regionsActive,
      gemini: {
        configured: isGeminiConfigured(),
        available: canUseGeminiBrief(),
        plan: getEffectivePlan(),
        used: false,
        pending: canUseGeminiBrief(),
      },
      briefIncluded: false,
    });
  }

  const brief = await collectBriefNews(ctx, rss.items);
  // Replace "Awaiting brief enrich" placeholders with real domain statuses
  const feedByKey = new Map(rss.feeds.map((f) => [f.key, f]));
  for (const f of brief.feeds) feedByKey.set(f.key, f);
  const feeds = [...feedByKey.values()];

  return finalizePayload(ctx, {
    items: [...rss.items, ...brief.items],
    feeds,
    warnings: [...rss.warnings, ...brief.warnings],
    regionsActive: rss.regionsActive,
    gemini: brief.gemini,
    briefIncluded: true,
  });
}

function scheduleBackgroundRevalidate(ctx: NewsMatchContext, wantBrief: boolean) {
  const key = `${ctx.matchId}:brief=${wantBrief ? 1 : 0}`;
  if (revalidating.has(key)) return;
  const job = (async () => {
    try {
      const payload = await buildFreshNews(ctx, wantBrief);
      cache.set(ctx.matchId, { at: Date.now(), payload });
    } catch {
      /* soft-fail background refresh */
    } finally {
      revalidating.delete(key);
    }
  })();
  revalidating.set(key, job);
}

export async function getMatchNews(
  ctx: NewsMatchContext,
  opts?: GetMatchNewsOpts
): Promise<NewsPayload> {
  const wantBrief = opts?.brief === true && canUseGeminiBrief();
  const force = opts?.force === true;
  const cacheKey = ctx.matchId;
  const hit = cache.get(cacheKey);
  const age = hit ? Date.now() - hit.at : Infinity;
  const fresh = Boolean(hit && age < CACHE_TTL_MS);

  if (!force && hit && fresh) {
    // Warm cache: paint immediately. If caller wants brief but cache is RSS-only, enrich.
    if (wantBrief && !hit.payload.briefIncluded && canUseGeminiBrief()) {
      const rssItems = hit.payload.items.filter((i) => i.provenance === "rss");
      const brief = await collectBriefNews(ctx, rssItems);
      const feedByKey = new Map(hit.payload.feeds.map((f) => [f.key, f]));
      for (const f of brief.feeds) feedByKey.set(f.key, f);
      const payload = finalizePayload(ctx, {
        items: [...hit.payload.items, ...brief.items],
        feeds: [...feedByKey.values()],
        warnings: [
          ...hit.payload.warnings.filter((w) => !w.startsWith("Web brief:")),
          ...brief.warnings,
        ],
        regionsActive: hit.payload.regionsActive,
        gemini: brief.gemini,
        briefIncluded: true,
      });
      cache.set(cacheKey, { at: Date.now(), payload });
      return payload;
    }
    return { ...hit.payload, cached: true, stale: false };
  }

  // Stale-while-revalidate: serve expired cache instantly, refresh in background
  if (!force && hit) {
    scheduleBackgroundRevalidate(ctx, wantBrief || hit.payload.briefIncluded);
    return { ...hit.payload, cached: true, stale: true };
  }

  const payload = await buildFreshNews(ctx, wantBrief);
  cache.set(cacheKey, { at: Date.now(), payload });
  return payload;
}

export function invalidateNewsCache(matchId?: string) {
  if (matchId) cache.delete(matchId);
  else cache.clear();
}
