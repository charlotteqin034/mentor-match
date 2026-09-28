/**
 * Scoring pipeline (§8).
 *
 * Pure functions, no I/O — everything here is unit-testable against fixtures.
 *
 * Every component returns a value in [0, 1] *before* weighting, so the weights
 * in DEFAULT_WEIGHTS are directly comparable to one another. A component that
 * cannot be computed returns `null` and is excluded from the weighted mean,
 * with the remaining weights renormalised — it is never scored as 0, because a
 * flat 0 for everyone still distorts the normalisation.
 */

import {
  SCALE_MAX,
  SCALE_MIN,
  SCALE_QUESTIONS,
  SCALE_RANGE,
} from "./questions";

export type Answers = Record<string, unknown>;

export type WeightKey =
  | "traits"
  | "crossPref"
  | "closeness"
  | "values"
  | "openText"
  | "project";

export type Weights = Record<WeightKey, number>;

export const WEIGHT_KEYS: WeightKey[] = [
  "traits",
  "crossPref",
  "closeness",
  "values",
  "openText",
  "project",
];

export const WEIGHT_LABELS: Record<WeightKey, string> = {
  traits: "Trait similarity",
  crossPref: "Cross-preference",
  closeness: "Closeness & logistics",
  values: "Values overlap",
  openText: "Open text",
  project: "Project fit",
};

export const DEFAULT_WEIGHTS: Weights = {
  traits: 0.35, // §8a
  crossPref: 0.07, // §8b
  closeness: 0.23, // §8c
  values: 0.05, // §8d
  openText: 0.05, // §8e — excluded and renormalised when embeddings are off
  project: 0.25, // the project they'd actually work on together
};

export type Components = Record<WeightKey, number | null>;

export type PairScore = {
  total: number;
  components: Components;
  /** Weight actually applied to each component after renormalisation. */
  applied: Record<WeightKey, number>;
};

/** One side of a pair, as the scorer needs it. */
export type Side = {
  id: string;
  answers: Answers | null;
  /** Open-text embedding; null/undefined when embeddings are disabled. */
  embedding?: number[] | null;
};

// ---------------------------------------------------------------------------
// Answer accessors — tolerant of missing / malformed rows
// ---------------------------------------------------------------------------

export function scaleAnswer(answers: Answers | null | undefined, id: string): number | null {
  if (!answers) return null;
  const v = answers[id];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < SCALE_MIN || v > SCALE_MAX) return null;
  return v;
}

function normaliseValueToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, " ");
}

export function valueSet(answers: Answers | null | undefined, id = "q26"): Set<string> | null {
  if (!answers) return null;
  const v = answers[id];
  if (!Array.isArray(v)) return null;
  const tokens = v
    .filter((x): x is string => typeof x === "string")
    .map(normaliseValueToken)
    .filter(Boolean);
  return tokens.length ? new Set(tokens) : null;
}

/** 1 at identical, 0 at maximally far apart. */
export function scaleAgreement(a: number, b: number): number {
  return 1 - Math.abs(a - b) / SCALE_RANGE;
}

function weightedMean(parts: { value: number; weight: number }[]): number | null {
  let num = 0;
  let den = 0;
  for (const p of parts) {
    num += p.value * p.weight;
    den += p.weight;
  }
  return den > 0 ? num / den : null;
}

// ---------------------------------------------------------------------------
// §8a — trait similarity
// ---------------------------------------------------------------------------

export function traitSimilarity(a: Answers | null, b: Answers | null): number | null {
  const parts: { value: number; weight: number }[] = [];
  for (const q of SCALE_QUESTIONS) {
    if (q.mode !== "similarity") continue;
    const av = scaleAnswer(a, q.id);
    const bv = scaleAnswer(b, q.id);
    if (av === null || bv === null) continue;
    parts.push({ value: scaleAgreement(av, bv), weight: q.weight ?? 1 });
  }
  return weightedMean(parts);
}

// ---------------------------------------------------------------------------
// §8b — cross-preference (q10 asks what you want; q15 asks how you are)
// ---------------------------------------------------------------------------

/**
 * The two scales run in opposite directions, so the answer we'd *hope* to see
 * from a partner is the mirror of ours: expected = (min + max) − mine.
 * q10 = 7 ("goes with the flow") expects a partner at q15 = 1 ("loosely").
 */
export function expectedPartnerAnswer(myAnswer: number): number {
  return SCALE_MIN + SCALE_MAX - myAnswer;
}

function crossPrefDirection(
  wanter: Answers | null,
  target: Answers | null,
  wantId: string,
  targetId: string,
): number | null {
  const want = scaleAnswer(wanter, wantId);
  const actual = scaleAnswer(target, targetId);
  if (want === null || actual === null) return null;
  return scaleAgreement(expectedPartnerAnswer(want), actual);
}

