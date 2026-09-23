/**
 * Strict 2-way pitch slot swap planning.
 * Occupied-slot drops must never rotate a third player.
 */

export type DirectSwapPlan = {
  placerId: string;
  targetSlot: string;
  /** Placer's slot before the drop (null/bench → occupant is cleared). */
  placerPrevSlot: string | null;
  occupantId: string | null;
  /** Where the sole occupant moves: placer's previous slot, or null to bench. */
  occupantToSlot: string | null;
};

/**
 * Plan a direct 2-way slot swap.
 * Placer → targetSlot; sole occupant → placerPrevSlot (or bench if none).
 */
export function planDirectSlotSwap(input: {
  placerId: string;
  targetSlot: string;
  placerPrevSlot?: string | null;
  occupantId?: string | null;
}): DirectSwapPlan {
  const targetSlot = String(input.targetSlot || "");
  const prev = input.placerPrevSlot ? String(input.placerPrevSlot) : null;
  const occupantId = input.occupantId ? String(input.occupantId) : null;
  // Same-slot no-op / self: no occupant move
  if (occupantId && occupantId === input.placerId) {
    return {
      placerId: input.placerId,
      targetSlot,
      placerPrevSlot: prev,
      occupantId: null,
      occupantToSlot: null,
    };
  }
  let occupantToSlot: string | null = null;
  if (occupantId) {
    // Only send occupant to prev when it is a real different slot
    occupantToSlot = prev && prev !== targetSlot ? prev : null;
  }
  return {
    placerId: input.placerId,
    targetSlot,
    placerPrevSlot: prev,
    occupantId,
    occupantToSlot,
  };
}

/**
 * Resolve intended slot overrides onto current assignments with strict 2-way
 * displacement only. Never cascades a third body onto another occupied slot:
 * if the natural 2-way home is claimed by another override, the displaced
 * player is cleared (bench) instead of rotating.
 */
export function resolveSlotOverrideAssignments(
  currentByPlayer: Map<string, string | null>,
  intendedByPlayer: Map<string, string>
): Map<string, string | null> {
  const result = new Map(currentByPlayer);
  const overrideTargets = new Set(intendedByPlayer.values());

  for (const [playerId, targetSlot] of intendedByPlayer) {
    const prev = result.get(playerId) ?? null;
    if (prev === targetSlot) continue;

    let occupantId: string | null = null;
    for (const [pid, slot] of result) {
      if (pid !== playerId && slot === targetSlot) {
        occupantId = pid;
        break;
      }
    }

    if (occupantId) {
      if (intendedByPlayer.has(occupantId)) {
        // Occupant also has an override: always vacate. Either they move to
        // their own intended slot later (mutual swap), or we steal a contested
        // slot (later writer wins) — never leave two players on one slot.
        result.set(occupantId, null);
      } else {
        const home = prev && prev !== targetSlot ? prev : null;
        if (home && !overrideTargets.has(home)) {
          let homeOcc: string | null = null;
          for (const [pid, slot] of result) {
            if (pid !== playerId && pid !== occupantId && slot === home) {
              homeOcc = pid;
              break;
            }
          }
          if (!homeOcc) {
            result.set(occupantId, home);
          } else {
            // Would rotate a third body — bench instead
            result.set(occupantId, null);
          }
        } else {
          result.set(occupantId, null);
        }
      }
    }

    result.set(playerId, targetSlot);
  }

  return result;
}
