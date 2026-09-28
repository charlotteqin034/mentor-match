/**
 * Stage 3 candidate shortlists.
 *
 * Rather than showing everyone all ~25 profiles from the other side, the
 * organiser generates each person a shortlist of the best-scoring candidates
 * and they rank within it. Two reasons this is better than ranking everyone:
 * reading 25 cards is a chore people do badly, and a ranking drawn from the
 * whole cohort mostly re-expresses whatever the trait scores already said.
 *
 * The shortlist is built from every component *except* ranking — no rankings
 * exist yet when it runs.
 */

import { BLOCKED_SCORE, type MatchParticipant } from "./matching";
import { scorePair, type Components, type Weights } from "./scoring";

/** How many candidates each person is offered. */
export const SHORTLIST_SIZE = 5;
/** How many of those they must put in order. */
export const RANK_COUNT = 3;

export type ShortlistEntry = {
  participant_id: string;
  candidate_id: string;
  position: number;
  score: number;
  components: Components;
};

const blockKey = (a: string, b: string) => [a, b].sort().join("|");

/** Weights with the ranking component switched off — nothing has been ranked yet. */
export function preRankingWeights(weights: Weights): Weights {
  return { ...weights, ranking: 0 };
}

function shortlistFor(
  person: MatchParticipant,
  candidates: MatchParticipant[],
  weights: Weights,
  blocked: Set<string>,
  size: number,
): ShortlistEntry[] {
  return candidates
    .filter((c) => !blocked.has(blockKey(person.id, c.id)))
    .map((candidate) => {
      const { total, components } = scorePair(
        { id: person.id, answers: person.answers, embedding: person.embedding, ranks: [] },
        { id: candidate.id, answers: candidate.answers, embedding: candidate.embedding, ranks: [] },
        weights,
      );
      return { candidate, total, components };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, size)
    .map((row, index) => ({
      participant_id: person.id,
      candidate_id: row.candidate.id,
      position: index + 1,
      score: row.total,
      components: row.components,
    }));
}

/**
 * Builds a shortlist for everyone on both sides. Shortlists are deliberately
 * asymmetric: a big appearing on a little's list doesn't put that little on
 * the big's, because each is ranked from its owner's point of view.
 */
export function buildShortlists(
  bigs: MatchParticipant[],
  littles: MatchParticipant[],
  weights: Weights,
  blockedPairs: { participant_a: string; participant_b: string }[] = [],
  size = SHORTLIST_SIZE,
): ShortlistEntry[] {
  const blocked = new Set(blockedPairs.map((p) => blockKey(p.participant_a, p.participant_b)));
  const w = preRankingWeights(weights);
  return [
    ...bigs.flatMap((b) => shortlistFor(b, littles, w, blocked, size)),
    ...littles.flatMap((l) => shortlistFor(l, bigs, w, blocked, size)),
  ];
}

/**
 * Who each person may legally be paired with, when the organiser chooses to
 * hold the matcher to the shortlists. A pair counts if it appears on *either*
 * side's list — requiring both would rule out far too much.
 */
export function shortlistPairKeys(entries: { participant_id: string; candidate_id: string }[]) {
  return new Set(entries.map((e) => blockKey(e.participant_id, e.candidate_id)));
}

/**
 * Scores outside the shortlists are pushed to the blocked sentinel so the
 * optimiser treats them as a last resort. It can still pick one if there's no
 * legal alternative — reported as a forced pair rather than failing outright,
 * because a shortlist-only assignment often has no perfect matching at all.
 */
export function restrictMatrixToShortlists<T extends { total: number; blocked: boolean }>(
  matrix: T[][],
  bigIds: string[],
  littleIds: string[],
  allowed: Set<string>,
): T[][] {
  return matrix.map((row, r) =>
    row.map((cell, c) => {
      if (allowed.has(blockKey(bigIds[r], littleIds[c]))) return cell;
      return { ...cell, total: BLOCKED_SCORE, blocked: true };
    }),
  );
}

/**
 * Presentation order for a shortlist.
 *
 * Shown in score order, the first card would carry the matcher's opinion as an
 * implicit recommendation and most people would just agree with it. Shuffling
 * removes that anchor. The seed is the person's own token, so the order is
 * stable across reloads rather than jumping around mid-decision.
 */
export function presentationOrder<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
