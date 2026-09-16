import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deletePlayerAliasPhoto,
  getPlayerAliasPhotoBytes,
  normalizePlayerAliasPhotoMime,
  playerAliasPhotoUrl,
  putPlayerAliasPhoto,
  PLAYER_ALIAS_PHOTO_MAX_BYTES,
} from "@/lib/player-alias-photo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseAfId(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/** Own alias photo bytes — tenancy: session user id + af player id. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const af = parseAfId(url.searchParams.get("af"));
  if (!af) return NextResponse.json({ error: "af required" }, { status: 400 });

  const poster = await getPlayerAliasPhotoBytes(session.id, af);
  if (!poster) return NextResponse.json({ error: "No photo" }, { status: 404 });

  return new NextResponse(Buffer.from(poster.data), {
    status: 200,
    headers: {
      "Content-Type": poster.contentType,
      "Cache-Control": "private, max-age=60",
      "X-Photo-Updated": poster.updatedAt || "",
    },
  });
}

/** multipart field "file"; query ?af=<apiFootballPlayerId> */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const af = parseAfId(url.searchParams.get("af"));
  if (!af) return NextResponse.json({ error: "af required" }, { status: 400 });

  try {
    const contentTypeHeader = req.headers.get("content-type") || "";
    let bytes: Uint8Array;
    let mime: string | null;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file field" }, { status: 400 });
      }
      mime = normalizePlayerAliasPhotoMime(file.type);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      if (file.size > PLAYER_ALIAS_PHOTO_MAX_BYTES) {
        return NextResponse.json(
          { error: "Photo too large (max 2 MB)" },
          { status: 400 }
        );
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      mime = normalizePlayerAliasPhotoMime(contentTypeHeader);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.byteLength > PLAYER_ALIAS_PHOTO_MAX_BYTES) {
        return NextResponse.json(
          { error: "Photo too large (max 2 MB)" },
          { status: 400 }
        );
      }
      bytes = buf;
    }

    const meta = await putPlayerAliasPhoto(session.id, af, bytes, mime);
    const photoUrl = playerAliasPhotoUrl(af, meta.updatedAt);
    const alias = await prisma.userPlayerAlias.upsert({
      where: {
        userId_apiFootballPlayerId: {
          userId: session.id,
          apiFootballPlayerId: af,
        },
      },
      create: {
        userId: session.id,
        apiFootballPlayerId: af,
        photoUrl,
      },
      update: { photoUrl },
    });

    return NextResponse.json({
      ok: true,
      ...meta,
      photoUrl: alias.photoUrl,
      alias,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[POST player-aliases/photo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const af = parseAfId(url.searchParams.get("af"));
  if (!af) return NextResponse.json({ error: "af required" }, { status: 400 });

  await deletePlayerAliasPhoto(session.id, af);
  const existing = await prisma.userPlayerAlias.findUnique({
    where: {
      userId_apiFootballPlayerId: {
        userId: session.id,
        apiFootballPlayerId: af,
      },
    },
  });
  if (existing) {
    if (!existing.displayName) {
      await prisma.userPlayerAlias.delete({ where: { id: existing.id } });
      return NextResponse.json({ ok: true, photoUrl: null, cleared: true });
    }
    await prisma.userPlayerAlias.update({
      where: { id: existing.id },
      data: { photoUrl: null },
    });
  }
  return NextResponse.json({ ok: true, photoUrl: null });
}
