import { NextResponse } from "next/server";
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LanguageRequestRow = {
  id: string;
  languageName: string;
  note: string | null;
  userId: string | null;
  userEmail: string | null;
  createdAt: string;
};

function storeDir() {
  return join(process.cwd(), "data");
}

function jsonlPath() {
  return join(storeDir(), "language-requests.jsonl");
}

function jsonPath() {
  return join(storeDir(), "language-requests.json");
}

function appendRequest(row: LanguageRequestRow) {
  mkdirSync(storeDir(), { recursive: true });
  appendFileSync(jsonlPath(), JSON.stringify(row) + "\n", "utf8");
  let list: LanguageRequestRow[] = [];
  try {
    if (existsSync(jsonPath())) {
      list = JSON.parse(readFileSync(jsonPath(), "utf8")) as LanguageRequestRow[];
      if (!Array.isArray(list)) list = [];
    }
  } catch {
    list = [];
  }
  list.unshift(row);
  writeFileSync(jsonPath(), JSON.stringify(list.slice(0, 500), null, 2) + "\n", "utf8");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!existsSync(jsonPath())) {
      return NextResponse.json({ items: [] });
    }
    const list = JSON.parse(readFileSync(jsonPath(), "utf8")) as LanguageRequestRow[];
    return NextResponse.json({ items: Array.isArray(list) ? list.slice(0, 50) : [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  const body = await req.json().catch(() => ({}));
  const languageName = String(body.languageName || "").trim();
  const noteRaw = body.note != null ? String(body.note).trim() : "";
  if (!languageName || languageName.length < 2) {
    return NextResponse.json(
      { error: "Language name required (min 2 chars)" },
      { status: 400 }
    );
  }
  if (languageName.length > 120) {
    return NextResponse.json({ error: "Language name too long" }, { status: 400 });
  }
  if (noteRaw.length > 2000) {
    return NextResponse.json({ error: "Note too long" }, { status: 400 });
  }

  let userEmail: string | null = null;
  if (session?.id) {
    const user = await prisma.user
      .findUnique({
        where: { id: session.id },
        select: { email: true },
      })
      .catch(() => null);
    userEmail = user?.email ?? null;
  }

  const row: LanguageRequestRow = {
    id: `lr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    languageName,
    note: noteRaw || null,
    userId: session?.id ?? null,
    userEmail,
    createdAt: new Date().toISOString(),
  };

  let persisted = false;
  try {
    appendRequest(row);
    persisted = true;
  } catch (e) {
    // Serverless FS is often read-only — still accept the request via logs.
    console.error("[language-request] persist failed (log stub only)", e);
  }
  console.info("[language-request]", {
    id: row.id,
    languageName: row.languageName,
    note: row.note,
    userEmail: row.userEmail,
    persisted,
  });

  return NextResponse.json({
    ok: true,
    id: row.id,
    persisted,
    message: "Thanks — we logged your language request.",
  });
}
