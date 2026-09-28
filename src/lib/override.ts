/**
 * Manual override (§10) — the organiser knows things the survey doesn't.
 *
 * Kept apart from lib/matching so the admin UI can import it without pulling
 * the Hungarian solver into the browser bundle. Everything here reads from the
 * score matrix a run already produced, so a swap is instant.
 */

import type { MatchResult, MatchedPair, MatrixCell } from "./matching";

function rankWithin(values: number[], value: number): number {
  return values.filter((v) => v > value).length + 1;
}

export function pairAt(
  result: MatchResult,
  bigId: string,
  littleId: string,
): MatchedPair | null {
  const r = result.big_ids.indexOf(bigId);
  const c = result.little_ids.indexOf(littleId);
  const cell: MatrixCell | undefined = result.matrix[r]?.[c];
  if (!cell) return null;
  return {
    big_id: bigId,
    little_id: littleId,
    total: cell.total,
    components: cell.components,
    applied: cell.applied,
    blocked: cell.blocked,
    big_rank_of_little: rankWithin(
      result.matrix[r].map((x) => x.total),
      cell.total,
    ),
    little_rank_of_big: rankWithin(
      result.matrix.map((row) => row[c].total),
      cell.total,
    ),
  };
}

/** Swaps the littles of two pairs, returning the new list and the score delta. */
export function swapPairs(
  result: MatchResult,
  pairs: MatchedPair[],
  indexA: number,
  indexB: number,
): { pairs: MatchedPair[]; delta: number } {
  const next = [...pairs];
  const a = next[indexA];
  const b = next[indexB];
  if (!a || !b || indexA === indexB) return { pairs: next, delta: 0 };

  const newA = pairAt(result, a.big_id, b.little_id);
  const newB = pairAt(result, b.big_id, a.little_id);
  if (!newA || !newB) return { pairs: next, delta: 0 };

  next[indexA] = newA;
  next[indexB] = newB;
  return { pairs: next, delta: newA.total + newB.total - (a.total + b.total) };
}
