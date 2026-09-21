/**
 * Idempotent substitution helpers.
 * Live sync re-plays every AF subst each poll — never inherit BENCH / scramble
 * first-free slots when the out-player is already off the pitch.
 */

export function isPitchFormationSlot(
  slot: string | null | undefined,
  validSlotIds?: ReadonlySet<string> | readonly string[]
): boolean {
  if (!slot || slot === "BENCH") return false;
  if (!validSlotIds) return true;
  if (validSlotIds instanceof Set) return validSlotIds.has(slot);
  return (validSlotIds as readonly string[]).includes(slot);
}

/** Slot the ON player should inherit — never BENCH / invalid. */
export function resolveInheritedSlot(
  outSlot: string | null | undefined,
  validSlotIds?: ReadonlySet<string> | readonly string[]
): string | null {
  return isPitchFormationSlot(outSlot, validSlotIds) ? (outSlot as string) : null;
}

/**
 * True when this subst was already applied to the board (out off, in on a
 * real pitch slot). Skip re-apply to avoid first-free-slot scramble.
 */
export function isSubAlreadyApplied(opts: {
  outOnPitch: boolean;
  outSlot?: string | null;
  inOnPitch?: boolean;
  inSlot?: string | null;
  validSlotIds?: ReadonlySet<string> | readonly string[];
}): boolean {
  const outOff =
    !opts.outOnPitch || opts.outSlot === "BENCH" || opts.outSlot == null;
  if (!outOff) return false;
  if (opts.inOnPitch == null && opts.inSlot == null) return true;
  if (opts.inOnPitch === false) return false;
  return isPitchFormationSlot(opts.inSlot, opts.validSlotIds);
}
