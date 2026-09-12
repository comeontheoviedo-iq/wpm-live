/**
 * U&R (Up & Running) Show board — claim, creatives, social, handoff stubs.
 * Remote football comms desk owns Restream / creatives / OBS after handoff.
 * Restream/social API wiring is NOT ours — stub until Ready for desk handoff.
 *
 * Creatives are ALWAYS per-show / match-specific. Never seed another fixture's
 * Canva ids or preview art (no Everton/United/Nice/Lille defaults).
 */

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export const UR_SHOW_STATUSES = [
  "Planned",
  "Creatives",
  "Bound",
  "Soundcheck",
  "Live",
  "Done",
] as const;

export type UrShowStatus = (typeof UR_SHOW_STATUSES)[number];

/** Cinematic Netflix/DAZN palette — no WPM gold */
export const UR_PALETTE = {
  deep: "#0B0F14",
  steel: "#1A2332",
  ice: "#F4F7FA",
  accent: "#7EB6FF",
} as const;

/** Rejected / legacy global stubs — strip on refresh; never re-seed */
export const UR_LEGACY_STUB_CANVA_IDS = new Set([
  "DAHU_BOLwbc", // old provisional YT (wrong-fixture default)
  "DAHU_GnpDU8", // old FB cover default
  "DAHU_M_olhE", // rejected American-football look
]);

export const UR_LEGACY_STUB_ASSETS = new Set([
  "/ur-creatives/thumb.jpg",
  "/ur-creatives/cover.jpg",
  "/ur-creatives/live2.jpg",
]);

export const UR_CREATIVES_PLACEHOLDER =
  "Awaiting match-specific creatives pack";

/**
 * Locked U&R visual system — layout #4 + Canva master template family.
 * Enable autofill encodes these as pack notes / board.thumbnailBrief / creativeBriefs.
 * U+R clones masters per match (swap crests + KO). CoComms does NOT fake-render Canva.
 */
/**
 * PERMANENT LOCK (Chris / U+R): creative family is fixed.
 * Every Enable U&R autofill MUST reference these masters.
 * Clone only — swap crests + KO. GO LIVE social = WE'RE LIVE text variant.
 * Do NOT regenerate random styles or invent alternate creative systems.
 */
export const UR_CANVA_MASTERS = {
  /** YT thumb — crests + LIVE WATCHALONG + U&R chip */
  ytThumb: "DAHU_uCOrho",
  /** FB post resize */
  fbPost: "DAHU_jpNj84",
  /** IG square */
  igSquare: "DAHU_vJLKus",
  /** IG 4:5 */
  igPortrait: "DAHU_soeUfk",
  /** Story 9:16 */
  story: "DAHU_kTJRTo",
} as const;

export const UR_CREATIVE_FAMILY_LOCK = {
  permanent: true as const,
  layout: "#4",
  rule:
    "PERMANENT LOCK — clone Canva masters only (swap crests + KO). Do NOT regenerate random styles or invent alternate creative systems. GO LIVE social uses WE'RE LIVE text variant of same layout.",
  masters: UR_CANVA_MASTERS,
  goLiveTextVariant: "WE'RE LIVE",
} as const;

export const UR_THUMBNAIL_BRIEF =
  "U&R visual system — layout #4. Dark charcoal + steel-blue rim; large home/away crests; LIVE WATCHALONG (3–4 words max) + small U&R chip; NO full SEO title on creative. Same system across all social sizes. Canva masters (clone per match — swap crests + KO): YT thumb DAHU_uCOrho · FB post DAHU_jpNj84 · IG square DAHU_vJLKus · IG 4:5 DAHU_soeUfk · Story 9:16 DAHU_kTJRTo. GO LIVE social: WE'RE LIVE text variant of same layout. CoComms does not fake-render — U+R autofills Canva from this family.";

export const UR_CREATIVE_BRIEFS = {
  thumb:
    "YT thumb — layout #4 master DAHU_uCOrho (clone; swap crests + KO). Dark charcoal, steel-blue rim, large crest pair, LIVE WATCHALONG (3–4 words) + small U&R chip. NO full SEO title.",
  cover:
    "FB post/cover — layout #4 master DAHU_jpNj84 (clone; swap crests + KO). Same charcoal / steel-blue / crest / LIVE WATCHALONG + U&R chip system. Never full SEO title.",
  ig_live:
    "IG We're Live — layout #4 (masters DAHU_vJLKus square / DAHU_soeUfk 4:5; Story DAHU_kTJRTo). WE'RE LIVE text variant of same layout for GO LIVE social. Crests + 3–4 words + U&R chip; no full SEO title.",
  open: "Open moment — match-specific; keep layout #4 language (charcoal / steel-blue / crests).",
  ht: "HT moment — match-specific; keep layout #4 language (charcoal / steel-blue / crests).",
  ft: "FT moment — match-specific; keep layout #4 language (charcoal / steel-blue / crests).",
} as const;

export type UrCreativeAsset = {
  canvaId: string | null;
  canvaUrl: string | null;
  assetUrl: string | null;
  kind: "thumb" | "cover" | "ig_live" | "open" | "ht" | "ft";
  label: string;
  note?: string;
};

/**
 * Empty Canva shape for board JSON — no hardcoded fixture art.
 * Per-show assets live on UrCreative rows / UrShow.igStillUrl.
 */
export const UR_CANVA_EMPTY = {
  ytThumb: {
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    previewAsset: null as string | null,
    kind: "thumb" as const,
    label: "YT thumbnail",
    note: UR_CREATIVES_PLACEHOLDER,
  },
  fbCover: {
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    previewAsset: null as string | null,
    kind: "cover" as const,
    label: "FB cover",
    note: UR_CREATIVES_PLACEHOLDER,
  },
  igLive: {
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    previewAsset: null as string | null,
    kind: "ig_live" as const,
    label: "IG We're Live",
    note: UR_CREATIVES_PLACEHOLDER,
  },
} as const;

/** @deprecated alias — empty only; do not put fixture art here */
export const UR_CANVA = UR_CANVA_EMPTY;

/** Empty creative slots created on Enable U&R — U+R desk PATCHes ids later */
export const UR_CREATIVE_STUBS = [
  {
    kind: "thumb",
    label: "YT thumbnail",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 0,
  },
  {
    kind: "cover",
    label: "FB cover",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 1,
  },
  {
    kind: "ig_live",
    label: "IG We're Live",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 2,
  },
  {
    kind: "open",
    label: "Open moment",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 3,
  },
  {
    kind: "ht",
    label: "HT moment",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 4,
  },
  {
    kind: "ft",
    label: "FT moment",
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    assetUrl: null as string | null,
    sortOrder: 5,
  },
] as const;

export type UrMatchCreativePack = {
  key: string;
  /** Match when both club names normalize-contain these tokens */
  homeToken: string;
  awayToken: string;
  ytThumb: UrCreativeAsset;
  fbCover: UrCreativeAsset;
  igLive: UrCreativeAsset;
};

/**
 * Known per-match packs pushed by U+R desk.
 * Hook: add a pack here OR PATCH ytThumbUrl/fbCoverUrl/igStillUrl (+ canva ids).
 */
