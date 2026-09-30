/**
 * Per-user profile avatars.
 * Prefer Netlify Blobs in prod; fall back to local data/user-avatars for Air/dev.
 * Serve path stored on User.image (e.g. /api/auth/avatar?v=<iso>).
 *
 * Lazy Netlify Blobs / fs / path — see lib/netlify-blobs-lazy.ts (CF Worker safety).
 */
import {
  canUseNetlifyBlobs,
  getBlobStore,
  joinPath,
  nodeFs,
} from "./netlify-blobs-lazy";

export const USER_AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const USER_AVATAR_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const STORE_NAME = "user-avatars";

export type UserAvatarMeta = {
  exists: boolean;
  contentType?: string;
  updatedAt?: string;
  bytes?: number;
};

function blobKey(userId: string) {
  return `user/${userId}`;
}

async function localPaths(userId: string) {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = await joinPath(process.cwd(), "data", "user-avatars");
  return {
    bin: await joinPath(dir, `${safe}.bin`),
    meta: await joinPath(dir, `${safe}.json`),
    dir,
  };
}

async function store() {
  return getBlobStore(STORE_NAME);
}

export function normalizeUserAvatarMime(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let mime = raw.toLowerCase().split(";")[0]!.trim();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!USER_AVATAR_MIME.has(mime)) return null;
  return mime;
}

export function avatarImageUrl(updatedAt?: string | null): string {
  const v = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
  return `/api/auth/avatar?v=${v}`;
}

export async function getUserAvatarMeta(userId: string): Promise<UserAvatarMeta> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const meta = await s.getMetadata(blobKey(userId));
      if (!meta) return { exists: false };
      const md = (meta.metadata || {}) as Record<string, unknown>;
      const size = (meta as { size?: number }).size;
      return {
        exists: true,
        contentType: String(md.contentType || "image/png"),
        updatedAt: md.updatedAt ? String(md.updatedAt) : undefined,
        bytes: typeof size === "number" ? size : undefined,
      };
    } catch (e) {
      console.warn("[user-avatar] blobs meta failed, trying local", e);
    }
  }

  const { bin, meta } = await localPaths(userId);
  try {
    const fs = await nodeFs();
    await fs.access(bin);
    const raw = await fs.readFile(meta, "utf8").catch(() => "{}");
    const parsed = JSON.parse(raw) as {
      contentType?: string;
      updatedAt?: string;
      bytes?: number;
    };
    const buf = await fs.readFile(bin);
    return {
      exists: true,
      contentType: parsed.contentType || "image/png",
      updatedAt: parsed.updatedAt,
      bytes: parsed.bytes ?? buf.byteLength,
    };
  } catch {
    return { exists: false };
  }
}

export async function getUserAvatarBytes(
  userId: string
): Promise<{ data: Uint8Array; contentType: string; updatedAt?: string } | null> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const result = await s.getWithMetadata(blobKey(userId), {
        type: "arrayBuffer",
      });
      if (!result) return null;
      const md = (result.metadata || {}) as Record<string, unknown>;
      return {
        data: new Uint8Array(result.data as ArrayBuffer),
        contentType: String(md.contentType || "image/png"),
        updatedAt: md.updatedAt ? String(md.updatedAt) : undefined,
      };
    } catch (e) {
      console.warn("[user-avatar] blobs get failed, trying local", e);
    }
  }

  const { bin, meta } = await localPaths(userId);
  try {
    const fs = await nodeFs();
    const data = new Uint8Array(await fs.readFile(bin));
    const raw = await fs.readFile(meta, "utf8").catch(() => "{}");
    const parsed = JSON.parse(raw) as {
      contentType?: string;
      updatedAt?: string;
    };
    return {
      data,
      contentType: parsed.contentType || "image/png",
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function putUserAvatar(
  userId: string,
  data: Uint8Array,
  contentType: string
): Promise<UserAvatarMeta> {
  const mime = normalizeUserAvatarMime(contentType);
  if (!mime) throw new Error("Unsupported image type — use PNG, JPG, or WebP");
  if (data.byteLength > USER_AVATAR_MAX_BYTES) {
    throw new Error("Photo too large (max 2 MB)");
  }
  if (data.byteLength < 32) throw new Error("File looks empty");

  const updatedAt = new Date().toISOString();
  const metadata = {
    contentType: mime,
    updatedAt,
    bytes: data.byteLength,
  };

  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      await s.set(blobKey(userId), data, { metadata });
      return { exists: true, ...metadata };
    } catch (e) {
      console.warn("[user-avatar] blobs put failed, writing local", e);
    }
  }

  const paths = await localPaths(userId);
  const fs = await nodeFs();
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.bin, data);
  await fs.writeFile(paths.meta, JSON.stringify(metadata));
  return { exists: true, ...metadata };
}

export async function deleteUserAvatar(userId: string): Promise<void> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      await s.delete(blobKey(userId));
    } catch (e) {
      console.warn("[user-avatar] blobs delete failed", e);
    }
  }
  const { bin, meta } = await localPaths(userId);
  const fs = await nodeFs();
  await fs.unlink(bin).catch(() => undefined);
  await fs.unlink(meta).catch(() => undefined);
}

export {
  PROFILE_TIMEZONES,
  normalizeTimezone,
  initialsFromName,
} from "./profile-options";
