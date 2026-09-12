/**
 * U&R (Up & Running) Show board — claim, creatives, social, handoff stubs.
 * Remote football comms desk owns Restream / creatives / OBS after handoff.
 * Restream/social API wiring is NOT ours — stub until Ready for desk handoff.
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

/**
 * Provisional Canva stubs (British soccer: crests + match line + KO London).
 * REJECTED: DAHU_M_olhE / live2.jpg (American-football look) — do not use.
 * YT thumb DAHU_BOLwbc may be replaced — do not treat as final until Remote confirms.
 * IG We're Live / new thumb: placeholders only until Remote sends confirmed Canva ids.
 */
export const UR_CANVA = {
  ytThumb: {
    canvaId: "DAHU_BOLwbc", // provisional — may be replaced
    canvaUrl: "https://www.canva.com/d/zni2rAcLhanH8gL",
    previewAsset: "/ur-creatives/thumb.jpg",
    kind: "thumb" as const,
    label: "YT thumbnail",
    provisional: true,
  },
  fbCover: {
    canvaId: "DAHU_GnpDU8",
    canvaUrl: "https://www.canva.com/d/89dPLgBu5vHYsQ6",
    previewAsset: "/ur-creatives/cover.jpg",
    kind: "cover" as const,
    label: "FB cover",
  },
  /** Placeholder — do not lock until Remote sends confirmed British soccer Canva id */
  igLive: {
    canvaId: null as string | null,
    canvaUrl: null as string | null,
    previewAsset: null as string | null,
    kind: "ig_live" as const,
    label: "IG We're Live",
    note: "awaiting British soccer Canva id from Remote desk",
  },
} as const;

