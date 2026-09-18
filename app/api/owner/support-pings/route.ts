import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const session = await getSession().catch(() => null);
  if (!session?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isOwnerEmail(session)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate && gate.error) return gate.error;

  const url = new URL(req.url);
  const statusRaw = (url.searchParams.get("status") || "open").trim().toLowerCase();
  const status =
    statusRaw === "all" || statusRaw === "*"
      ? null
      : statusRaw === "resolved"
        ? "resolved"
        : "open";
  const limitRaw = Number(url.searchParams.get("limit") || "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), 200)
    : 50;

  try {
    const rows = await prisma.supportPing.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    const items = rows.map((r) => {
      let context: unknown = null;
      if (r.context) {
        try {
          context = JSON.parse(r.context);
        } catch {
          context = r.context;
        }
      }
      return {
        id: r.id,
        type: r.type,
        message: r.message,
        context,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        resolvedBy: r.resolvedBy,
        user: r.user,
      };
    });

    return NextResponse.json({ items, count: items.length, status: status ?? "all" });
  } catch (e) {
    console.error("[owner/support-pings] GET failed", e);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const gate = await requireOwner();
  if ("error" in gate && gate.error) return gate.error;
  const session = gate.session!;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const statusRaw = String(body.status || "resolved").trim().toLowerCase();
  if (statusRaw !== "resolved" && statusRaw !== "open") {
    return NextResponse.json(
      { error: "status must be open or resolved" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.supportPing.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.supportPing.update({
      where: { id },
      data:
        statusRaw === "resolved"
          ? {
              status: "resolved",
              resolvedAt: new Date(),
              resolvedBy: session.email,
            }
          : {
              status: "open",
              resolvedAt: null,
              resolvedBy: null,
            },
      select: {
        id: true,
        status: true,
        resolvedAt: true,
        resolvedBy: true,
      },
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
      resolvedBy: updated.resolvedBy,
    });
  } catch (e) {
    console.error("[owner/support-pings] PATCH failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
