/**
 * Per-match desk posters (HOOKS, LEAGUE).
 * Prefer Netlify Blobs in prod; fall back to local data/desk-posters for Air/dev.
 * HOOKS keeps legacy blob key `match/{id}` and local `data/hooks-posters` for
 * existing uploads; LEAGUE uses `match/{id}/league`.
 *
 * Netlify Blobs / fs / path are loaded lazily — see lib/netlify-blobs-lazy.ts —
 * so OpenNext Cloudflare Workers do not crash on module evaluate (CF 1101).
 */
import {
  canUseNetlifyBlobs,
  getBlobStore,
  joinPath,
  nodeFs,
} from "./netlify-blobs-lazy";

export type DeskPosterKind = "hooks" | "league";

export const DESK_POSTER_MAX_BYTES = 8 * 1024 * 1024;
export const DESK_POSTER_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const STORE_NAME = "hooks-posters";

export type DeskPosterMeta = {
  exists: boolean;
  contentType?: string;
  updatedAt?: string;
  bytes?: number;
  kind?: DeskPosterKind;
};

function blobKey(matchId: string, kind: DeskPosterKind) {
  return kind === "hooks" ? `match/${matchId}` : `match/${matchId}/${kind}`;
}

async function localPaths(matchId: string, kind: DeskPosterKind) {
  const safe = matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (kind === "hooks") {
    const dir = await joinPath(process.cwd(), "data", "hooks-posters");
    return {
      bin: await joinPath(dir, `${safe}.bin`),
      meta: await joinPath(dir, `${safe}.json`),
      dir,
    };
  }
  const dir = await joinPath(process.cwd(), "data", "desk-posters");
  return {
    bin: await joinPath(dir, `${safe}-${kind}.bin`),
    meta: await joinPath(dir, `${safe}-${kind}.json`),
    dir,
  };
}

async function store() {
  return getBlobStore(STORE_NAME);
}

export function normalizeDeskPosterMime(
  raw: string | null | undefined
): string | null {
  if (!raw) return null;
  let mime = raw.toLowerCase().split(";")[0]!.trim();
  if (mime === "image/jpg") mime = "image/jpeg";
  if (!DESK_POSTER_MIME.has(mime)) return null;
  return mime;
}

export function parseDeskPosterKind(
  raw: string | null | undefined
): DeskPosterKind | null {
  const k = (raw || "").toLowerCase().trim();
  if (k === "hooks" || k === "league") return k;
  return null;
}

export async function getDeskPosterMeta(
  matchId: string,
  kind: DeskPosterKind
): Promise<DeskPosterMeta> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const meta = await s.getMetadata(blobKey(matchId, kind));
      if (!meta) return { exists: false, kind };
      const md = (meta.metadata || {}) as Record<string, unknown>;
      return {
        exists: true,
        kind,
        contentType: String(md.contentType || "image/png"),
        updatedAt: md.updatedAt ? String(md.updatedAt) : undefined,
        bytes: typeof meta.size === "number" ? meta.size : undefined,
      };
    } catch (e) {
      console.warn(`[desk-poster] blobs meta failed (${kind}), trying local`, e);
    }
  }

  const { bin, meta } = await localPaths(matchId, kind);
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
      kind,
      contentType: parsed.contentType || "image/png",
      updatedAt: parsed.updatedAt,
      bytes: parsed.bytes ?? buf.byteLength,
    };
  } catch {
    return { exists: false, kind };
  }
}

export async function getDeskPosterBytes(
  matchId: string,
  kind: DeskPosterKind
): Promise<{ data: Uint8Array; contentType: string; updatedAt?: string } | null> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      const result = await s.getWithMetadata(blobKey(matchId, kind), {
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
      console.warn(`[desk-poster] blobs get failed (${kind}), trying local`, e);
    }
  }

  const { bin, meta } = await localPaths(matchId, kind);
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

export async function putDeskPoster(
  matchId: string,
  kind: DeskPosterKind,
  data: Uint8Array,
  contentType: string
): Promise<DeskPosterMeta> {
  const mime = normalizeDeskPosterMime(contentType);
  if (!mime) throw new Error("Unsupported image type — use PNG, JPG, or WebP");
  if (data.byteLength > DESK_POSTER_MAX_BYTES) {
    throw new Error("Poster too large (max 8 MB)");
  }
  if (data.byteLength < 32) throw new Error("File looks empty");

  const updatedAt = new Date().toISOString();
  const metadata = { contentType: mime, updatedAt, bytes: data.byteLength, kind };

  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      await s.set(blobKey(matchId, kind), data, { metadata });
      return { exists: true, ...metadata };
    } catch (e) {
      console.warn(`[desk-poster] blobs put failed (${kind}), writing local`, e);
    }
  }

  const paths = await localPaths(matchId, kind);
  const fs = await nodeFs();
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.bin, data);
  await fs.writeFile(paths.meta, JSON.stringify(metadata));
  return { exists: true, ...metadata };
}

export async function deleteDeskPoster(
  matchId: string,
  kind: DeskPosterKind
): Promise<void> {
  if (canUseNetlifyBlobs()) {
    try {
      const s = await store();
      await s.delete(blobKey(matchId, kind));
    } catch (e) {
      console.warn(`[desk-poster] blobs delete failed (${kind})`, e);
    }
  }
  const { bin, meta } = await localPaths(matchId, kind);
  const fs = await nodeFs();
  await fs.unlink(bin).catch(() => undefined);
  await fs.unlink(meta).catch(() => undefined);
}

export const HOOKS_POSTER_MAX_BYTES = DESK_POSTER_MAX_BYTES;
export const HOOKS_POSTER_MIME = DESK_POSTER_MIME;
export type HooksPosterMeta = DeskPosterMeta;
export const normalizeHooksPosterMime = normalizeDeskPosterMime;
export async function getHooksPosterMeta(matchId: string) {
  return getDeskPosterMeta(matchId, "hooks");
}
export async function getHooksPosterBytes(matchId: string) {
  return getDeskPosterBytes(matchId, "hooks");
}
export async function putHooksPoster(
  matchId: string,
  data: Uint8Array,
  contentType: string
) {
  return putDeskPoster(matchId, "hooks", data, contentType);
}
export async function deleteHooksPoster(matchId: string) {
  return deleteDeskPoster(matchId, "hooks");
}
