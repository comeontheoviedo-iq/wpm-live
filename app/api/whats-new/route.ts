import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 30;

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [posts, readRow] = await Promise.all([
      prisma.productUpdate.findMany({
        orderBy: { createdAt: "desc" },
        take: LIST_LIMIT,
        select: {
          id: true,
          title: true,
          body: true,
          createdAt: true,
        },
      }),
      prisma.userProductUpdateRead.findUnique({
        where: { userId: session.id },
        select: { lastReadAt: true },
      }),
    ]);

    const lastReadAt = readRow?.lastReadAt ?? null;
    const unreadCount = lastReadAt
      ? posts.filter((p) => p.createdAt > lastReadAt).length
      : posts.length;

    return NextResponse.json({
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        createdAt: p.createdAt.toISOString(),
      })),
      unreadCount,
      lastReadAt: lastReadAt?.toISOString() ?? null,
      canCreate: isOwnerEmail(session),
    });
  } catch (e) {
    console.error("[whats-new GET]", e);
    return NextResponse.json({ error: "Could not load updates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession().catch(() => null);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOwnerEmail(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  if (!title || title.length < 2) {
    return NextResponse.json({ error: "Title required (min 2 chars)" }, { status: 400 });
  }
  if (!text || text.length < 3) {
    return NextResponse.json({ error: "Body required (min 3 chars)" }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Title too long" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Body too long" }, { status: 400 });
  }

  try {
    const post = await prisma.productUpdate.create({
      data: {
        title,
        body: text,
        createdByUserId: session.id,
      },
      select: {
        id: true,
        title: true,
        body: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      ok: true,
      post: {
        id: post.id,
        title: post.title,
        body: post.body,
        createdAt: post.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[whats-new POST]", e);
    return NextResponse.json({ error: "Could not create update" }, { status: 500 });
  }
}
