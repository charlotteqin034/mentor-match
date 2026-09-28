import { describe, expect, it } from "vitest";
import { BLOCKED_SCORE, buildScoreMatrix, runMatching } from "@/lib/matching";
import { swapPairs } from "@/lib/override";
import type { MatchParticipant } from "@/lib/matching";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { addRankings, answersAt, syntheticCohort } from "./fixtures";

const person = (
  id: string,
  role: "mentor" | "mentee",
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
    const mentors = [person("m1", "mentor", answersAt(4))];
    const mentees = [person("e1", "mentee", answersAt(4))];
    const matrix = buildScoreMatrix(
      mentors,
      mentees,
      DEFAULT_WEIGHTS,
      new Set(["e1|m1"]),
    );
    expect(matrix[0][0].total).toBe(BLOCKED_SCORE);
    expect(matrix[0][0].blocked).toBe(true);
  });

  it("never assigns a blocked pair when any alternative exists", () => {
    // m1 and e1 are a perfect match on paper; they are also blocked.
    const mentors = [person("m1", "mentor", answersAt(4)), person("m2", "mentor", answersAt(1))];
    const mentees = [person("e1", "mentee", answersAt(4)), person("e2", "mentee", answersAt(1))];
    const result = runMatching(mentors, mentees, DEFAULT_WEIGHTS, [
      { participant_a: "m1", participant_b: "e1" },
    ]);
    const assigned = result.pairs.map((p) => `${p.mentor_id}-${p.mentee_id}`);
    expect(assigned).not.toContain("m1-e1");
    expect(result.pairs.every((p) => !p.blocked)).toBe(true);
    expect(result.pairs).toHaveLength(2);
  });

  it("blocks in both directions regardless of which id was stored first", () => {
    const mentors = [person("m1", "mentor", answersAt(4)), person("m2", "mentor", answersAt(4))];
    const mentees = [person("e1", "mentee", answersAt(4)), person("e2", "mentee", answersAt(4))];
    const result = runMatching(mentors, mentees, DEFAULT_WEIGHTS, [
      { participant_a: "e1", participant_b: "m1" }, // stored mentee-first
    ]);
    expect(result.pairs.map((p) => `${p.mentor_id}-${p.mentee_id}`)).not.toContain("m1-e1");
  });
});

describe("the assignment itself", () => {
  it("maximises total score rather than greedily taking the first good pair", () => {
    // m1 scores well with both; m2 only works with e1. The optimum gives e1 to m2.
    const mentors = [person("m1", "mentor", answersAt(4)), person("m2", "mentor", answersAt(2))];
    const mentees = [person("e1", "mentee", answersAt(2)), person("e2", "mentee", answersAt(4))];
    const result = runMatching(mentors, mentees);
    const map = Object.fromEntries(result.pairs.map((p) => [p.mentor_id, p.mentee_id]));
    expect(map.m1).toBe("e2");
    expect(map.m2).toBe("e1");
  });

  it("reports rank-within-row so the organiser can see how good a pair was", () => {
    const mentors = [person("m1", "mentor", answersAt(4))];
    const mentees = [
      person("e1", "mentee", answersAt(4)),
      person("e2", "mentee", answersAt(5)),
    ];
    const result = runMatching(mentors, mentees);
    expect(result.pairs[0].mentee_id).toBe("e1");
    expect(result.pairs[0].mentor_rank_of_mentee).toBe(1);
  });

  it("pads unequal cohorts and reports who was left over", () => {
    const mentors = [person("m1", "mentor", answersAt(4)), person("m2", "mentor", answersAt(4))];
    const mentees = [person("e1", "mentee", answersAt(4))];
    const result = runMatching(mentors, mentees);
    expect(result.pairs).toHaveLength(1);
    expect(result.unmatched_mentors).toHaveLength(1);
    expect(result.unmatched_mentees).toHaveLength(0);
  });

  it("handles an empty cohort without throwing", () => {
    const result = runMatching([], [person("e1", "mentee", answersAt(4))]);
    expect(result.pairs).toHaveLength(0);
    expect(result.unmatched_mentees).toEqual(["e1"]);
  });

  it("still matches people who never submitted a trait response", () => {
    const mentors = [person("m1", "mentor", null)];
    const mentees = [person("e1", "mentee", answersAt(4))];
    const result = runMatching(mentors, mentees);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].total).toBe(0);
  });
});

describe("manual override", () => {
  it("swaps two pairs and reports the score delta", () => {
    const mentors = [person("m1", "mentor", answersAt(4)), person("m2", "mentor", answersAt(2))];
    const mentees = [person("e1", "mentee", answersAt(2)), person("e2", "mentee", answersAt(4))];
    const result = runMatching(mentors, mentees);
    const { pairs, delta } = swapPairs(result, result.pairs, 0, 1);
    // The optimum was already found, so any swap must be worse (or equal).
    expect(delta).toBeLessThanOrEqual(0);
    expect(pairs[0].mentee_id).not.toBe(result.pairs[0].mentee_id);
    expect(new Set(pairs.map((p) => p.mentee_id)).size).toBe(2);
  });
});

describe("full synthetic pipeline — 25 mentors × 25 mentees", () => {
  const mentors = syntheticCohort("mentor", 25, 1234);
  const mentees = syntheticCohort("mentee", 25, 5678);
  addRankings(mentors, mentees, 42);
  addRankings(mentees, mentors, 99);
  const result = runMatching(mentors, mentees, DEFAULT_WEIGHTS, [
    { participant_a: "mentor-0", participant_b: "mentee-0" },
  ]);

  it("matches everybody exactly once", () => {
    expect(result.pairs).toHaveLength(25);
    expect(new Set(result.pairs.map((p) => p.mentor_id)).size).toBe(25);
    expect(new Set(result.pairs.map((p) => p.mentee_id)).size).toBe(25);
    expect(result.unmatched_mentors).toHaveLength(0);
    expect(result.unmatched_mentees).toHaveLength(0);
  });

  it("honours the blocked pair", () => {
    const pair = result.pairs.find((p) => p.mentor_id === "mentor-0");
    expect(pair?.mentee_id).not.toBe("mentee-0");
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
    const naive = mentors.reduce(
      (sum, m, i) => sum + result.matrix[i][i].total,
      0,
    );
    expect(result.total_score).toBeGreaterThan(naive);
  });

  it("completes fast enough to re-run interactively", () => {
    const start = performance.now();
    runMatching(mentors, mentees, DEFAULT_WEIGHTS, []);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
