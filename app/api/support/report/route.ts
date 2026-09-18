import { NextResponse } from "next/server";
import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseSupportPingType,
  sendSupportPingAlert,
  type SupportPingContext,
  type SupportPingType,
} from "@/lib/support-ping-alert";

export const dynamic = "force-dynamic";

function tryAppendAgentInbox(row: Record<string, unknown>) {
  // Best-effort local/dev inbox. Netlify serverless FS is usually read-only — skip quietly.
  try {
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(
      join(dir, "support-pings.jsonl"),
      JSON.stringify(row) + "\n",
      "utf8"
    );
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const type = parseSupportPingType(body.type);
  if (!type) {
    return NextResponse.json(
      {
        error:
          "Invalid type (expected Ask | Bug | XI wrong | Billing | Other)",
      },
      { status: 400 }
    );
  }

  const message = String(body.message || "").trim();
  if (!message || message.length < 3) {
    return NextResponse.json(
      { error: "Message required (min 3 chars)" },
      { status: 400 }
    );
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const includeContext = body.includeContext !== false;
  let context: SupportPingContext | null = null;
  if (includeContext && body.context && typeof body.context === "object") {
    const c = body.context as Record<string, unknown>;
    context = {
      matchTitle:
        c.matchTitle != null ? String(c.matchTitle).slice(0, 200) : null,
      afFixtureId:
        c.afFixtureId != null && c.afFixtureId !== ""
          ? (typeof c.afFixtureId === "number"
              ? c.afFixtureId
              : String(c.afFixtureId).slice(0, 32))
          : null,
      lineupSource:
        c.lineupSource != null
          ? String(c.lineupSource).slice(0, 64)
          : null,
      url: c.url != null ? String(c.url).slice(0, 2000) : null,
      matchId: c.matchId != null ? String(c.matchId).slice(0, 64) : null,
      competition:
        c.competition != null ? String(c.competition).slice(0, 120) : null,
      status: c.status != null ? String(c.status).slice(0, 64) : null,
    };
  } else if (includeContext) {
    // Minimal URL-only fallback when client sends pageUrl
    const url =
      body.pageUrl != null
        ? String(body.pageUrl).slice(0, 2000)
        : body.url != null
          ? String(body.url).slice(0, 2000)
          : null;
    if (url) context = { url };
  }

  const user = await prisma.user
    .findUnique({
      where: { id: session.id },
      select: { email: true, name: true },
    })
    .catch(() => null);

  const userEmail = user?.email || session.email;
  const userName = user?.name || session.name;

  let ping: {
    id: string;
    type: string;
    message: string;
    context: string | null;
    status: string;
    createdAt: Date;
  };

  try {
    ping = await prisma.supportPing.create({
      data: {
        userId: session.id,
        type: type as SupportPingType,
        message,
        context: context ? JSON.stringify(context) : null,
        status: "open",
      },
      select: {
        id: true,
        type: true,
        message: true,
        context: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (e) {
    console.error("[support/report] db create failed", e);
    return NextResponse.json(
      { error: "Could not store support ping" },
      { status: 500 }
    );
  }

  const inboxRow = {
    id: ping.id,
    type: ping.type,
    message: ping.message,
    context,
    status: ping.status,
    userId: session.id,
    userEmail,
    userName,
    createdAt: ping.createdAt.toISOString(),
  };
  const inboxAppended = tryAppendAgentInbox(inboxRow);

  const emailSent = await sendSupportPingAlert({
    pingId: ping.id,
    type: type as SupportPingType,
    message,
    userName,
    userEmail,
    context,
    createdAt: ping.createdAt,
  });

  console.info("[support/report]", {
    id: ping.id,
    type: ping.type,
    userEmail,
    emailSent,
    inboxAppended,
  });

  return NextResponse.json({
    ok: true,
    id: ping.id,
    status: ping.status,
    emailSent,
    inboxAppended,
    message: emailSent
      ? "Thanks — sent to CoComms. We’ll pick it up shortly."
      : "Thanks — saved. (Owner email may be delayed if mail is misconfigured.)",
  });
}
