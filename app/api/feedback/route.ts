import { NextResponse } from "next/server";
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type FeedbackType = "bug" | "improvement" | "other";

type FeedbackRow = {
  id: string;
  type: FeedbackType;
  message: string;
  pageUrl: string | null;
  matchId: string | null;
  userAgent: string | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
};

function feedbackDir() {
  return join(process.cwd(), "data");
}

function feedbackPath() {
  return join(feedbackDir(), "feedback.jsonl");
}

function feedbackJsonPath() {
  return join(feedbackDir(), "feedback.json");
}

function appendFeedback(row: FeedbackRow) {
  mkdirSync(feedbackDir(), { recursive: true });
  appendFileSync(feedbackPath(), JSON.stringify(row) + "\n", "utf8");
  // Also keep a small JSON array mirror for easy reading (cap 500)
  let list: FeedbackRow[] = [];
  try {
    if (existsSync(feedbackJsonPath())) {
      list = JSON.parse(readFileSync(feedbackJsonPath(), "utf8")) as FeedbackRow[];
      if (!Array.isArray(list)) list = [];
    }
  } catch {
    list = [];
  }
  list.unshift(row);
  writeFileSync(feedbackJsonPath(), JSON.stringify(list.slice(0, 500), null, 2) + "\n", "utf8");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!existsSync(feedbackJsonPath())) {
      return NextResponse.json({ items: [] });
    }
    const list = JSON.parse(readFileSync(feedbackJsonPath(), "utf8")) as FeedbackRow[];
    return NextResponse.json({ items: Array.isArray(list) ? list.slice(0, 50) : [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  const body = await req.json().catch(() => ({}));
  const typeRaw = String(body.type || "other").toLowerCase();
  const type: FeedbackType =
    typeRaw === "bug" || typeRaw === "improvement" ? typeRaw : "other";
  const message = String(body.message || "").trim();
  if (!message || message.length < 3) {
    return NextResponse.json({ error: "Message required (min 3 chars)" }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  let userEmail: string | null = null;
  if (session?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { email: true },
    }).catch(() => null);
    userEmail = user?.email ?? null;
  }

  const row: FeedbackRow = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    pageUrl: body.pageUrl ? String(body.pageUrl).slice(0, 2000) : null,
    matchId: body.matchId ? String(body.matchId).slice(0, 64) : null,
    userAgent: body.userAgent
      ? String(body.userAgent).slice(0, 500)
      : req.headers.get("user-agent")?.slice(0, 500) || null,
    userId: session?.id ?? null,
    userEmail,
    createdAt: new Date().toISOString(),
  };

  try {
    appendFeedback(row);
  } catch (e) {
    console.error("[feedback]", e);
    return NextResponse.json({ error: "Could not store feedback" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    message: "Thanks — feedback saved. (Netlify Forms / Stripe-era inbox later.)",
  });
}
