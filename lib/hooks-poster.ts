/**
 * Back-compat HOOKS poster API — delegates to desk-poster kind "hooks".
 */
export {
  DESK_POSTER_MAX_BYTES as HOOKS_POSTER_MAX_BYTES,
  DESK_POSTER_MIME as HOOKS_POSTER_MIME,
  type DeskPosterMeta as HooksPosterMeta,
} from "./desk-poster";

import {
  deleteDeskPoster,
  getDeskPosterBytes,
  getDeskPosterMeta,
  normalizeDeskPosterMime,
  putDeskPoster,
  type DeskPosterMeta,
} from "./desk-poster";

export const normalizeHooksPosterMime = normalizeDeskPosterMime;

export async function getHooksPosterMeta(matchId: string): Promise<DeskPosterMeta> {
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