export const UR_MATCH_CREATIVE_PACKS: UrMatchCreativePack[] = [
  {
    key: "strasbourg-monaco",
    homeToken: "strasbourg",
    awayToken: "monaco",
    ytThumb: {
      kind: "thumb",
      label: "YT thumbnail",
      canvaId: "DAHU_c69KLc",
      canvaUrl: "https://www.canva.com/d/Jl4_OpWSo6paZs0",
      assetUrl: "/ur-creatives/strasbourg-monaco/yt1.jpg",
    },
    fbCover: {
      kind: "cover",
      label: "FB cover",
      canvaId: "DAHU_QxBX5U",
      canvaUrl: "https://www.canva.com/d/8g_Ybqm87ydLA0s",
      assetUrl: "/ur-creatives/strasbourg-monaco/fb1.jpg",
    },
    igLive: {
      kind: "ig_live",
      label: "IG We're Live",
      canvaId: "DAHU_X1BZwI",
      canvaUrl: "https://www.canva.com/d/PGb7QLCk9z7WaH-",
      assetUrl: "/ur-creatives/strasbourg-monaco/ig1.jpg",
    },
  },
];

export function crestUrlForTeamId(apiFootballTeamId: number | null | undefined) {
  if (!apiFootballTeamId) return null;
  return `https://media.api-sports.io/football/teams/${apiFootballTeamId}.png`;
}

export function formatKoLondon(kickoff: Date) {
  const london = kickoff.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${london} Europe/London`;
}

export function formatKoLondonShort(kickoff: Date) {
  return (
    kickoff.toLocaleString("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " Europe/London"
  );
}

function normClub(name: string) {
  return name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function resolveMatchCreativePack(
  homeName: string | null | undefined,
  awayName: string | null | undefined
): UrMatchCreativePack | null {
  if (!homeName || !awayName) return null;
  const h = normClub(homeName);
  const a = normClub(awayName);
  for (const pack of UR_MATCH_CREATIVE_PACKS) {
    if (h.includes(pack.homeToken) && a.includes(pack.awayToken)) return pack;
    // allow reversed if needed
    if (h.includes(pack.awayToken) && a.includes(pack.homeToken)) return pack;
  }
  return null;
}

export type MatchAutofill = {
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  homeCrestUrl: string | null;
  awayCrestUrl: string | null;
  competition: string;
  venue: string | null;
  kickoff: Date;
  kickoffLondon: string;
  fixtureLabel: string;
  fixtureLabelFull: string;
  ytTitle: string;
  ytDescription: string;
  overlayUrl: string;
  matchId: string | null;
  afFixtureId: number | null;
  pack: UrMatchCreativePack | null;
};

/** Public hashtag token — letters/digits only, no "CoComms U&R" */
export function hashtagToken(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]+/g, "");
  return cleaned || "Football";
}

/** KO line for public YT desc — London clock + UK label */
export function formatKoLondonUk(kickoff: Date) {
  const london = kickoff.toLocaleString("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${london} UK`;
}

/**
 * Locked YT title formula (Chris):
 * `{Home} vs {Away} Watchalong LIVE | Reaction & Banter Desk`
 * Brand optional at end if ≤100: ` · Unofficial & Remote`
 * Never "CoComms" in public titles. Competition is NOT appended.
 */
export function buildYtTitle(af: {
  homeShort: string;
  awayShort: string;
  competition?: string;
}) {
  const core = `${af.homeShort} vs ${af.awayShort} Watchalong LIVE | Reaction & Banter Desk`;
  const withBrand = `${core} · Unofficial & Remote`;
  if (withBrand.length <= 100) return withBrand;
  if (core.length <= 100) return core;
  const shortCore = `${af.homeShort} vs ${af.awayShort} Watchalong LIVE`;
  if (shortCore.length <= 100) return shortCore;
  return shortCore.slice(0, 100);
}

/**
 * Locked YT description:
 * 1) First 2 lines — LIVE U&R watchalong + voice/graphics + KO UK[, venue]
 * 2) Bullets — live score & events / reaction & banter / no TV delay stress
 * 3) CTA subscribe for more Unofficial & Remote
 * 4) 3 hashtags max: #HomeShort #AwayShort #Watchalong (+ competition if room)
 */
export function buildYtDescription(af: {
  homeName: string;
  awayName: string;
  competition: string;
  kickoff: Date;
  venue: string | null;
  homeShort: string;
  awayShort: string;
  /** @deprecated unused — kept for call-site compat */
  fixtureLabelFull?: string;
  kickoffLondon?: string;
}) {
  const home = af.homeName || af.homeShort;
  const away = af.awayName || af.awayShort;
  const compBit = af.competition ? ` (${af.competition})` : "";
  const venueBit = af.venue ? `, ${af.venue}` : "";
  const koUk = formatKoLondonUk(af.kickoff);
  const line1 = `LIVE Unofficial & Remote watchalong — ${home} vs ${away}${compBit}.`;
  const line2 = `Voice + graphics desk, no match footage. KO ${koUk}${venueBit}.`;
  const bullets = [
    "• Live score & events",
    "• Reaction & banter",
    "• No TV delay stress",
  ].join("\n");
  const cta = "Subscribe for more Unofficial & Remote.";
  const tags = [
    `#${hashtagToken(af.homeShort)}`,
    `#${hashtagToken(af.awayShort)}`,
    "#Watchalong",
  ];
  // Competition only if room (soft: keep ≤4 tags / short token)
  if (af.competition) {
    const tagComp = `#${hashtagToken(af.competition)}`;
    if (tagComp.length <= 24 && tags.length < 4) tags.push(tagComp);
  }
  return [line1, line2, "", bullets, "", cta, "", tags.join(" ")].join("\n");
}

/**
 * Social cadence (Chris replicate winners) — platform-fit:
 * YT community / FB = longer; IG = shorter + visual.
 * {WATCH_LINK} filled by U+R when destinations exist.
 * We're live copy is the GO LIVE cadence (clear join CTA + link; gate must PASS).
 */
export function buildSocialDraftsFromMatch(af: MatchAutofill) {
  const { homeShort, awayShort, kickoffLondon, competition, venue } = af;
  const venueBit = venue ? ` · ${venue}` : "";
  const link = "{WATCH_LINK}";
  const tagHome = hashtagToken(homeShort);
  const tagAway = hashtagToken(awayShort);
  const tagComp = competition ? ` #${hashtagToken(competition)}` : "";
  const nextTease = competition
    ? `Next up: more ${competition} watchalongs — hit subscribe.`
    : "Next up: more Watchalong LIVE shows — hit subscribe.";
  return [
    {
      slotKey: "t_day",
      label: "T−day",
      platform: "youtube",
      // YT community / longer: teams + Watchalong LIVE hook + KO + link
      copy: `Match day energy 🔥\n\n${homeShort} vs ${awayShort} — Watchalong LIVE | Reaction & Banter Desk.\nKO ${kickoffLondon}${venueBit}.\n\nVoice + graphics only (no match footage). Join us later:\n${link}\n\n#${tagHome} #${tagAway} #Watchalong${tagComp}`,
      creativeKind: "thumb",
    },
    {
      slotKey: "t_1h",
      label: "T−1h",
      platform: "facebook",
      // FB longer: reminder + teams + KO + link
      copy: `One hour ⏱\n\n${homeShort} vs ${awayShort} — Watchalong LIVE locking in.\nKO ${kickoffLondon}${venueBit}.\nVoice + graphics, live score & reaction — no TV delay stress.\n\nSet a reminder / jump in:\n${link}\n\n#${tagHome} #${tagAway} #Watchalong`,
      creativeKind: "cover",
    },
    {
      slotKey: "were_live",
      label: "We're live",
      platform: "instagram",
      // IG shorter + visual; GO LIVE fires this cadence — clear join CTA + link
      copy: `🔴 WE'RE LIVE\n${homeShort} vs ${awayShort} — Watchalong LIVE\nJoin now → ${link}\n#${tagHome} #${tagAway} #Watchalong`,
      creativeKind: "ig_live",
    },
    {
      slotKey: "ft",
      label: "FT (optional)",
      platform: "youtube",
      // thanks + subscribe + next tease — same title language
      copy: `Full time — thanks for watching ${homeShort} vs ${awayShort}${competition ? ` (${competition})` : ""} with the Reaction & Banter Desk.\n\nIf you enjoyed the Watchalong LIVE, subscribe for more Unofficial & Remote.\n${nextTease}\n\nReplay / channel: ${link}\n\n#${tagHome} #${tagAway} #Watchalong`,
      creativeKind: "ft",
    },
  ] as const;
}

