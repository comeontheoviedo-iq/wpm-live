/**
 * CoComms shared intelligence pool — preference gate + stubs.
 *
 * Product rules (see docs/SHARED_INTEL_OPTIN.md):
 * - Default OFF (`User.sharedIntelOptIn = false`).
 * - Personal desks/notes stay locked to session.userId regardless of this flag.
 * - When ON, only anonymised aggregates may enter the shared pool — never raw notes.
 * - No external send pipeline in this pass: prefer / enqueue stubs only.
 */

import { prisma } from "@/lib/prisma";

/** Read account opt-in. Missing user → false (safe default). */
export async function isSharedIntelOptedIn(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { sharedIntelOptIn: true },
  });
  return Boolean(row?.sharedIntelOptIn);
}

/**
 * TODO(shared-intel): anonymise note signals into pool aggregates.
 * Must no-op unless `sharedIntelOptIn` is true. Must never transmit raw note body/title.
 * Stub — does not send anywhere.
 */
export async function enqueueAnonymisedNoteSignal(_args: {
  userId: string;
  /** Opaque category / entity tags only — never raw text in a future impl without scrubbing. */
  signalStub?: { category?: string; entityType?: string };
}): Promise<{ enqueued: false; reason: string }> {
  // Intentionally unused until anonymisation pipeline ships.
  void _args;
  return {
    enqueued: false,
    reason: "TODO: shared-intel anonymisation pipeline not implemented — preference only",
  };
}

/**
 * TODO(shared-intel): background job entry that reads opted-in users and
 * contributes anonymised aggregates. Do not call from note save paths yet.
 */
export async function runSharedIntelPoolTick(): Promise<{ processed: number; stub: true }> {
  return { processed: 0, stub: true };
}
