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

export function buildSocialDraftsFromMatch(af: MatchAutofill) {
  const { homeShort, awayShort, fixtureLabelFull, kickoffLondon, competition, venue } =
    af;
  const venueBit = venue ? ` · ${venue}` : "";
  return [
    {
      slotKey: "t_day",
      label: "T−day",
      platform: "youtube",
      copy: `Match day — ${fixtureLabelFull}. KO ${kickoffLondon}.${venueBit} Full CoComms U&R show coming up.`,
      creativeKind: "thumb",
    },
    {
      slotKey: "t_1h",
      label: "T−1h",
      platform: "facebook",
      copy: `One hour out — ${homeShort} vs ${awayShort}. KO ${kickoffLondon}. Cover live, stream locking.${venueBit}`,
      creativeKind: "cover",
    },
    {
      slotKey: "were_live",
      label: "We're live",
      platform: "instagram",
      copy: `We're live — ${fixtureLabelFull}. Join the stream now.`,
      creativeKind: "ig_live",
    },
    {
      slotKey: "ft",
      label: "FT (optional)",
      platform: "youtube",
      copy: `Full time — ${homeShort} vs ${awayShort} (${competition}). Thanks for watching with CoComms U&R.`,
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
  const venueLine = venue ? `Venue: ${venue}.` : "";
  return {
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
    ytTitle: `${fixtureLabel} | CoComms U&R`,
    ytDescription:
      `Live CoComms U&R commentary — ${fixtureLabelFull}. ${competition}. KO ${kickoffLondon}. ${venueLine}`.trim(),
    overlayUrl: overlayUrlForMatchDay(matchDay.id, match?.id),
    matchId: match?.id ?? null,
    afFixtureId: match?.apiFootballFixtureId ?? null,
    pack: resolveMatchCreativePack(homeName, awayName),
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
      note: ytThumbUrl ? undefined : UR_CREATIVES_PLACEHOLDER,
    },
    fbCover: {
      canvaId: cover?.canvaId ?? null,
      canvaUrl: cover?.canvaUrl ?? null,
      previewAsset: fbCoverUrl,
      kind: "cover" as const,
      label: "FB cover",
      note: fbCoverUrl ? undefined : UR_CREATIVES_PLACEHOLDER,
    },
    igLive: {
      canvaId: ig?.canvaId ?? null,
      canvaUrl: ig?.canvaUrl ?? null,
      previewAsset: igStillUrl,
      kind: "ig_live" as const,
      label: "IG We're Live",
      note: igStillUrl ? undefined : UR_CREATIVES_PLACEHOLDER,
    },
  };

  return {
    showId: show.id,
    matchDayId: show.matchDayId,
    claimedByUserId: show.claimedByUserId,
    status: show.status,
    statuses: [...UR_SHOW_STATUSES],
    palette: UR_PALETTE,
    /** null until match-specific pack / PATCH — never another fixture's art */
    ytThumbUrl,
    ytTitle: show.ytTitle || af?.ytTitle || `${fixtureLabel} | CoComms U&R`,
    ytDescription:
      show.ytDescription ||
      af?.ytDescription ||
      `Live commentary show — ${fixtureLabel}. ${show.matchDay?.competition || ""}`.trim(),
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
    creatives: show.creatives.map((c) => ({
      id: c.id,
      kind: c.kind,
      label: c.label,
      canvaId: c.canvaId,
      canvaUrl: c.canvaUrl,
      assetUrl: c.assetUrl,
      status: c.status,
      sortOrder: c.sortOrder,
      placeholder: !c.assetUrl && !c.canvaId ? UR_CREATIVES_PLACEHOLDER : null,
    })),
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
    return { ok: true as const, created: false, show: refreshed.show };
  }

  const af = buildMatchAutofill(matchDay);
  const socialDrafts = buildSocialDraftsFromMatch(af);
  const creativeRows = creativeCreatesFromPack(af.pack);

  const show = await prisma.urShow.create({
    data: {
      matchDayId,
      claimedByUserId: userId,
      status: "Planned",
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
            ? `U&R enabled — match autofill + creatives pack "${af.pack.key}". Restream/YT URLs stub until APIs wired.`
            : `U&R enabled — match autofill (names, KO Europe/London, overlay, social). Creatives: ${UR_CREATIVES_PLACEHOLDER}.`,
          payloadJson: JSON.stringify({
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

  return { ok: true as const, created: true, show };
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

export async function packageHandoff(matchDayId: string, userId: string) {
  const show = await findOwnedUrShow(matchDayId, userId);
  if (!show) return { ok: false as const, status: 404 as const, error: "Show not found" };

  const match = show.matchDay.matches[0];
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
    /** Restream/social API wiring is NOT ours */
    apis: { restream: "stub", youtube: "stub", social: "stub" },
    handedOffAt: new Date().toISOString(),
  };

  const webhook = process.env.UR_HANDOFF_WEBHOOK_URL?.trim();
  let webhookResult: { ok: boolean; detail: string } = {
    ok: false,
    detail: "No UR_HANDOFF_WEBHOOK_URL — in-app log only",
  };
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      webhookResult = {
        ok: res.ok,
        detail: `Webhook ${res.status} ${res.statusText}`,
      };
    } catch (e) {
      webhookResult = {
        ok: false,
        detail: e instanceof Error ? e.message : "Webhook failed",
      };
    }
  }

  await prisma.$transaction([
    prisma.urShow.update({
      where: { id: show.id },
      data: { handoffReadyAt: new Date() },
    }),
    prisma.urHandoffLog.create({
      data: {
        urShowId: show.id,
        message: `Ready for desk handoff → Remote football comms desk. ${webhookResult.detail}`,
        payloadJson: JSON.stringify(payload),
      },
    }),
  ]);

  const refreshed = await findOwnedUrShow(matchDayId, userId);
  return {
    ok: true as const,
    payload,
    webhook: webhookResult,
    show: refreshed!,
  };
}