/** Generic empty social stubs (only used if match context missing) */
export const UR_SOCIAL_STUBS = [
  {
    slotKey: "t_day",
    label: "T−day",
    platform: "youtube",
    copy: "Match day. Full show coming up — tune in.",
    creativeKind: "thumb",
  },
  {
    slotKey: "t_1h",
    label: "T−1h",
    platform: "facebook",
    copy: "One hour out. Cover live, stream locked.",
    creativeKind: "cover",
  },
  {
    slotKey: "were_live",
    label: "We're live",
    platform: "instagram",
    copy: "We're live. Join the stream.",
    creativeKind: "ig_live",
  },
  {
    slotKey: "ft",
    label: "FT (optional)",
    platform: "youtube",
    copy: "Full time. Thanks for watching — more soon.",
    creativeKind: "ft",
  },
] as const;

/** U+R desk stub tasks created on Enable U&R (even days ahead) */
export const UR_PROVISION_TASK_DEFS = [
  {
    key: "restream_yt_fb",
    label: "Restream encoder + scheduled YT/FB create",
  },
  {
    key: "creatives_generate",
    label: "Creatives generate request",
  },
  {
    key: "social_drafts",
    label: "Social drafts ready",
  },
] as const;

export type UrProvisioningStatus = "idle" | "provisioning" | "ready";

/** Documented write-back fields U+R PATCHes to clear provisioning / fill board */
export const UR_WRITEBACK_FIELDS = {
  youtubeWatchUrl:
    "PATCH /api/show/{matchDayId} { youtubeWatchUrl } — scheduled YT watch URL",
  restreamExternalUrl:
    "PATCH /api/show/{matchDayId} { restreamExternalUrl } — must equal youtubeWatchUrl",
  restreamEventStubId:
    "PATCH /api/show/{matchDayId} { restreamEventStubId } — real Restream event id (optional)",
  youtubeUpcomingStubId:
    "PATCH /api/show/{matchDayId} { youtubeUpcomingStubId } — real YT upcoming id (optional)",
  ytThumbUrl:
    "PATCH action=set-assets | root { ytThumbUrl, ytThumbCanvaId, ytThumbCanvaUrl }",
  fbCoverUrl:
    "PATCH action=set-assets | root { fbCoverUrl, fbCoverCanvaId, fbCoverCanvaUrl }",
  igStillUrl:
    "PATCH action=set-assets | root { igStillUrl, igStillCanvaId, igStillCanvaUrl }",
  moments:
    "PATCH { openUrl/openCanvaId/openCanvaUrl, ht*, ft* }",
  note:
    "When both destination URLs are present, CoComms clears provisioningStatus → ready",
} as const;

export function buildProvisionTasks(show: {
  youtubeWatchUrl: string | null;
  restreamExternalUrl: string | null;
  creatives: Array<{ assetUrl: string | null; canvaId: string | null }>;
  socialSlots: Array<{ copy: string; approved: boolean }>;
}) {
  const gate = destinationsGate(show.youtubeWatchUrl, show.restreamExternalUrl);
  const hasCreative = show.creatives.some(
    (c) =>
      (c.assetUrl && !UR_LEGACY_STUB_ASSETS.has(c.assetUrl)) ||
      (c.canvaId && !UR_LEGACY_STUB_CANVA_IDS.has(c.canvaId))
  );
  const socialReady = show.socialSlots.some((s) => (s.copy || "").trim().length > 0);
  return UR_PROVISION_TASK_DEFS.map((t) => {
    let done = false;
    if (t.key === "restream_yt_fb") done = gate.pass;
    else if (t.key === "creatives_generate") done = hasCreative;
    else if (t.key === "social_drafts") done = socialReady;
    return {
      key: t.key,
      label: t.label,
      status: done ? ("done" as const) : ("pending" as const),
    };
  });
}

export async function postUrHandoffWebhook(
  action: string,
  payload: Record<string, unknown>
) {
  const webhook = process.env.UR_HANDOFF_WEBHOOK_URL?.trim();
  const body = { action, ...payload };
  if (!webhook) {
    return {
      ok: false as const,
      detail: "No UR_HANDOFF_WEBHOOK_URL — in-app log only",
      body,
    };
  }
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return {
      ok: res.ok,
      detail: `Webhook ${res.status} ${res.statusText}`,
      body,
    };
  } catch (e) {
    return {
      ok: false as const,
      detail: e instanceof Error ? e.message : "Webhook failed",
      body,
    };
  }
}

function stubId(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export function destinationsGate(
  youtubeWatchUrl: string | null | undefined,
  restreamExternalUrl: string | null | undefined
): { pass: boolean; reason: string } {
  const yt = (youtubeWatchUrl || "").trim();
  const rs = (restreamExternalUrl || "").trim();
  if (!yt && !rs) {
    return {
      pass: false,
      reason:
        "FAIL — Restream externalUrl and YouTube watch URL empty (stubs until APIs wired). Both required and must match.",
    };
  }
  if (!yt || !rs) {
    return {
      pass: false,
      reason:
        "FAIL — Both YouTube watch URL and Restream externalUrl required and must be equal",
    };
  }
  if (yt !== rs) {
    return {
      pass: false,
      reason: "FAIL — YouTube watch URL must equal Restream destination externalUrl",
    };
  }
  return { pass: true, reason: "PASS — URLs match" };
}

export function overlayUrlForMatchDay(matchDayId: string, matchId?: string | null) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://www.cocomms.online";
  const id = matchId || matchDayId;
  return `${base}/match-day/${id}/overlay?scorebug=0&flashes=lower`;
}

export function rfcStudioNote() {
  return {
    label: "RFC Studio",
    note: "Chris Pro local :3001 — pitch OFF for U&R talent cam stack",
    localPro: "http://localhost:3001",
  };
}

type CreativeRow = {
  kind: string;
  label: string;
  canvaId: string | null;
  canvaUrl: string | null;
  assetUrl: string | null;
  status: string;
  sortOrder: number;
  id: string;
};

type SocialRow = {
  id: string;
  slotKey: string;
  label: string;
  platform: string;
  copy: string;
  assetUrl: string | null;
  approved: boolean;
  scheduledAt: Date | null;
  status: string;
  creativeKind: string | null;
};

type HandoffRow = {
  id: string;
  message: string;
  payloadJson: string | null;
  createdAt: Date;
};

type MatchDayForBoard = {
  id: string;
  title: string;
  competition: string;
  date: Date;
  matches?: Array<{
    id: string;
    apiFootballFixtureId: number | null;
    kickoff: Date;
    venue?: { name: string; city: string } | null;
    homeClub: {
      name: string;
      shortName: string;
      stadiumName: string | null;
      apiFootballTeamId: number | null;
    };
    awayClub: {
      name: string;
      shortName: string;
      apiFootballTeamId: number | null;
    };
  }>;
};

