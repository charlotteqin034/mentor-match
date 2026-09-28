/**
 * Stage 4 — the matching run (§9).
 *
 * Builds the full big × little score matrix (keeping every component
 * breakdown, because the organiser needs to see *why* a pair scored what it
 * did), then solves it as a linear sum assignment problem with the Hungarian
 * algorithm.
 */

import munkres from "munkres-js";
import {
  DEFAULT_WEIGHTS,
  scorePair,
  type Answers,
  type Components,
  type Side,
  type WeightKey,
  type Weights,
} from "./scoring";

/**
 * Blocked pairs get a large negative score rather than 0, so the optimiser
 * treats them as forbidden instead of merely bad — it will happily accept a
 * genuinely 0-scoring pair, but never one costing 1000.
 */
export const BLOCKED_SCORE = -1000;

export type MatchParticipant = {
  id: string;
  name: string;
  email: string;
  role: "big" | "little";
  answers: Answers | null;
  embedding?: number[] | null;
};

export type MatrixCell = {
  total: number;
  components: Components;
  applied: Record<WeightKey, number>;
  blocked: boolean;
};

export type MatchedPair = {
  big_id: string;
  little_id: string;
  total: number;
  components: Components;
  /**
   * Renormalised weight actually applied to each component for *this* pair.
   * It can differ pair to pair — someone who never submitted a trait response
   * has null trait components, so the rest of their weights redistribute.
   */
  applied: Record<WeightKey, number>;
  blocked: boolean;
  /** 1 = this little was this big's highest-scoring option of all littles. */
  big_rank_of_little: number;
  /** 1 = this big was this little's highest-scoring option of all bigs. */
  little_rank_of_big: number;
};

export type MatchResult = {
  pairs: MatchedPair[];
  unmatched_bigs: string[];
  unmatched_littles: string[];
  total_score: number;
  average_score: number;
  matrix: MatrixCell[][];
  big_ids: string[];
  little_ids: string[];
};

const blockKey = (a: string, b: string) => [a, b].sort().join("|");

export function blockedSet(pairs: { participant_a: string; participant_b: string }[]): Set<string> {
  return new Set(pairs.map((p) => blockKey(p.participant_a, p.participant_b)));
}

const toSide = (p: MatchParticipant): Side => ({
  id: p.id,
  answers: p.answers,
  embedding: p.embedding ?? null,
});

export function buildScoreMatrix(
  bigs: MatchParticipant[],
  littles: MatchParticipant[],
  weights: Weights = DEFAULT_WEIGHTS,
  blocked: Set<string> = new Set(),
): MatrixCell[][] {
  return bigs.map((big) =>
    littles.map((little) => {
      const isBlocked = blocked.has(blockKey(big.id, little.id));
      const { total, components, applied } = scorePair(toSide(big), toSide(little), weights);
      return {
        total: isBlocked ? BLOCKED_SCORE : total,
        components,
        applied,
        blocked: isBlocked,
      };
    }),
  );
}

/** Position (1-based) of `value` in a list sorted high-to-low. Ties share the better rank. */
export function rankWithin(values: number[], value: number): number {
  return values.filter((v) => v > value).length + 1;
}

export function runMatching(
  bigs: MatchParticipant[],
  littles: MatchParticipant[],
  weights: Weights = DEFAULT_WEIGHTS,
  blockedPairs: { participant_a: string; participant_b: string }[] = [],
  /** Pre-built matrix, when a caller has already adjusted the scores. */
  prebuilt?: MatrixCell[][],
): MatchResult {
  const blocked = blockedSet(blockedPairs);
  const matrix = prebuilt ?? buildScoreMatrix(bigs, littles, weights, blocked);

  const empty: MatchResult = {
    pairs: [],
    unmatched_bigs: bigs.map((m) => m.id),
    unmatched_littles: littles.map((m) => m.id),
    total_score: 0,
    average_score: 0,
    matrix,
    big_ids: bigs.map((m) => m.id),
    little_ids: littles.map((m) => m.id),
  };
  if (bigs.length === 0 || littles.length === 0) return empty;

  // Pad to a square matrix with dummy rows/columns scoring 0, so unequal
  // cohorts produce explicit "unmatched" people instead of an error.
  const size = Math.max(bigs.length, littles.length);
  const cost: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const real = r < bigs.length && c < littles.length;
      const score = real ? matrix[r][c].total : 0;
      // Hungarian minimises, so cost is the negated score.
      row.push(-score);
    }
    cost.push(row);
  }

  const assignment = munkres(cost.map((row) => [...row]));

  const columnScores: number[][] = littles.map((_, c) =>
    bigs.map((_, r) => matrix[r][c].total),
  );

  const pairs: MatchedPair[] = [];
  const matchedBigs = new Set<number>();
  const matchedLittles = new Set<number>();

  for (const [r, c] of assignment) {
    if (r >= bigs.length || c >= littles.length) continue; // padding
    matchedBigs.add(r);
    matchedLittles.add(c);
    const cell = matrix[r][c];
    pairs.push({
      big_id: bigs[r].id,
      little_id: littles[c].id,
      total: cell.total,
      components: cell.components,
      applied: cell.applied,
      blocked: cell.blocked,
      big_rank_of_little: rankWithin(
        matrix[r].map((x) => x.total),
        cell.total,
      ),
      little_rank_of_big: rankWithin(columnScores[c], cell.total),
    });
  }

  const totalScore = pairs.reduce((sum, p) => sum + p.total, 0);

  return {
    pairs,
    unmatched_bigs: bigs.filter((_, i) => !matchedBigs.has(i)).map((m) => m.id),
    unmatched_littles: littles.filter((_, i) => !matchedLittles.has(i)).map((m) => m.id),
    total_score: totalScore,
    average_score: pairs.length ? totalScore / pairs.length : 0,
    matrix,
    big_ids: bigs.map((m) => m.id),
    little_ids: littles.map((m) => m.id),
  };
}
