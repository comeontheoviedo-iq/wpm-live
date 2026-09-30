/**
 * Per-user player photos (UserPlayerAlias.photoUrl).
 * Prefer Netlify Blobs in prod; fall back to local data/player-alias-photos for Air/dev.
 *
 * Lazy Netlify Blobs / fs / path — see lib/netlify-blobs-lazy.ts (CF Worker safety).
 */
import {
  canUseNetlifyBlobs,
  getBlobStore,
  joinPath,
  nodeFs,
} from "./netlify-blobs-lazy";

export const PLAYER_ALIAS_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PLAYER_ALIAS_PHOTO_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const STORE_NAME = "player-alias-photos";

export type PlayerAliasPhotoMeta = {
  exists: boolean;
  contentType?: string;
  updatedAt?: string;
  bytes?: number;
};

function blobKey(userId: string, apiFootballPlayerId: number) {
  return `user/${userId}/af/${apiFootballPlayerId}`;
}

async function localPaths(userId: string, apiFootballPlayerId: number) {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const base = `${safeUser}-${apiFootballPlayerId}`;
  const dir = await joinPath(process.cwd(), "data", "player-alias-photos");
  return {
    bin: await joinPath(dir, `${base}.bin`),
    meta: await joinPath(dir, `${base}.json`),
    dir,
  };
}

async function store() {
  return getBlobStore(STORE_NAME);
}

export function normalizePlayerAliasPhotoMime(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let mime = raw.toLowerCase().split(";")[0]!.trim();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!PLAYER_ALIAS_PHOTO_MIME.has(mime)) return null;
  return mime;
}

export function playerAliasPhotoUrl(
  apiFootballPlayerId: number,
  updatedAt?: string | null
): string {
  const v = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
  return `/api/player-aliases/photo?af=${apiFootballPlayerId}&v=${v}`;
}

export async function getPlayerAliasPhotoMeta(
  userId: string,
  apiFootballPlayerId: number
): Promise<PlayerAliasPhotoMeta> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const meta = await s.getMetadata(blobKey(userId, apiFootballPlayerId));
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
      console.warn("[player-alias-photo] blobs meta failed, trying local", e);
    }
  }

  const { bin, meta } = await localPaths(userId, apiFootballPlayerId);
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

export async function getPlayerAliasPhotoBytes(
  userId: string,
  apiFootballPlayerId: number
): Promise<{ data: Uint8Array; contentType: string; updatedAt?: string } | null> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const result = await s.getWithMetadata(blobKey(userId, apiFootballPlayerId), {
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
      console.warn("[player-alias-photo] blobs get failed, trying local", e);
    }
  }

  const { bin, meta } = await localPaths(userId, apiFootballPlayerId);
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

export async function putPlayerAliasPhoto(
  userId: string,
  apiFootballPlayerId: number,
  data: Uint8Array,
  contentType: string
): Promise<PlayerAliasPhotoMeta> {
  const mime = normalizePlayerAliasPhotoMime(contentType);
  if (!mime) throw new Error("Unsupported image type — use PNG, JPG, or WebP");
  if (data.byteLength > PLAYER_ALIAS_PHOTO_MAX_BYTES) {
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
      await s.set(blobKey(userId, apiFootballPlayerId), data, { metadata });
      return { exists: true, ...metadata };
    } catch (e) {
      console.warn("[player-alias-photo] blobs put failed, writing local", e);
    }
  }

  const paths = await localPaths(userId, apiFootballPlayerId);
  const fs = await nodeFs();
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.bin, data);
  await fs.writeFile(paths.meta, JSON.stringify(metadata));
  return { exists: true, ...metadata };
}

export async function deletePlayerAliasPhoto(
  userId: string,
  apiFootballPlayerId: number
): Promise<void> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      await s.delete(blobKey(userId, apiFootballPlayerId));
    } catch (e) {
      console.warn("[player-alias-photo] blobs delete failed", e);
    }
  }
  const { bin, meta } = await localPaths(userId, apiFootballPlayerId);
  const fs = await nodeFs();
  await fs.unlink(bin).catch(() => undefined);
  await fs.unlink(meta).catch(() => undefined);
}
