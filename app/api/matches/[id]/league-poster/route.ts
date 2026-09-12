import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteDeskPoster,
  getDeskPosterBytes,
  getDeskPosterMeta,
  normalizeDeskPosterMime,
  putDeskPoster,
  DESK_POSTER_MAX_BYTES,
} from "@/lib/desk-poster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND = "league" as const;

async function assertMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    select: { id: true },
  });
}

/** Meta JSON (?meta=1) or raw image bytes. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const match = await assertMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  if (url.searchParams.get("meta") === "1") {
    const meta = await getDeskPosterMeta(id, KIND);
    return NextResponse.json(meta);
  }

  const poster = await getDeskPosterBytes(id, KIND);
  if (!poster) {
    return NextResponse.json({ error: "No LEAGUE poster" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(poster.data), {
    status: 200,
    headers: {
      "Content-Type": poster.contentType,
      "Cache-Control": "private, max-age=60",
      "X-League-Poster-Updated": poster.updatedAt || "",
    },
  });
}

export async function HEAD(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  const meta = await getDeskPosterMeta(id, KIND);
  if (!meta.exists) return new NextResponse(null, { status: 404 });
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Content-Type": meta.contentType || "image/png",
      "X-League-Poster-Updated": meta.updatedAt || "",
    },
  });
}

/** multipart field "file" or raw body with Content-Type image/* */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const match = await assertMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  try {
    const contentTypeHeader = req.headers.get("content-type") || "";
    let bytes: Uint8Array;
    let mime: string | null;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Missing file field" },
          { status: 400 }
        );
      }
      mime = normalizeDeskPosterMime(file.type);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      if (file.size > DESK_POSTER_MAX_BYTES) {
        return NextResponse.json(
          { error: "Poster too large (max 8 MB)" },
          { status: 400 }
        );
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      mime = normalizeDeskPosterMime(contentTypeHeader);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.byteLength > DESK_POSTER_MAX_BYTES) {
        return NextResponse.json(
          { error: "Poster too large (max 8 MB)" },
          { status: 400 }
        );
      }
      bytes = buf;
    }

    const meta = await putDeskPoster(id, KIND, bytes, mime);
    return NextResponse.json({ ok: true, ...meta });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[POST league-poster]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const match = await assertMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }
  await deleteDeskPoster(id, KIND);
  return NextResponse.json({ ok: true, exists: false });
}