export function buildMatchAutofill(matchDay: MatchDayForBoard): MatchAutofill {
  const match = matchDay.matches?.[0];
  const homeName = match?.homeClub.name || matchDay.title;
  const awayName = match?.awayClub.name || "";
  const homeShort = match?.homeClub.shortName || homeName;
  const awayShort = match?.awayClub.shortName || awayName || "TBD";
  const kickoff = match?.kickoff ?? matchDay.date;
  const venue =
    match?.venue?.name ||
    match?.homeClub.stadiumName ||
    null;
  const fixtureLabel = awayName
    ? `${homeShort} vs ${awayShort}`
    : matchDay.title;
  const fixtureLabelFull = awayName
    ? `${homeName} vs ${awayName}`
    : matchDay.title;
  const kickoffLondon = formatKoLondon(kickoff);
  const competition = matchDay.competition || "";
  const base: Omit<MatchAutofill, "ytTitle" | "ytDescription"> = {
    homeName,
    awayName: awayName || "TBD",
    homeShort,
    awayShort,
    homeCrestUrl: crestUrlForTeamId(match?.homeClub.apiFootballTeamId),
    awayCrestUrl: crestUrlForTeamId(match?.awayClub.apiFootballTeamId),
    competition,
    venue,
    kickoff,
    kickoffLondon,
    fixtureLabel,
    fixtureLabelFull,
    overlayUrl: overlayUrlForMatchDay(matchDay.id, match?.id),
    matchId: match?.id ?? null,
    afFixtureId: match?.apiFootballFixtureId ?? null,
    pack: resolveMatchCreativePack(homeName, awayName),
  };
  return {
    ...base,
    ytTitle: buildYtTitle(base),
    ytDescription: buildYtDescription(base),
  };
}

function isLegacyCreative(c: {
  canvaId: string | null;
  assetUrl: string | null;
}) {
  if (c.canvaId && UR_LEGACY_STUB_CANVA_IDS.has(c.canvaId)) return true;
  if (c.assetUrl && UR_LEGACY_STUB_ASSETS.has(c.assetUrl)) return true;
  return false;
}

export function toBoardJson(show: {
  id: string;
  matchDayId: string;
  claimedByUserId: string;
  status: string;
  youtubeWatchUrl: string | null;
  restreamExternalUrl: string | null;
  ytTitle: string | null;
  ytDescription: string | null;
  igStillUrl: string | null;
  restreamEventStubId: string | null;
  youtubeUpcomingStubId: string | null;
  handoffReadyAt: Date | null;
  provisioningStatus?: string | null;
  creatives: CreativeRow[];
  socialSlots: SocialRow[];
  handoffLogs?: HandoffRow[];
  matchDay?: MatchDayForBoard;
}) {
  const thumb = show.creatives.find((c) => c.kind === "thumb");
  const cover = show.creatives.find((c) => c.kind === "cover");
  const ig = show.creatives.find((c) => c.kind === "ig_live");
  const gate = destinationsGate(
    show.youtubeWatchUrl,
    show.restreamExternalUrl
  );
  const provisioningStatus = (show.provisioningStatus ||
    "idle") as UrProvisioningStatus;
  const provisionTasks = buildProvisionTasks(show);
  const creativesApproved = show.creatives.some((c) => c.status === "approved");
  const socialApproved = show.socialSlots.some((s) => s.approved);
  const goLiveReady = gate.pass;
  const goLiveSoftWarn =
    gate.pass && (!creativesApproved || !socialApproved)
      ? "URL gate PASS — creatives/social not fully approved (soft-warn; GO LIVE still allowed)"
      : null;
  const af = show.matchDay ? buildMatchAutofill(show.matchDay) : null;
  const fixtureLabel = af?.fixtureLabel || show.matchDay?.title || "Match";

  const ytThumbUrl = thumb?.assetUrl || null;
  const fbCoverUrl = cover?.assetUrl || null;
  const igStillUrl = show.igStillUrl || ig?.assetUrl || null;

  const canvaFromShow = {
    ytThumb: {
      canvaId: thumb?.canvaId ?? null,
      canvaUrl: thumb?.canvaUrl ?? null,
      previewAsset: ytThumbUrl,
      kind: "thumb" as const,
      label: "YT thumbnail",
      note: ytThumbUrl ? undefined : UR_THUMBNAIL_BRIEF,
      brief: UR_THUMBNAIL_BRIEF,
    },
    fbCover: {
      canvaId: cover?.canvaId ?? null,
      canvaUrl: cover?.canvaUrl ?? null,
      previewAsset: fbCoverUrl,
      kind: "cover" as const,
      label: "FB cover",
      note: fbCoverUrl ? undefined : UR_CREATIVE_BRIEFS.cover,
      brief: UR_CREATIVE_BRIEFS.cover,
    },
    igLive: {
      canvaId: ig?.canvaId ?? null,
      canvaUrl: ig?.canvaUrl ?? null,
      previewAsset: igStillUrl,
      kind: "ig_live" as const,
      label: "IG We're Live",
      note: igStillUrl ? undefined : UR_CREATIVE_BRIEFS.ig_live,
      brief: UR_CREATIVE_BRIEFS.ig_live,
    },
  };

  return {
    showId: show.id,
    matchDayId: show.matchDayId,
    claimedByUserId: show.claimedByUserId,
    status: show.status,
    statuses: [...UR_SHOW_STATUSES],
    provisioningStatus,
    provisioning: provisioningStatus === "provisioning",
    provisionTasks,
    goLive: {
      enabled: goLiveReady,
      softWarn: goLiveSoftWarn,
      note: "Signal only — U+R/OBS owns the encoder. CoComms does not start streaming.",
    },
    writeBackFields: UR_WRITEBACK_FIELDS,
    palette: UR_PALETTE,
    /** null until match-specific pack / PATCH — never another fixture's art */
    ytThumbUrl,
    ytTitle:
      show.ytTitle ||
      af?.ytTitle ||
      buildYtTitle({
        homeShort: af?.homeShort || fixtureLabel,
        awayShort: af?.awayShort || "TBD",
        competition: show.matchDay?.competition || "",
      }),
    ytDescription:
      show.ytDescription ||
      af?.ytDescription ||
      `LIVE Unofficial & Remote watchalong — ${fixtureLabel}.\nVoice + graphics desk, no match footage.\n\n• Live score & events\n• Reaction & banter\n• No TV delay stress\n\nSubscribe for more Unofficial & Remote.\n\n#Watchalong`,
    fbCoverUrl,
    igStillUrl,
    igStillNote: igStillUrl ? null : UR_CREATIVES_PLACEHOLDER,
    creativesPlaceholder: UR_CREATIVES_PLACEHOLDER,
    youtubeWatchUrl: show.youtubeWatchUrl,
    restreamExternalUrl: show.restreamExternalUrl,
    destinationsGate: gate,
    restreamEventStubId: show.restreamEventStubId,
    youtubeUpcomingStubId: show.youtubeUpcomingStubId,
    /** TODO: call real Restream API when RESTREAM_API_KEY exists — stub only */
    restreamApi: "stub",
    /** TODO: call real YouTube Data API when keys exist — stub only */
    youtubeApi: "stub",
    thumbnailBrief: UR_THUMBNAIL_BRIEF,
    creativeBriefs: UR_CREATIVE_BRIEFS,
    canvaMasters: UR_CANVA_MASTERS,
    creativeFamilyLock: UR_CREATIVE_FAMILY_LOCK,
    creatives: show.creatives.map((c) => {
      const brief =
        c.kind in UR_CREATIVE_BRIEFS
          ? UR_CREATIVE_BRIEFS[c.kind as keyof typeof UR_CREATIVE_BRIEFS]
          : null;
      return {
        id: c.id,
        kind: c.kind,
        label: c.label,
        canvaId: c.canvaId,
        canvaUrl: c.canvaUrl,
        assetUrl: c.assetUrl,
        status: c.status,
        sortOrder: c.sortOrder,
        brief,
        placeholder: !c.assetUrl && !c.canvaId
          ? brief || UR_CREATIVES_PLACEHOLDER
          : null,
      };
    }),
    socialDrafts: show.socialSlots.map((s) => ({
      id: s.id,
      slot: s.slotKey as "t_day" | "t_1h" | "were_live" | "ft",
      label: s.label,
      platform: s.platform,
      copy: s.copy,
      assetUrl: s.assetUrl,
      approved: s.approved,
      scheduledAt: s.scheduledAt?.toISOString() ?? null,
      status: s.status,
      creativeKind: s.creativeKind,
    })),
    handoffReadyAt: show.handoffReadyAt?.toISOString() ?? null,
    handoffLogs: (show.handoffLogs || []).map((h) => ({
      id: h.id,
      message: h.message,
      payload: h.payloadJson ? JSON.parse(h.payloadJson) : null,
      createdAt: h.createdAt.toISOString(),
    })),
    matchDay: show.matchDay
      ? {
          id: show.matchDay.id,
          title: show.matchDay.title,
          competition: show.matchDay.competition,
          date: show.matchDay.date.toISOString(),
          matchId: af?.matchId ?? null,
          afFixtureId: af?.afFixtureId ?? null,
          kickoff: af?.kickoff?.toISOString() ?? null,
          kickoffLondon: af?.kickoffLondon ?? null,
          venue: af?.venue ?? null,
          home: af?.homeName ?? null,
          away: af?.awayName ?? null,
          homeShort: af?.homeShort ?? null,
          awayShort: af?.awayShort ?? null,
          homeCrestUrl: af?.homeCrestUrl ?? null,
          awayCrestUrl: af?.awayCrestUrl ?? null,
        }
      : null,
    graphics: {
      rfcStudio: rfcStudioNote(),
      overlayUrl: af?.overlayUrl || overlayUrlForMatchDay(show.matchDayId),
      overlayParams: "scorebug=0&flashes=lower",
      pitchOff: true,
    },
    canva: canvaFromShow,
    creativePackKey: af?.pack?.key ?? null,
  };
}

