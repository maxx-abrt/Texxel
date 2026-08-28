/**
 * Fractional-index sort keys (§14.2) — client-side helpers.
 *
 * Keys are lowercase base36 strings that sort lexicographically. The Convex
 * `flux_documents.sortKey` field is the authoritative position once present
 * (M0.1 backfill + M3.3 read-path flip); numeric `order` remains only as a
 * legacy fallback for docs that somehow still lack a `sortKey`.
 *
 * These helpers are pure and dependency-free so they can run in the client
 * bundle (the server `flux_documents.move` mutation only persists the
 * computed key + runs the cycle guard — it never recomputes a midpoint).
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
/** Rough middle of the alphabet — used as the append/fallback digit. */
const MID_CHAR = DIGITS[Math.floor(DIGITS.length / 2)]; // 'i'
/**
 * Sentinel that sorts below every real key. Real keys from `base36Key`
 * start with a length char in the '1'..'a' range, so "0" is strictly below
 * all of them and is never itself stored as a key.
 */
const FLOOR = "0";
/** Sentinel that sorts above every practical key. */
const CEIL = "zzzzzzzzzz";

/**
 * Return a sort key strictly between `prev` and `next`.
 * `prev === null` → before everything; `next === null` → after everything.
 */
export function midKey(prev: string | null, next: string | null): string {
  if (prev === null && next === null) return MID_CHAR;
  if (prev === null) return midpointBetween(FLOOR, next!);
  if (next === null) return sortKeyAfter(prev);
  if (prev >= next) return prev + MID_CHAR;
  return midpointBetween(prev, next);
}

/**
 * Key that sorts after `after` (or a default first key when `after` is null).
 * Mirrors the server-side `sortKeyAfter` so client and server agree on the
 * "append at end" key shape.
 */
export function sortKeyAfter(after: string | null | undefined): string {
  if (!after) return "a0";
  const head = after.charCodeAt(0);
  if (head < 122 /* 'z' */) return String.fromCharCode(head + 1) + "0";
  return after + "8";
}

/**
 * Recursive digit-averaging midpoint between two keys `a < b`.
 *
 * Walks to the first differing character, picks the average digit when there
 * is room; otherwise emits the lower digit and recurses on the remainders.
 * The degenerate adjacency case (no string exists between the two bounds —
 * e.g. repeated inserts at the exact same extreme boundary ~5+ times) falls
 * back to appending `MID_CHAR` to `a`, which keeps the moved row on the
 * correct side of `a` in practice. Our key space (base36 length-prefixed
 * seeds + 'i'-appended midpoints) leaves headroom, so true adjacency does
 * not arise from normal drag reordering; a periodic renumber/rebalance pass
 * (tracked as a follow-up) is the standard LexoRank maintenance for it.
 */
function midpointBetween(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const aIdx = i < a.length ? DIGITS.indexOf(a[i]) : -1; // -1: a is a prefix of b
  const bIdx = i < b.length ? DIGITS.indexOf(b[i]) : DIGITS.length - 1;

  // Try a digit strictly between aIdx and bIdx.
  if (bIdx - aIdx > 1) {
    const mid = Math.floor((aIdx + bIdx) / 2);
    if (mid > aIdx && mid < bIdx) {
      return a.slice(0, i) + DIGITS[mid];
    }
  }

  // No room at this position.
  if (aIdx === -1) {
    // a is a prefix of b: appending a mid digit sorts after a; it sorts
    // before b whenever the mid digit is below b[i] (the common case). The
    // rare no-room case (b[i] is the min digit) is the adjacency fallback.
    return a + MID_CHAR;
  }
  // Emit a's digit and recurse on the remainders.
  return a.slice(0, i) + a[i] + midpointBetween(a.slice(i + 1), b.slice(i + 1));
}

/**
 * Client-side comparator mirroring the server `compareDocs` for optimistic
 * re-sorting of the cached `flux_documents.list` result. `sortKey` is
 * primary; `order`/`createdAt` are legacy fallbacks only.
 */
export function compareSortKeys(a: { sortKey?: string; order?: number; createdAt?: number }, b: { sortKey?: string; order?: number; createdAt?: number }): number {
  const ka = a.sortKey ?? null;
  const kb = b.sortKey ?? null;
  if (ka !== null && kb !== null) {
    if (ka !== kb) return ka < kb ? -1 : 1;
  }
  return (a.order ?? a.createdAt ?? 0) - (b.order ?? b.createdAt ?? 0);
}
