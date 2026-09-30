/**
 * Lazy Netlify Blobs + Node fs/path accessors.
 *
 * OpenNext on Cloudflare Workers must not evaluate top-level
 * `import "@netlify/blobs"` / `fs/promises` / `path` — those Node-only
 * modules crash the isolate (CF error 1101) and surface as Next.js
 * "Application error: a client-side exception has occurred" when a
 * match desk (or any route sharing the worker graph) loads.
 *
 * Call these only inside async functions, and only when needed.
 */

export function canUseNetlifyBlobs(): boolean {
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

type BlobStore = {
  getMetadata: (key: string) => Promise<{
    metadata?: Record<string, unknown>;
    size?: number;
  } | null>;
  getWithMetadata: (
    key: string,
    opts: { type: "arrayBuffer" }
  ) => Promise<{
    data: ArrayBuffer;
    metadata?: Record<string, unknown>;
  } | null>;
  set: (
    key: string,
    data: Uint8Array,
    opts: { metadata: Record<string, unknown> }
  ) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

export async function getBlobStore(storeName: string): Promise<BlobStore> {
  const { getStore } = await import("@netlify/blobs");
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({
      name: storeName,
      siteID,
      token,
      consistency: "strong",
    }) as unknown as BlobStore;
  }
  return getStore({
    name: storeName,
    consistency: "strong",
  }) as unknown as BlobStore;
}

export async function nodeFs() {
  return import("fs/promises");
}

export async function nodePath() {
  return import("path");
}

/** Join under process.cwd()/data/... without a top-level path import. */
export async function dataDir(...parts: string[]): Promise<string> {
  const path = await nodePath();
  return path.join(process.cwd(), "data", ...parts);
}

export async function joinPath(...parts: string[]): Promise<string> {
  const path = await nodePath();
  return path.join(...parts);
}