const showInclude = {
  creatives: { orderBy: { sortOrder: "asc" as const } },
  socialSlots: { orderBy: { slotKey: "asc" as const } },
  handoffLogs: { orderBy: { createdAt: "desc" as const }, take: 40 },
  matchDay: {
    include: {
      matches: {
        include: {
          venue: { select: { name: true, city: true } },
          homeClub: {
            select: {
              name: true,
              shortName: true,
              stadiumName: true,
              apiFootballTeamId: true,
            },
          },
          awayClub: {
            select: {
              name: true,
              shortName: true,
              apiFootballTeamId: true,
            },
          },
        },
        orderBy: { kickoff: "asc" as const },
        take: 1,
      },
    },
  },
};

export async function findOwnedUrShow(matchDayId: string, userId: string) {
  return prisma.urShow.findFirst({
    where: { matchDayId, claimedByUserId: userId },
    include: showInclude,
  });
}

async function loadMatchDayForClaim(matchDayId: string, userId: string) {
  return prisma.matchDay.findFirst({
    where: { id: matchDayId, userId },
    include: {
      matches: {
        include: {
          venue: { select: { name: true, city: true } },
          homeClub: {
            select: {
              name: true,
              shortName: true,
              stadiumName: true,
              apiFootballTeamId: true,
            },
          },
          awayClub: {
            select: {
              name: true,
              shortName: true,
              apiFootballTeamId: true,
            },
          },
        },
        orderBy: { kickoff: "asc" },
        take: 1,
      },
      urShow: true,
    },
  });
}

function creativeCreatesFromPack(pack: UrMatchCreativePack | null) {
  return UR_CREATIVE_STUBS.map((c) => {
    let canvaId: string | null = null;
    let canvaUrl: string | null = null;
    let assetUrl: string | null = null;
    if (pack) {
      if (c.kind === "thumb") {
        canvaId = pack.ytThumb.canvaId;
        canvaUrl = pack.ytThumb.canvaUrl;
        assetUrl = pack.ytThumb.assetUrl;
      } else if (c.kind === "cover") {
        canvaId = pack.fbCover.canvaId;
        canvaUrl = pack.fbCover.canvaUrl;
        assetUrl = pack.fbCover.assetUrl;
      } else if (c.kind === "ig_live") {
        canvaId = pack.igLive.canvaId;
        canvaUrl = pack.igLive.canvaUrl;
        assetUrl = pack.igLive.assetUrl;
      }
      // open / ht / ft stay empty TBD — never wrong-match art
    }
    return {
      kind: c.kind,
      label: c.label,
      canvaId,
      canvaUrl,
      assetUrl,
      status: "pending" as const,
      sortOrder: c.sortOrder,
    };
  });
}

/**
 * Apply / refresh match autofill + strip legacy wrong-fixture creatives.
 * If a known pack matches (e.g. Strasbourg–Monaco), set those assets only.
 * Accepts explicit asset URLs from U+R desk via opts.
 */
