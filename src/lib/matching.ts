/**
 * Stage 4 — the matching run (§9).
 *
 * Builds the full mentor × mentee score matrix (keeping every component
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
  role: "mentor" | "mentee";
  display_number: number | null;
  answers: Answers | null;
  embedding?: number[] | null;
  ranks: { rankedId: string; rank: number }[];
};

export type MatrixCell = {
  total: number;
  components: Components;
  applied: Record<WeightKey, number>;
  blocked: boolean;
};

export type MatchedPair = {
  mentor_id: string;
  mentee_id: string;
  total: number;
  components: Components;
  /**
   * Renormalised weight actually applied to each component for *this* pair.
   * It can differ pair to pair — someone who never submitted a trait response
   * has null trait components, so the rest of their weights redistribute.
   */
  applied: Record<WeightKey, number>;
  blocked: boolean;
  /** 1 = this mentee was this mentor's highest-scoring option of all mentees. */
  mentor_rank_of_mentee: number;
  /** 1 = this mentor was this mentee's highest-scoring option of all mentors. */
  mentee_rank_of_mentor: number;
};

export type MatchResult = {
  pairs: MatchedPair[];
  unmatched_mentors: string[];
  unmatched_mentees: string[];
  total_score: number;
  average_score: number;
  matrix: MatrixCell[][];
  mentor_ids: string[];
  mentee_ids: string[];
};

const blockKey = (a: string, b: string) => [a, b].sort().join("|");

export function blockedSet(pairs: { participant_a: string; participant_b: string }[]): Set<string> {
  return new Set(pairs.map((p) => blockKey(p.participant_a, p.participant_b)));
}

const toSide = (p: MatchParticipant): Side => ({
  id: p.id,
  answers: p.answers,
  embedding: p.embedding ?? null,
  ranks: p.ranks,
});

export function buildScoreMatrix(
  mentors: MatchParticipant[],
  mentees: MatchParticipant[],
  weights: Weights = DEFAULT_WEIGHTS,
  blocked: Set<string> = new Set(),
): MatrixCell[][] {
  return mentors.map((mentor) =>
    mentees.map((mentee) => {
      const isBlocked = blocked.has(blockKey(mentor.id, mentee.id));
      const { total, components, applied } = scorePair(toSide(mentor), toSide(mentee), weights);
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
  mentors: MatchParticipant[],
  mentees: MatchParticipant[],
  weights: Weights = DEFAULT_WEIGHTS,
  blockedPairs: { participant_a: string; participant_b: string }[] = [],
): MatchResult {
  const blocked = blockedSet(blockedPairs);
  const matrix = buildScoreMatrix(mentors, mentees, weights, blocked);

  const empty: MatchResult = {
    pairs: [],
    unmatched_mentors: mentors.map((m) => m.id),
    unmatched_mentees: mentees.map((m) => m.id),
    total_score: 0,
    average_score: 0,
    matrix,
    mentor_ids: mentors.map((m) => m.id),
    mentee_ids: mentees.map((m) => m.id),
  };
  if (mentors.length === 0 || mentees.length === 0) return empty;

  // Pad to a square matrix with dummy rows/columns scoring 0, so unequal
  // cohorts produce explicit "unmatched" people instead of an error.
  const size = Math.max(mentors.length, mentees.length);
  const cost: number[][] = [];
  for (let r = 0; r < size; r++) {
    const row: number[] = [];
    for (let c = 0; c < size; c++) {
      const real = r < mentors.length && c < mentees.length;
      const score = real ? matrix[r][c].total : 0;
      // Hungarian minimises, so cost is the negated score.
      row.push(-score);
    }
    cost.push(row);
  }

  const assignment = munkres(cost.map((row) => [...row]));

  const columnScores: number[][] = mentees.map((_, c) =>
    mentors.map((_, r) => matrix[r][c].total),
  );

  const pairs: MatchedPair[] = [];
  const matchedMentors = new Set<number>();
  const matchedMentees = new Set<number>();

  for (const [r, c] of assignment) {
    if (r >= mentors.length || c >= mentees.length) continue; // padding
    matchedMentors.add(r);
    matchedMentees.add(c);
    const cell = matrix[r][c];
    pairs.push({
      mentor_id: mentors[r].id,
      mentee_id: mentees[c].id,
      total: cell.total,
      components: cell.components,
      applied: cell.applied,
      blocked: cell.blocked,
      mentor_rank_of_mentee: rankWithin(
        matrix[r].map((x) => x.total),
        cell.total,
      ),
      mentee_rank_of_mentor: rankWithin(columnScores[c], cell.total),
    });
  }

  const totalScore = pairs.reduce((sum, p) => sum + p.total, 0);

  return {
    pairs,
    unmatched_mentors: mentors.filter((_, i) => !matchedMentors.has(i)).map((m) => m.id),
    unmatched_mentees: mentees.filter((_, i) => !matchedMentees.has(i)).map((m) => m.id),
    total_score: totalScore,
    average_score: pairs.length ? totalScore / pairs.length : 0,
    matrix,
    mentor_ids: mentors.map((m) => m.id),
    mentee_ids: mentees.map((m) => m.id),
  };
}
