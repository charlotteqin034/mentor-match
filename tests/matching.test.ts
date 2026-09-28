import { describe, expect, it } from "vitest";
import { BLOCKED_SCORE, buildScoreMatrix, runMatching } from "@/lib/matching";
import { swapPairs } from "@/lib/override";
import type { MatchParticipant } from "@/lib/matching";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { addRankings, answersAt, syntheticCohort } from "./fixtures";

const person = (
  id: string,
  role: "big" | "little",
  answers: MatchParticipant["answers"],
): MatchParticipant => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  display_number: null,
  answers,
  embedding: null,
  ranks: [],
});

describe("blocked pairs", () => {
  it("marks blocked cells with a large negative score, not zero", () => {
    const bigs = [person("m1", "big", answersAt(4))];
    const littles = [person("e1", "little", answersAt(4))];
    const matrix = buildScoreMatrix(
      bigs,
      littles,
      DEFAULT_WEIGHTS,
      new Set(["e1|m1"]),
    );
    expect(matrix[0][0].total).toBe(BLOCKED_SCORE);
    expect(matrix[0][0].blocked).toBe(true);
  });

  it("never assigns a blocked pair when any alternative exists", () => {
    // m1 and e1 are a perfect match on paper; they are also blocked.
    const bigs = [person("m1", "big", answersAt(4)), person("m2", "big", answersAt(1))];
    const littles = [person("e1", "little", answersAt(4)), person("e2", "little", answersAt(1))];
    const result = runMatching(bigs, littles, DEFAULT_WEIGHTS, [
      { participant_a: "m1", participant_b: "e1" },
    ]);
    const assigned = result.pairs.map((p) => `${p.big_id}-${p.little_id}`);
    expect(assigned).not.toContain("m1-e1");
    expect(result.pairs.every((p) => !p.blocked)).toBe(true);
    expect(result.pairs).toHaveLength(2);
  });

  it("blocks in both directions regardless of which id was stored first", () => {
    const bigs = [person("m1", "big", answersAt(4)), person("m2", "big", answersAt(4))];
    const littles = [person("e1", "little", answersAt(4)), person("e2", "little", answersAt(4))];
    const result = runMatching(bigs, littles, DEFAULT_WEIGHTS, [
      { participant_a: "e1", participant_b: "m1" }, // stored little-first
    ]);
    expect(result.pairs.map((p) => `${p.big_id}-${p.little_id}`)).not.toContain("m1-e1");
  });
});

describe("the assignment itself", () => {
  it("maximises total score rather than greedily taking the first good pair", () => {
    // m1 scores well with both; m2 only works with e1. The optimum gives e1 to m2.
    const bigs = [person("m1", "big", answersAt(4)), person("m2", "big", answersAt(2))];
    const littles = [person("e1", "little", answersAt(2)), person("e2", "little", answersAt(4))];
    const result = runMatching(bigs, littles);
    const map = Object.fromEntries(result.pairs.map((p) => [p.big_id, p.little_id]));
    expect(map.m1).toBe("e2");
    expect(map.m2).toBe("e1");
  });

  it("reports rank-within-row so the organiser can see how good a pair was", () => {
    const bigs = [person("m1", "big", answersAt(4))];
    const littles = [
      person("e1", "little", answersAt(4)),
      person("e2", "little", answersAt(5)),
    ];
    const result = runMatching(bigs, littles);
    expect(result.pairs[0].little_id).toBe("e1");
    expect(result.pairs[0].big_rank_of_little).toBe(1);
  });

  it("pads unequal cohorts and reports who was left over", () => {
    const bigs = [person("m1", "big", answersAt(4)), person("m2", "big", answersAt(4))];
    const littles = [person("e1", "little", answersAt(4))];
    const result = runMatching(bigs, littles);
    expect(result.pairs).toHaveLength(1);
    expect(result.unmatched_bigs).toHaveLength(1);
    expect(result.unmatched_littles).toHaveLength(0);
  });

  it("handles an empty cohort without throwing", () => {
    const result = runMatching([], [person("e1", "little", answersAt(4))]);
    expect(result.pairs).toHaveLength(0);
    expect(result.unmatched_littles).toEqual(["e1"]);
  });

  it("still matches people who never submitted a trait response", () => {
    const bigs = [person("m1", "big", null)];
    const littles = [person("e1", "little", answersAt(4))];
    const result = runMatching(bigs, littles);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].total).toBe(0);
  });
});

describe("manual override", () => {
  it("swaps two pairs and reports the score delta", () => {
    const bigs = [person("m1", "big", answersAt(4)), person("m2", "big", answersAt(2))];
    const littles = [person("e1", "little", answersAt(2)), person("e2", "little", answersAt(4))];
    const result = runMatching(bigs, littles);
    const { pairs, delta } = swapPairs(result, result.pairs, 0, 1);
    // The optimum was already found, so any swap must be worse (or equal).
    expect(delta).toBeLessThanOrEqual(0);
    expect(pairs[0].little_id).not.toBe(result.pairs[0].little_id);
    expect(new Set(pairs.map((p) => p.little_id)).size).toBe(2);
  });
});

describe("full synthetic pipeline — 25 bigs × 25 littles", () => {
  const bigs = syntheticCohort("big", 25, 1234);
  const littles = syntheticCohort("little", 25, 5678);
  addRankings(bigs, littles, 42);
  addRankings(littles, bigs, 99);
  const result = runMatching(bigs, littles, DEFAULT_WEIGHTS, [
    { participant_a: "big-0", participant_b: "little-0" },
  ]);

  it("matches everybody exactly once", () => {
    expect(result.pairs).toHaveLength(25);
    expect(new Set(result.pairs.map((p) => p.big_id)).size).toBe(25);
    expect(new Set(result.pairs.map((p) => p.little_id)).size).toBe(25);
    expect(result.unmatched_bigs).toHaveLength(0);
    expect(result.unmatched_littles).toHaveLength(0);
  });

  it("honours the blocked pair", () => {
    const pair = result.pairs.find((p) => p.big_id === "big-0");
    expect(pair?.little_id).not.toBe("little-0");
  });

  it("produces scores in range with a sensible spread", () => {
    const totals = result.pairs.map((p) => p.total);
    for (const t of totals) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThanOrEqual(1);
    }
    expect(Math.max(...totals) - Math.min(...totals)).toBeGreaterThan(0.05);
    expect(result.average_score).toBeGreaterThan(0.4);
  });

  it("beats a naive index-order pairing", () => {
    const naive = bigs.reduce(
      (sum, m, i) => sum + result.matrix[i][i].total,
      0,
    );
    expect(result.total_score).toBeGreaterThan(naive);
  });

  it("completes fast enough to re-run interactively", () => {
    const start = performance.now();
    runMatching(bigs, littles, DEFAULT_WEIGHTS, []);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