export async function refreshUrShowFromMatch(
  matchDayId: string,
  userId: string,
  opts?: {
    /** Force overwrite YT title/desc + social copy from match */
    forceText?: boolean;
    ytThumbUrl?: string | null;
    fbCoverUrl?: string | null;
    igStillUrl?: string | null;
    ytThumbCanvaId?: string | null;
    ytThumbCanvaUrl?: string | null;
    fbCoverCanvaId?: string | null;
    fbCoverCanvaUrl?: string | null;
    igStillCanvaId?: string | null;
    igStillCanvaUrl?: string | null;
  }
) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show?.matchDay) {
    return { ok: false as const, status: 404 as const, error: "Show not found" };
  }
  const af = buildMatchAutofill(show.matchDay);
  const pack = af.pack;
  const socialDrafts = buildSocialDraftsFromMatch(af);

  const showUpdate: {
    ytTitle?: string;
    ytDescription?: string;
    igStillUrl?: string | null;
  } = {};
  if (opts?.forceText !== false) {
    showUpdate.ytTitle = af.ytTitle;
    showUpdate.ytDescription = af.ytDescription;
  }
  if (opts && "igStillUrl" in opts) {
    showUpdate.igStillUrl = opts.igStillUrl ?? null;
  } else if (pack?.igLive.assetUrl) {
    const igCreative = show.creatives.find((c) => c.kind === "ig_live");
    const igIsLegacy =
      !igCreative ||
      isLegacyCreative(igCreative) ||
      !igCreative.assetUrl;
    if (igIsLegacy || !show.igStillUrl) {
      showUpdate.igStillUrl = pack.igLive.assetUrl;
    }
  }

  if (Object.keys(showUpdate).length) {
    await prisma.urShow.update({
      where: { id: show.id },
      data: showUpdate,
    });
  }

  for (const c of show.creatives) {
    const data: {
      canvaId?: string | null;
      canvaUrl?: string | null;
      assetUrl?: string | null;
    } = {};

    if (c.kind === "thumb") {
      if (opts && "ytThumbUrl" in opts) {
        data.assetUrl = opts.ytThumbUrl ?? null;
        if ("ytThumbCanvaId" in opts) data.canvaId = opts.ytThumbCanvaId ?? null;
        if ("ytThumbCanvaUrl" in opts) data.canvaUrl = opts.ytThumbCanvaUrl ?? null;
      } else if (isLegacyCreative(c) || (!c.assetUrl && pack?.ytThumb)) {
        data.canvaId = pack?.ytThumb.canvaId ?? null;
        data.canvaUrl = pack?.ytThumb.canvaUrl ?? null;
        data.assetUrl = pack?.ytThumb.assetUrl ?? null;
      }
    } else if (c.kind === "cover") {
      if (opts && "fbCoverUrl" in opts) {
        data.assetUrl = opts.fbCoverUrl ?? null;
        if ("fbCoverCanvaId" in opts) data.canvaId = opts.fbCoverCanvaId ?? null;
        if ("fbCoverCanvaUrl" in opts) data.canvaUrl = opts.fbCoverCanvaUrl ?? null;
      } else if (isLegacyCreative(c) || (!c.assetUrl && pack?.fbCover)) {
        data.canvaId = pack?.fbCover.canvaId ?? null;
        data.canvaUrl = pack?.fbCover.canvaUrl ?? null;
        data.assetUrl = pack?.fbCover.assetUrl ?? null;
      }
    } else if (c.kind === "ig_live") {
      if (opts && "igStillUrl" in opts) {
        data.assetUrl = opts.igStillUrl ?? null;
        if ("igStillCanvaId" in opts) data.canvaId = opts.igStillCanvaId ?? null;
        if ("igStillCanvaUrl" in opts) data.canvaUrl = opts.igStillCanvaUrl ?? null;
      } else if (isLegacyCreative(c) || (!c.assetUrl && pack?.igLive)) {
        data.canvaId = pack?.igLive.canvaId ?? null;
        data.canvaUrl = pack?.igLive.canvaUrl ?? null;
        data.assetUrl = pack?.igLive.assetUrl ?? null;
      }
    } else if (c.kind === "open" || c.kind === "ht" || c.kind === "ft") {
      // Never keep wrong-match / legacy art on moment slots
      if (isLegacyCreative(c)) {
        data.canvaId = null;
        data.canvaUrl = null;
        data.assetUrl = null;
      }
    }

    if (Object.keys(data).length) {
      await prisma.urCreative.update({ where: { id: c.id }, data });
    }
  }

  // Sync social copy + clear legacy asset urls; attach pack assets to matching slots
  for (const slot of show.socialSlots) {
    const draft = socialDrafts.find((d) => d.slotKey === slot.slotKey);
    const data: {
      copy?: string;
      assetUrl?: string | null;
      scheduledAt?: Date | null;
    } = {};
    if (draft && opts?.forceText !== false) {
      data.copy = draft.copy;
    }
    let nextAsset = slot.assetUrl;
    if (nextAsset && UR_LEGACY_STUB_ASSETS.has(nextAsset)) {
      nextAsset = null;
    }
    if (slot.slotKey === "t_day") {
      const thumbUrl =
        opts?.ytThumbUrl ??
        pack?.ytThumb.assetUrl ??
        show.creatives.find((c) => c.kind === "thumb" && !isLegacyCreative(c))
          ?.assetUrl ??
        null;
      if (opts && "ytThumbUrl" in opts) nextAsset = opts.ytThumbUrl ?? null;
      else if (!nextAsset && thumbUrl) nextAsset = thumbUrl;
      else if (nextAsset && UR_LEGACY_STUB_ASSETS.has(nextAsset))
        nextAsset = thumbUrl;
    } else if (slot.slotKey === "t_1h") {
      const coverUrl =
        opts?.fbCoverUrl ??
        pack?.fbCover.assetUrl ??
        show.creatives.find((c) => c.kind === "cover" && !isLegacyCreative(c))
          ?.assetUrl ??
        null;
      if (opts && "fbCoverUrl" in opts) nextAsset = opts.fbCoverUrl ?? null;
      else if (!nextAsset && coverUrl) nextAsset = coverUrl;
      else if (nextAsset && UR_LEGACY_STUB_ASSETS.has(nextAsset))
        nextAsset = coverUrl;
    } else if (slot.slotKey === "were_live") {
      const igUrl =
        opts?.igStillUrl ??
        pack?.igLive.assetUrl ??
        show.igStillUrl ??
        show.creatives.find((c) => c.kind === "ig_live" && !isLegacyCreative(c))
          ?.assetUrl ??
        null;
      if (opts && "igStillUrl" in opts) nextAsset = opts.igStillUrl ?? null;
      else if (!nextAsset && igUrl) nextAsset = igUrl;
      else if (nextAsset && UR_LEGACY_STUB_ASSETS.has(nextAsset))
        nextAsset = igUrl;
    } else if (slot.slotKey === "ft") {
      if (nextAsset && UR_LEGACY_STUB_ASSETS.has(nextAsset)) nextAsset = null;
    }

    if (nextAsset !== slot.assetUrl) data.assetUrl = nextAsset;

    // Reschedule from KO London-relative times
    if (opts?.forceText !== false) {
      if (slot.slotKey === "t_day") {
        const d = new Date(af.kickoff);
        d.setHours(9, 0, 0, 0);
        data.scheduledAt = d;
      } else if (slot.slotKey === "t_1h") {
        data.scheduledAt = new Date(af.kickoff.getTime() - 60 * 60 * 1000);
      } else if (slot.slotKey === "were_live") {
        data.scheduledAt = new Date(af.kickoff);
      } else if (slot.slotKey === "ft") {
        data.scheduledAt = new Date(af.kickoff.getTime() + 2 * 60 * 60 * 1000);
      }
    }

    if (Object.keys(data).length) {
      await prisma.urSocialSlot.update({ where: { id: slot.id }, data });
    }
  }

  const refreshed = await findOwnedUrShow(matchDayId, userId);
  return { ok: true as const, show: refreshed! };
}

