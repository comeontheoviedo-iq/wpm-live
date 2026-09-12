import { NextResponse } from "next/server";
import { createSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  avatarImageUrl,
  deleteUserAvatar,
  getUserAvatarBytes,
  normalizeUserAvatarMime,
  putUserAvatar,
  USER_AVATAR_MAX_BYTES,
} from "@/lib/user-avatar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Own avatar bytes only — tenancy: session user id. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const poster = await getUserAvatarBytes(session.id);
  if (!poster) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(poster.data), {
    status: 200,
    headers: {
      "Content-Type": poster.contentType,
      "Cache-Control": "private, max-age=60",
      "X-Avatar-Updated": poster.updatedAt || "",
    },
  });
}

/** multipart field "file" or raw body with Content-Type image/* */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      mime = normalizeUserAvatarMime(file.type);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      if (file.size > USER_AVATAR_MAX_BYTES) {
        return NextResponse.json(
          { error: "Photo too large (max 2 MB)" },
          { status: 400 }
        );
      }
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      mime = normalizeUserAvatarMime(contentTypeHeader);
      if (!mime) {
        return NextResponse.json(
          { error: "Unsupported image type — use PNG, JPG, or WebP" },
          { status: 400 }
        );
      }
      const buf = new Uint8Array(await req.arrayBuffer());
      if (buf.byteLength > USER_AVATAR_MAX_BYTES) {
        return NextResponse.json(
          { error: "Photo too large (max 2 MB)" },
          { status: 400 }
        );
      }
      bytes = buf;
    }

    const meta = await putUserAvatar(session.id, bytes, mime);
    const image = avatarImageUrl(meta.updatedAt);
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { image },
      select: {
        id: true,
        email: true,
        name: true,
        avatarInitials: true,
        theme: true,
        image: true,
        bio: true,
        timezone: true,
      },
    });

    await createSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarInitials: updated.avatarInitials,
      theme: updated.theme,
      image: updated.image,
    });

    return NextResponse.json({
      ok: true,
      ...meta,
      image: updated.image,
      user: updated,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[POST auth/avatar]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteUserAvatar(session.id);
  const updated = await prisma.user.update({
    where: { id: session.id },
    data: { image: null },
    select: {
      id: true,
      email: true,
      name: true,
      avatarInitials: true,
      theme: true,
      image: true,
      bio: true,
      timezone: true,
    },
  });

  await createSession({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    avatarInitials: updated.avatarInitials,
    theme: updated.theme,
    image: null,
  });

  return NextResponse.json({ ok: true, exists: false, image: null, user: updated });
}
