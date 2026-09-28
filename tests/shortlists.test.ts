import { describe, expect, it } from "vitest";
import {
  RANK_COUNT,
  SHORTLIST_SIZE,
  buildShortlists,
  preRankingWeights,
  presentationOrder,
  restrictMatrixToShortlists,
  shortlistPairKeys,
} from "@/lib/shortlists";
import { BLOCKED_SCORE, buildScoreMatrix, runMatching } from "@/lib/matching";
import type { MatchParticipant } from "@/lib/matching";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { answersAt, syntheticCohort } from "./fixtures";

const person = (
  id: string,
  role: "big" | "little",
  answers: MatchParticipant["answers"],
): MatchParticipant => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role,
  display_number: 1,
  answers,
  embedding: null,
  ranks: [],
});

describe("building shortlists", () => {
  it("gives everyone on both sides a list, capped at the size asked for", () => {
    const bigs = syntheticCohort("big", 8, 3);
    const littles = syntheticCohort("little", 8, 9);
    const entries = buildShortlists(bigs, littles, DEFAULT_WEIGHTS, [], 5);

    const byPerson = new Map<string, number>();
    for (const e of entries) byPerson.set(e.participant_id, (byPerson.get(e.participant_id) ?? 0) + 1);

    expect(byPerson.size).toBe(16);
    for (const count of byPerson.values()) expect(count).toBe(5);
  });

  it("only ever offers people from the other side", () => {
    const bigs = syntheticCohort("big", 5, 1);
    const littles = syntheticCohort("little", 5, 2);
    const entries = buildShortlists(bigs, littles, DEFAULT_WEIGHTS, [], 3);
    for (const e of entries) {
      const ownerIsBig = e.participant_id.startsWith("big");
      expect(e.candidate_id.startsWith("little")).toBe(ownerIsBig);
    }
  });

  it("orders by score, best first", () => {
    const bigs = [person("b1", "big", answersAt(3))];
    const littles = [
      person("l1", "little", answersAt(1)),
      person("l2", "little", answersAt(3)), // identical to b1
      person("l3", "little", answersAt(5)),
    ];
    const entries = buildShortlists(bigs, littles, DEFAULT_WEIGHTS, [], 3);
    expect(entries[0].candidate_id).toBe("l2");
    expect(entries[0].position).toBe(1);
    expect(entries[0].score).toBeGreaterThan(entries[1].score);
    expect(entries[1].score).toBeGreaterThanOrEqual(entries[2].score);
  });

  it("never offers a blocked pair", () => {
    const bigs = [person("b1", "big", answersAt(3))];
    const littles = [
      person("l1", "little", answersAt(3)), // the obvious best match
      person("l2", "little", answersAt(2)),
      person("l3", "little", answersAt(1)),
    ];
    const entries = buildShortlists(bigs, littles, DEFAULT_WEIGHTS, [
      { participant_a: "b1", participant_b: "l1" },
    ]);
    expect(entries.map((e) => e.candidate_id)).not.toContain("l1");
  });

  it("scores without the ranking component, which doesn't exist yet", () => {
    expect(preRankingWeights(DEFAULT_WEIGHTS).ranking).toBe(0);
    // Everything else is untouched.
    expect(preRankingWeights(DEFAULT_WEIGHTS).traits).toBe(DEFAULT_WEIGHTS.traits);
  });

  it("copes with a cohort smaller than the shortlist size", () => {
    const bigs = [person("b1", "big", answersAt(3))];
    const littles = [person("l1", "little", answersAt(3))];
    const entries = buildShortlists(bigs, littles, DEFAULT_WEIGHTS, [], 5);
    expect(entries).toHaveLength(2); // one each way
  });

  it("asks for fewer ranks than it offers, so there's a real choice to make", () => {
    expect(RANK_COUNT).toBeLessThan(SHORTLIST_SIZE);
  });
});

describe("presentation order", () => {
  it("is stable for a given person", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect(presentationOrder(items, "token-1")).toEqual(presentationOrder(items, "token-1"));
  });

  it("differs between people, so the matcher's order isn't an implicit rec", () => {
    const items = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const orders = new Set(
      ["t1", "t2", "t3", "t4", "t5"].map((t) => presentationOrder(items, t).join("")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("keeps every item exactly once", () => {
    const items = ["a", "b", "c", "d", "e"];
    expect([...presentationOrder(items, "x")].sort()).toEqual(items);
  });
});

describe("holding the matcher to the shortlists", () => {
  it("pushes unshortlisted pairs to the blocked sentinel", () => {
    const bigs = [person("b1", "big", answersAt(3)), person("b2", "big", answersAt(3))];
    const littles = [person("l1", "little", answersAt(3)), person("l2", "little", answersAt(3))];
    const matrix = buildScoreMatrix(bigs, littles, DEFAULT_WEIGHTS);
    const allowed = shortlistPairKeys([
      { participant_id: "b1", candidate_id: "l1" },
      { participant_id: "b2", candidate_id: "l2" },
    ]);
    const restricted = restrictMatrixToShortlists(matrix, ["b1", "b2"], ["l1", "l2"], allowed);

    expect(restricted[0][0].total).toBeGreaterThan(0); // b1-l1 allowed
    expect(restricted[0][1].total).toBe(BLOCKED_SCORE); // b1-l2 not
    expect(restricted[1][1].total).toBeGreaterThan(0); // b2-l2 allowed
  });

  it("matches inside the shortlists when that's possible", () => {
    const bigs = [person("b1", "big", answersAt(1)), person("b2", "big", answersAt(5))];
    const littles = [person("l1", "little", answersAt(5)), person("l2", "little", answersAt(1))];
    const matrix = buildScoreMatrix(bigs, littles, DEFAULT_WEIGHTS);
    // Force the *worse* pairing to be the only shortlisted one.
    const allowed = shortlistPairKeys([
      { participant_id: "b1", candidate_id: "l1" },
      { participant_id: "b2", candidate_id: "l2" },
    ]);
    const restricted = restrictMatrixToShortlists(matrix, ["b1", "b2"], ["l1", "l2"], allowed);
    const result = runMatching(bigs, littles, DEFAULT_WEIGHTS, [], restricted);

    const map = Object.fromEntries(result.pairs.map((p) => [p.big_id, p.little_id]));
    expect(map.b1).toBe("l1");
    expect(map.b2).toBe("l2");
    expect(result.pairs.every((p) => !p.blocked)).toBe(true);
  });

  it("forces a pair, and flags it, when the shortlists admit no perfect matching", () => {
    // Both littles shortlisted only b1, so one of them cannot be legally placed.
    const bigs = [person("b1", "big", answersAt(3)), person("b2", "big", answersAt(3))];
    const littles = [person("l1", "little", answersAt(3)), person("l2", "little", answersAt(3))];
    const matrix = buildScoreMatrix(bigs, littles, DEFAULT_WEIGHTS);
    const allowed = shortlistPairKeys([
      { participant_id: "l1", candidate_id: "b1" },
      { participant_id: "l2", candidate_id: "b1" },
    ]);
    const restricted = restrictMatrixToShortlists(matrix, ["b1", "b2"], ["l1", "l2"], allowed);
    const result = runMatching(bigs, littles, DEFAULT_WEIGHTS, [], restricted);

    expect(result.pairs).toHaveLength(2);
    const forced = result.pairs.filter((p) => p.blocked);
    expect(forced).toHaveLength(1);
    expect(forced[0].big_id).toBe("b2"); // the one nobody shortlisted
  });
});