export async function claimMatchDayForUr(matchDayId: string, userId: string) {
  const matchDay = await loadMatchDayForClaim(matchDayId, userId);
  if (!matchDay)
    return { ok: false as const, status: 404 as const, error: "Match day not found" };

  if (matchDay.urShow) {
    // Existing show: refresh autofill + strip legacy wrong-fixture art / apply known pack
    const refreshed = await refreshUrShowFromMatch(matchDayId, userId, {
      forceText: true,
    });
    if (!refreshed.ok) {
      const existing = await findOwnedUrShow(matchDayId, userId);
      return { ok: true as const, created: false, show: existing! };
    }
    // If destinations still empty, keep/restore Provisioning… state
    const s = refreshed.show;
    const needsProvision =
      !(s.youtubeWatchUrl || "").trim() || !(s.restreamExternalUrl || "").trim();
    if (needsProvision && s.provisioningStatus !== "provisioning") {
      await prisma.urShow.update({
        where: { id: s.id },
        data: { provisioningStatus: "provisioning" },
      });
    }
    const finalShow = await findOwnedUrShow(matchDayId, userId);
    return { ok: true as const, created: false, show: finalShow! };
  }

  const af = buildMatchAutofill(matchDay);
  const socialDrafts = buildSocialDraftsFromMatch(af);
  const creativeRows = creativeCreatesFromPack(af.pack);

  const show = await prisma.urShow.create({
    data: {
      matchDayId,
      claimedByUserId: userId,
      status: "Planned",
      provisioningStatus: "provisioning",
      ytTitle: af.ytTitle,
      ytDescription: af.ytDescription,
      igStillUrl: af.pack?.igLive.assetUrl ?? null,
      youtubeWatchUrl: null,
      restreamExternalUrl: null,
      // TODO: real Restream API when RESTREAM_API_KEY exists
      restreamEventStubId: stubId("restream_evt"),
      // TODO: real YouTube Data API — unlisted until promo approved
      youtubeUpcomingStubId: stubId("yt_upcoming"),
      creatives: {
        create: creativeRows,
      },
      socialSlots: {
        create: socialDrafts.map((s) => {
          let assetUrl: string | null = null;
          if (s.slotKey === "t_day") assetUrl = af.pack?.ytThumb.assetUrl ?? null;
          else if (s.slotKey === "t_1h")
            assetUrl = af.pack?.fbCover.assetUrl ?? null;
          else if (s.slotKey === "were_live")
            assetUrl = af.pack?.igLive.assetUrl ?? null;
          let scheduledAt: Date | null = null;
          if (s.slotKey === "t_day") {
            scheduledAt = new Date(af.kickoff);
            scheduledAt.setHours(9, 0, 0, 0);
          } else if (s.slotKey === "t_1h") {
            scheduledAt = new Date(af.kickoff.getTime() - 60 * 60 * 1000);
          } else if (s.slotKey === "were_live") {
            scheduledAt = new Date(af.kickoff);
          } else if (s.slotKey === "ft") {
            scheduledAt = new Date(af.kickoff.getTime() + 2 * 60 * 60 * 1000);
          }
          return {
            slotKey: s.slotKey,
            label: s.label,
            platform: s.platform,
            copy: s.copy,
            assetUrl,
            approved: false,
            scheduledAt,
            status: "draft",
            creativeKind: s.creativeKind,
          };
        }),
      },
      handoffLogs: {
        create: {
          message: af.pack
            ? `U&R enabled — Provisioning… autofill + pack "${af.pack.key}". Stub tasks for U+R desk.`
            : `U&R enabled — Provisioning… match autofill + stub tasks for U+R desk. Creatives: ${UR_CREATIVES_PLACEHOLDER}.`,
          payloadJson: JSON.stringify({
            action: "enable_provision",
            matchDayId,
            restreamApi: "stub",
            youtubeApi: "stub",
            autofill: {
              home: af.homeName,
              away: af.awayName,
              competition: af.competition,
              venue: af.venue,
              kickoffLondon: af.kickoffLondon,
              homeCrestUrl: af.homeCrestUrl,
              awayCrestUrl: af.awayCrestUrl,
              overlayUrl: af.overlayUrl,
              pack: af.pack?.key ?? null,
            },
          }),
        },
      },
    },
    include: showInclude,
  });

  // Fire enable_provision handoff for U+R consumer (even days ahead of KO)
  const provisionPayload = buildEnableProvisionPayload(show);
  const webhook = await postUrHandoffWebhook("enable_provision", provisionPayload);
  await prisma.urHandoffLog.create({
    data: {
      urShowId: show.id,
      message: `enable_provision → U+R desk. ${webhook.detail}`,
      payloadJson: JSON.stringify(webhook.body),
    },
  });
  const withLog = await findOwnedUrShow(matchDayId, userId);
  return { ok: true as const, created: true, show: withLog!, webhook };
}

/**
 * Advance status spine from real completeness (never fake Restream/YT).
 * Planned → Creatives when any match-specific creative asset/canva present
 * Creatives → Bound when destinations URL gate passes
 * Does not auto-jump to Soundcheck/Live/Done — those stay manual.
 */
export async function maybeAdvanceUrStatusFromCompleteness(
  matchDayId: string,
  userId: string
) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show) return null;

  const hasCreativeAsset = show.creatives.some(
    (c) =>
      (c.assetUrl && !UR_LEGACY_STUB_ASSETS.has(c.assetUrl)) ||
      (c.canvaId && !UR_LEGACY_STUB_CANVA_IDS.has(c.canvaId))
  );
  const gate = destinationsGate(show.youtubeWatchUrl, show.restreamExternalUrl);

  let next: UrShowStatus | null = null;
  const cur = show.status as UrShowStatus;

  if (cur === "Planned" && hasCreativeAsset) {
    next = "Creatives";
  } else if (
    (cur === "Planned" || cur === "Creatives") &&
    gate.pass
  ) {
    next = "Bound";
  } else if (cur === "Planned" && hasCreativeAsset) {
    next = "Creatives";
  }

  // If gate passes and we're still Planned with assets, Bound wins
  if (gate.pass && (cur === "Planned" || cur === "Creatives")) {
    next = "Bound";
  } else if (!gate.pass && cur === "Planned" && hasCreativeAsset) {
    next = "Creatives";
  }

  if (!next || next === cur) return show;

  // Only auto-forward along the spine, never back
  const curIdx = UR_SHOW_STATUSES.indexOf(cur);
  const nextIdx = UR_SHOW_STATUSES.indexOf(next);
  if (nextIdx <= curIdx) return show;

  await prisma.urShow.update({
    where: { id: show.id },
    data: { status: next },
  });
  return findOwnedUrShow(matchDayId, userId);
}

export async function advanceUrStatus(
  matchDayId: string,
  userId: string,
  direction: "next" | "back"
) {
  const show = await prisma.urShow.findFirst({
    where: { matchDayId, claimedByUserId: userId },
  });
  if (!show) return { ok: false as const, status: 404 as const, error: "Show not found" };
  const idx = UR_SHOW_STATUSES.indexOf(show.status as UrShowStatus);
  if (idx < 0) return { ok: false as const, status: 400 as const, error: "Unknown status" };
  const nextIdx =
    direction === "next"
      ? Math.min(idx + 1, UR_SHOW_STATUSES.length - 1)
      : Math.max(idx - 1, 0);
  if (nextIdx === idx) {
    return { ok: true as const, show: await findOwnedUrShow(matchDayId, userId) };
  }
  await prisma.urShow.update({
    where: { id: show.id },
    data: { status: UR_SHOW_STATUSES[nextIdx] },
  });
  return { ok: true as const, show: await findOwnedUrShow(matchDayId, userId) };
}

