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
  mentorId: string,
  menteeId: string,
): MatchedPair | null {
  const r = result.mentor_ids.indexOf(mentorId);
  const c = result.mentee_ids.indexOf(menteeId);
  const cell: MatrixCell | undefined = result.matrix[r]?.[c];
  if (!cell) return null;
  return {
    mentor_id: mentorId,
    mentee_id: menteeId,
    total: cell.total,
    components: cell.components,
    applied: cell.applied,
    blocked: cell.blocked,
    mentor_rank_of_mentee: rankWithin(
      result.matrix[r].map((x) => x.total),
      cell.total,
    ),
    mentee_rank_of_mentor: rankWithin(
      result.matrix.map((row) => row[c].total),
      cell.total,
    ),
  };
}

/** Swaps the mentees of two pairs, returning the new list and the score delta. */
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

  const newA = pairAt(result, a.mentor_id, b.mentee_id);
  const newB = pairAt(result, b.mentor_id, a.mentee_id);
  if (!newA || !newB) return { pairs: next, delta: 0 };

  next[indexA] = newA;
  next[indexB] = newB;
  return { pairs: next, delta: newA.total + newB.total - (a.total + b.total) };
}