export function crossPreference(a: Answers | null, b: Answers | null): number | null {
  const parts: { value: number; weight: number }[] = [];
  for (const q of SCALE_QUESTIONS) {
    if (q.mode !== "cross_pref" || !q.crossTarget) continue;
    const w = q.weight ?? 1;
    // Both directions: what A wants vs how B is, and what B wants vs how A is.
    for (const [wanter, target] of [
      [a, b],
      [b, a],
    ] as const) {
      const v = crossPrefDirection(wanter, target, q.id, q.crossTarget);
      if (v !== null) parts.push({ value: v, weight: w });
    }
  }
  return weightedMean(parts);
}

// ---------------------------------------------------------------------------
// §8c — closeness / logistics gap
// ---------------------------------------------------------------------------

export function closenessGap(a: Answers | null, b: Answers | null): number | null {
  const parts: { value: number; weight: number }[] = [];
  for (const q of SCALE_QUESTIONS) {
    if (q.mode !== "gap") continue;
    const av = scaleAnswer(a, q.id);
    const bv = scaleAnswer(b, q.id);
    if (av === null || bv === null) continue;
    parts.push({ value: scaleAgreement(av, bv), weight: q.weight ?? 1 });
  }
  return weightedMean(parts);
}

// ---------------------------------------------------------------------------
// §8d — values overlap
// ---------------------------------------------------------------------------

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function valuesOverlap(a: Answers | null, b: Answers | null): number | null {
  const av = valueSet(a);
  const bv = valueSet(b);
  if (!av || !bv) return null;
  return jaccard(av, bv);
}

// ---------------------------------------------------------------------------
// §8e — open text (embeddings, feature-flagged)
// ---------------------------------------------------------------------------

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function openTextSimilarity(
  a: number[] | null | undefined,
  b: number[] | null | undefined,
): number | null {
  if (!a || !b) return null;
  return Math.min(1, Math.max(0, cosineSimilarity(a, b)));
}

// ---------------------------------------------------------------------------
// Project fit
// ---------------------------------------------------------------------------

/** Someone's ranking as project id → position, 1 = first choice. */
function rankMap(answers: Answers | null, id = "q33"): Map<string, number> | null {
  if (!answers) return null;
  const order = answers[id];
  if (!Array.isArray(order) || order.length === 0) return null;
  const out = new Map<string, number>();
  order.forEach((projectId, index) => {
    if (typeof projectId === "string" && !out.has(projectId)) out.set(projectId, index + 1);
  });
  return out.size > 0 ? out : null;
}

/**
 * How good the best project these two could share actually is.
 *
 * For every project, add up how far down each person's list it sits; the
 * cheapest one is the project they'd both be happiest working on. Two people
 * who both put Food Access first score 1; two people whose lists are exact
 * opposites score 0, because whatever they end up on, one of them is at the
 * bottom of their list.
 *
 * Scoring only the top choice would throw away most of the answer — sharing a
 * second choice is worth a great deal more than sharing nothing.
 */
export function projectFit(a: Answers | null, b: Answers | null): number | null {
  const ra = rankMap(a);
  const rb = rankMap(b);
  if (!ra || !rb) return null;

  const shared = [...ra.keys()].filter((id) => rb.has(id));
  if (shared.length === 0) return null;

  const cost = Math.min(...shared.map((id) => ra.get(id)! - 1 + (rb.get(id)! - 1)));
  // With n projects the cheapest shared option can never cost more than n − 1,
  // so that's the divisor that puts the worst case at exactly 0.
  const worst = shared.length - 1;
  if (worst <= 0) return 1;
  return Math.max(0, 1 - cost / worst);
}

// ---------------------------------------------------------------------------
// §8g — final score
// ---------------------------------------------------------------------------

export function combine(
  components: Components,
  weights: Weights,
): { total: number; applied: Record<WeightKey, number> } {
  let num = 0;
  let den = 0;
  const applied = {} as Record<WeightKey, number>;
  for (const key of WEIGHT_KEYS) {
    const value = components[key];
    const w = weights[key] ?? 0;
    if (value === null || w <= 0) {
      applied[key] = 0;
      continue;
    }
    applied[key] = w;
    num += w * value;
    den += w;
  }
  if (den === 0) return { total: 0, applied };
  // Renormalise so the total stays in [0, 1] whatever is missing.
  for (const key of WEIGHT_KEYS) applied[key] = applied[key] / den;
  return { total: num / den, applied };
}

export function scorePair(a: Side, b: Side, weights: Weights = DEFAULT_WEIGHTS): PairScore {
  const components: Components = {
    traits: traitSimilarity(a.answers, b.answers),
    crossPref: crossPreference(a.answers, b.answers),
    closeness: closenessGap(a.answers, b.answers),
    values: valuesOverlap(a.answers, b.answers),
    openText: openTextSimilarity(a.embedding, b.embedding),
    project: projectFit(a.answers, b.answers),
  };
  const { total, applied } = combine(components, weights);
  return { total, components, applied };
}

export function normaliseWeights(input: Partial<Record<WeightKey, unknown>>): Weights {
  const out = { ...DEFAULT_WEIGHTS };
  for (const key of WEIGHT_KEYS) {
    const v = input[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v;
  }
  return out;
}