export const UR_CREATIVE_STUBS = [
  {
    kind: "thumb",
    label: "YT thumbnail",
    canvaId: UR_CANVA.ytThumb.canvaId,
    canvaUrl: UR_CANVA.ytThumb.canvaUrl,
    assetUrl: UR_CANVA.ytThumb.previewAsset,
    sortOrder: 0,
  },
  {
    kind: "cover",
    label: "FB cover",
    canvaId: UR_CANVA.fbCover.canvaId,
    canvaUrl: UR_CANVA.fbCover.canvaUrl,
    assetUrl: UR_CANVA.fbCover.previewAsset,
    sortOrder: 1,
  },
  {
    kind: "ig_live",
    label: "IG We're Live",
    canvaId: null,
    canvaUrl: null,
    assetUrl: null,
    sortOrder: 2,
    note: "awaiting British soccer Canva id from Remote desk",
  },
  {
    kind: "open",
    label: "Open moment",
    canvaId: null,
    canvaUrl: null,
    assetUrl: null,
    sortOrder: 3,
  },
  {
    kind: "ht",
    label: "HT moment",
    canvaId: null,
    canvaUrl: null,
    assetUrl: null,
    sortOrder: 4,
  },
  {
    kind: "ft",
    label: "FT moment",
    canvaId: null,
    canvaUrl: null,
    assetUrl: null,
    sortOrder: 5,
  },
] as const;

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
  if (!yt || !rs) {
    return {
      pass: false,
      reason: "Both YouTube watch URL and Restream externalUrl required",
    };
  }
  if (yt !== rs) {
    return {
      pass: false,
      reason: "YouTube watch URL must equal Restream destination externalUrl",
    };
  }
  return { pass: true, reason: "URLs match — gate PASS" };
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
  matchDay?: {
    id: string;
    title: string;
    competition: string;
    date: Date;
    matches?: Array<{
      id: string;
      apiFootballFixtureId: number | null;
      kickoff: Date;
      homeClub: { name: string; shortName: string };
      awayClub: { name: string; shortName: string };
    }>;
  };
}) {
  const thumb = show.creatives.find((c) => c.kind === "thumb");
  const cover = show.creatives.find((c) => c.kind === "cover");
  const ig = show.creatives.find((c) => c.kind === "ig_live");
  const gate = destinationsGate(
    show.youtubeWatchUrl,
    show.restreamExternalUrl
  );
  const match = show.matchDay?.matches?.[0];
  const fixtureLabel = match
    ? `${match.homeClub.shortName} vs ${match.awayClub.shortName}`
    : show.matchDay?.title || "Match";

  return {
    showId: show.id,
    matchDayId: show.matchDayId,
    claimedByUserId: show.claimedByUserId,
    status: show.status,
    statuses: [...UR_SHOW_STATUSES],
    palette: UR_PALETTE,
    ytThumbUrl: thumb?.assetUrl || UR_CANVA.ytThumb.previewAsset,
    ytTitle:
      show.ytTitle ||
      `${fixtureLabel} | CoComms U&R`,
    ytDescription:
      show.ytDescription ||
      `Live commentary show — ${fixtureLabel}. ${show.matchDay?.competition || ""}`.trim(),
    fbCoverUrl: cover?.assetUrl || UR_CANVA.fbCover.previewAsset,
    igStillUrl: show.igStillUrl || ig?.assetUrl || null,
    igStillNote: "awaiting British soccer Canva id from Remote desk",
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
          matchId: match?.id ?? null,
          afFixtureId: match?.apiFootballFixtureId ?? null,
          kickoff: match?.kickoff?.toISOString() ?? null,
          home: match?.homeClub.name ?? null,
          away: match?.awayClub.name ?? null,
        }
      : null,
    graphics: {
      rfcStudio: rfcStudioNote(),
      overlayUrl: overlayUrlForMatchDay(
        show.matchDayId,
        match?.id
      ),
      overlayParams: "scorebug=0&flashes=lower",
      pitchOff: true,
    },
    canva: UR_CANVA,
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
          homeClub: { select: { name: true, shortName: true } },
          awayClub: { select: { name: true, shortName: true } },
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

export async function claimMatchDayForUr(matchDayId: string, userId: string) {
  const matchDay = await prisma.matchDay.findFirst({
    where: { id: matchDayId, userId },
    include: {
      matches: {
        select: {
          id: true,
          kickoff: true,
          homeClub: { select: { shortName: true } },
          awayClub: { select: { shortName: true } },
        },
        orderBy: { kickoff: "asc" },
        take: 1,
      },
      urShow: true,
    },
  });
  if (!matchDay) return { ok: false as const, status: 404 as const, error: "Match day not found" };
  if (matchDay.urShow) {
    const existing = await findOwnedUrShow(matchDayId, userId);
    return { ok: true as const, created: false, show: existing! };
  }

  const match = matchDay.matches[0];
  const fixtureLabel = match
    ? `${match.homeClub.shortName} vs ${match.awayClub.shortName}`
    : matchDay.title;
  const kickoff = match?.kickoff ?? matchDay.date;

  const show = await prisma.urShow.create({
    data: {
      matchDayId,
      claimedByUserId: userId,
      status: "Planned",
      ytTitle: `${fixtureLabel} | CoComms U&R`,
      ytDescription: `Live commentary show — ${fixtureLabel}. ${matchDay.competition}`.trim(),
      igStillUrl: null, // awaiting British soccer Canva id from Remote desk
      // TODO: real Restream API when RESTREAM_API_KEY exists
      restreamEventStubId: stubId("restream_evt"),
      // TODO: real YouTube Data API — unlisted until promo approved
      youtubeUpcomingStubId: stubId("yt_upcoming"),
      creatives: {
        create: UR_CREATIVE_STUBS.map((c) => ({
          kind: c.kind,
          label: c.label,
          canvaId: c.canvaId,
          canvaUrl: c.canvaUrl,
          assetUrl: c.assetUrl,
          status: "pending",
          sortOrder: c.sortOrder,
        })),
      },
      socialSlots: {
        create: UR_SOCIAL_STUBS.map((s) => {
          const assetUrl =
            s.slotKey === "were_live"
              ? null // awaiting British soccer Canva id from Remote desk
              : s.slotKey === "t_day"
                ? UR_CANVA.ytThumb.previewAsset
                : s.slotKey === "t_1h"
                  ? UR_CANVA.fbCover.previewAsset
                  : null;
          let scheduledAt: Date | null = null;
          if (s.slotKey === "t_day") {
            scheduledAt = new Date(kickoff);
            scheduledAt.setHours(9, 0, 0, 0);
          } else if (s.slotKey === "t_1h") {
            scheduledAt = new Date(kickoff.getTime() - 60 * 60 * 1000);
          } else if (s.slotKey === "were_live") {
            scheduledAt = new Date(kickoff);
          } else if (s.slotKey === "ft") {
            scheduledAt = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
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
          message: `U&R claimed on personal account — stubs created (Restream + YT upcoming). Remote desk is consumer after handoff.`,
          payloadJson: JSON.stringify({
            matchDayId,
            restreamApi: "stub",
            youtubeApi: "stub",
            canva: UR_CANVA,
          }),
        },
      },
    },
    include: showInclude,
  });

  return { ok: true as const, created: true, show };
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
    canva: UR_CANVA,
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
