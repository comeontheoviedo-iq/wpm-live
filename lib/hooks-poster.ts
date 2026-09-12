/**
 * Per-match HOOKS poster storage.
 * Prefer Netlify Blobs in prod; fall back to local data/hooks-posters for Air/dev.
 */
import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile, unlink, access } from "fs/promises";
import path from "path";

export const HOOKS_POSTER_MAX_BYTES = 8 * 1024 * 1024;
export const HOOKS_POSTER_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const STORE_NAME = "hooks-posters";
const LOCAL_DIR = path.join(process.cwd(), "data", "hooks-posters");

export type HooksPosterMeta = {
  exists: boolean;
  contentType?: string;
  updatedAt?: string;
  bytes?: number;
};

function blobKey(matchId: string) {
  return `match/${matchId}`;
}

function localPaths(matchId: string) {
  const safe = matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return {
    bin: path.join(LOCAL_DIR, `${safe}.bin`),
    meta: path.join(LOCAL_DIR, `${safe}.json`),
  };
}

function canUseNetlifyBlobs() {
  if (process.env.NETLIFY === "true") return true;
  if (process.env.NETLIFY_BLOBS_CONTEXT) return true;
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext
  ) {
    return true;
  }
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_AUTH_TOKEN) return true;
  return false;
}

function store() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({
      name: STORE_NAME,
      siteID,
      token,
      consistency: "strong",
    });
  }
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export function normalizeHooksPosterMime(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let mime = raw.toLowerCase().split(";")[0]!.trim();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!HOOKS_POSTER_MIME.has(mime)) return null;
  return mime;
}

export async function getHooksPosterMeta(
  matchId: string
): Promise<HooksPosterMeta> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = store();
      const meta = await s.getMetadata(blobKey(matchId));
      if (!meta) return { exists: false };
      const md = (meta.metadata || {}) as Record<string, unknown>;
      return {
        exists: true,
        contentType: String(md.contentType || "image/png"),
        updatedAt: md.updatedAt ? String(md.updatedAt) : undefined,
        bytes: typeof meta.size === "number" ? meta.size : undefined,
      };
    } catch (e) {
      console.warn("[hooks-poster] blobs meta failed, trying local", e);
    }
  }

  const { bin, meta } = localPaths(matchId);
  try {
    await access(bin);
    const raw = await readFile(meta, "utf8").catch(() => "{}");
    const parsed = JSON.parse(raw) as {
      contentType?: string;
      updatedAt?: string;
      bytes?: number;
    };
    const buf = await readFile(bin);
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

export async function getHooksPosterBytes(
  matchId: string
): Promise<{ data: Uint8Array; contentType: string; updatedAt?: string } | null> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = store();
      const result = await s.getWithMetadata(blobKey(matchId), {
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
      console.warn("[hooks-poster] blobs get failed, trying local", e);
    }
  }

  const { bin, meta } = localPaths(matchId);
  try {
    const data = new Uint8Array(await readFile(bin));
    const raw = await readFile(meta, "utf8").catch(() => "{}");
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

export async function putHooksPoster(
  matchId: string,
  data: Uint8Array,
  contentType: string
): Promise<HooksPosterMeta> {
  const mime = normalizeHooksPosterMime(contentType);
  if (!mime) throw new Error("Unsupported image type — use PNG, JPG, or WebP");
  if (data.byteLength > HOOKS_POSTER_MAX_BYTES) {
    throw new Error("Poster too large (max 8 MB)");
  }
  if (data.byteLength < 32) throw new Error("File looks empty");

  const updatedAt = new Date().toISOString();
  const metadata = { contentType: mime, updatedAt, bytes: data.byteLength };

  if (canUseNetlifyBlobs()) {
    try {
      const s = store();
      await s.set(blobKey(matchId), data, { metadata });
      return { exists: true, ...metadata };
    } catch (e) {
      console.warn("[hooks-poster] blobs put failed, writing local", e);
    }
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  const { bin, meta } = localPaths(matchId);
  await writeFile(bin, data);
  await writeFile(meta, JSON.stringify(metadata));
  return { exists: true, ...metadata };
}

export async function deleteHooksPoster(matchId: string): Promise<void> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = store();
      await s.delete(blobKey(matchId));
    } catch (e) {
      console.warn("[hooks-poster] blobs delete failed", e);
    }
  }
  const { bin, meta } = localPaths(matchId);
  await unlink(bin).catch(() => undefined);
  await unlink(meta).catch(() => undefined);
}