export function buildEnableProvisionPayload(show: {
  id: string;
  matchDayId: string;
  ytTitle: string | null;
  ytDescription: string | null;
  restreamEventStubId: string | null;
  youtubeUpcomingStubId: string | null;
  youtubeWatchUrl: string | null;
  restreamExternalUrl: string | null;
  creatives: CreativeRow[];
  socialSlots: SocialRow[];
  matchDay?: MatchDayForBoard;
}) {
  const board = toBoardJson(show);
  return {
    consumer: "Remote football comms desk",
    matchDayId: show.matchDayId,
    matchId: board.matchDay?.matchId ?? null,
    afFixtureId: board.matchDay?.afFixtureId ?? null,
    tasks: buildProvisionTasks(show),
    ytTitle: board.ytTitle,
    ytDescription: board.ytDescription,
    thumbnailBrief: UR_THUMBNAIL_BRIEF,
    creativeBriefs: UR_CREATIVE_BRIEFS,
    canvaMasters: UR_CANVA_MASTERS,
    creativeFamilyLock: UR_CREATIVE_FAMILY_LOCK,
    socialDrafts: board.socialDrafts,
    socialCadence: {
      t_day: "anticipation + teams + KO + link (YT/FB longer)",
      t_1h: "reminder + link (FB longer)",
      were_live:
        "GO LIVE fires — clear join CTA + link; IG shorter + visual; gate must PASS",
      ft: "thanks + subscribe + next tease (YT longer)",
    },
    match: board.matchDay,
    overlayUrl: board.graphics.overlayUrl,
    overlayParams: board.graphics.overlayParams,
    restreamEventStubId: show.restreamEventStubId,
    youtubeUpcomingStubId: show.youtubeUpcomingStubId,
    writeBack: UR_WRITEBACK_FIELDS,
    note:
      "Enable U&R auto-provision — create Restream encoder + scheduled YT/FB, clone locked Canva masters (DAHU_uCOrho + resizes; swap crests+KO only — no new styles), lock social drafts. PATCH destination URLs back to clear Provisioning… on CoComms.",
    apis: { restream: "stub", youtube: "stub", social: "stub" },
    at: new Date().toISOString(),
  };
}

/** Clear provisioning when U+R writes both destination URLs back */
export async function maybeClearProvisioning(
  matchDayId: string,
  userId: string
) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show) return null;
  const yt = (show.youtubeWatchUrl || "").trim();
  const rs = (show.restreamExternalUrl || "").trim();
  if (yt && rs && show.provisioningStatus === "provisioning") {
    await prisma.urShow.update({
      where: { id: show.id },
      data: { provisioningStatus: "ready" },
    });
    await prisma.urHandoffLog.create({
      data: {
        urShowId: show.id,
        message:
          "Provisioning cleared — destination URLs written back by U+R desk.",
        payloadJson: JSON.stringify({
          action: "provision_cleared",
          youtubeWatchUrl: yt,
          restreamExternalUrl: rs,
        }),
      },
    });
    return findOwnedUrShow(matchDayId, userId);
  }
  return show;
}

export async function packageHandoff(matchDayId: string, userId: string) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show) return { ok: false as const, status: 404 as const, error: "Show not found" };

  const match = show.matchDay?.matches?.[0];
  const board = toBoardJson(show);
  const payload = {
    consumer: "Remote football comms desk",
    afFixtureId: match?.apiFootballFixtureId ?? null,
    matchDayId: show.matchDayId,
    matchId: match?.id ?? null,
    overlayUrl: board.graphics.overlayUrl,
    overlayParams: board.graphics.overlayParams,
    pitchOff: true,
    rfcStudio: board.graphics.rfcStudio,
    approvedCreatives: board.creatives.filter((c) => c.status === "approved"),
    approvedSocial: board.socialDrafts.filter((s) => s.approved),
    destinationsGate: board.destinationsGate,
    youtubeWatchUrl: show.youtubeWatchUrl,
    restreamExternalUrl: show.restreamExternalUrl,
    restreamEventStubId: show.restreamEventStubId,
    youtubeUpcomingStubId: show.youtubeUpcomingStubId,
    ytThumbUrl: board.ytThumbUrl,
    ytTitle: board.ytTitle,
    ytDescription: board.ytDescription,
    fbCoverUrl: board.fbCoverUrl,
    igStillUrl: board.igStillUrl,
    socialDrafts: board.socialDrafts,
    match: board.matchDay,
    canva: board.canva,
    creativePackKey: board.creativePackKey,
    writeBack: UR_WRITEBACK_FIELDS,
    /** Restream/social API wiring is NOT ours */
    apis: { restream: "stub", youtube: "stub", social: "stub" },
    handedOffAt: new Date().toISOString(),
  };

  const webhookResult = await postUrHandoffWebhook("ready_for_desk", payload);

  await prisma.$transaction([
    prisma.urShow.update({
      where: { id: show.id },
      data: { handoffReadyAt: new Date() },
    }),
    prisma.urHandoffLog.create({
      data: {
        urShowId: show.id,
        message: `Ready for desk handoff → Remote football comms desk. ${webhookResult.detail}`,
        payloadJson: JSON.stringify(webhookResult.body),
      },
    }),
  ]);

  const refreshed = await findOwnedUrShow(matchDayId, userId);
  return {
    ok: true as const,
    payload: webhookResult.body,
    webhook: { ok: webhookResult.ok, detail: webhookResult.detail },
    show: refreshed!,
  };
}

/**
 * GO LIVE signal — separate from Ready for desk / Enable.
 * Does NOT start streaming from CoComms; U+R/OBS owns the encoder.
 * Requires URL gate PASS; soft-warns if creatives/social incomplete.
 */
export async function goLiveUrShow(
  matchDayId: string,
  userId: string,
  opts?: { force?: boolean }
) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show) return { ok: false as const, status: 404 as const, error: "Show not found" };

  const board = toBoardJson(show);
  if (!board.goLive.enabled && !opts?.force) {
    return {
      ok: false as const,
      status: 400 as const,
      error: board.destinationsGate.reason || "URL gate must PASS before GO LIVE",
    };
  }

  const match = show.matchDay?.matches?.[0];
  const wereLive = board.socialDrafts.find((s) => s.slot === "were_live");
  const payload = {
    consumer: "Remote football comms desk",
    matchDayId: show.matchDayId,
    matchId: match?.id ?? null,
    afFixtureId: match?.apiFootballFixtureId ?? null,
    signal: "start_restream_destinations",
    cadence: "were_live",
    wereLiveSlot: wereLive || null,
    youtubeWatchUrl: show.youtubeWatchUrl,
    restreamExternalUrl: show.restreamExternalUrl,
    restreamEventStubId: show.restreamEventStubId,
    youtubeUpcomingStubId: show.youtubeUpcomingStubId,
    overlayUrl: board.graphics.overlayUrl,
    overlayParams: board.graphics.overlayParams,
    ytTitle: board.ytTitle,
    match: board.matchDay,
    softWarn: board.goLive.softWarn,
    status: "Live",
    note:
      "GO LIVE is a signal only — CoComms does NOT start the encoder. U+R/OBS owns Restream destinations path + We're live cadence.",
    at: new Date().toISOString(),
  };

  const webhookResult = await postUrHandoffWebhook("go_live", payload);

  // Approve/schedule were_live cadence + advance status to Live
  if (wereLive) {
    await prisma.urSocialSlot.updateMany({
      where: { urShowId: show.id, slotKey: "were_live" },
      data: { approved: true, status: "scheduled" },
    });
  }

  await prisma.$transaction([
    prisma.urShow.update({
      where: { id: show.id },
      data: {
        status: "Live",
        provisioningStatus:
          show.provisioningStatus === "provisioning" ? "ready" : show.provisioningStatus,
      },
    }),
    prisma.urHandoffLog.create({
      data: {
        urShowId: show.id,
        message: `GO LIVE signal → U+R desk (Restream destinations + We're live). ${webhookResult.detail}${
          board.goLive.softWarn ? ` · ${board.goLive.softWarn}` : ""
        }`,
        payloadJson: JSON.stringify(webhookResult.body),
      },
    }),
  ]);

  const refreshed = await findOwnedUrShow(matchDayId, userId);
  return {
    ok: true as const,
    payload: webhookResult.body,
    webhook: { ok: webhookResult.ok, detail: webhookResult.detail },
    softWarn: board.goLive.softWarn,
    show: refreshed!,
  };
}

