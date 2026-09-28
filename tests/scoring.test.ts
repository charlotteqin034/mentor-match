import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  WEIGHT_KEYS,
  closenessGap,
  combine,
  crossPreference,
  expectedPartnerAnswer,
  jaccard,
  openTextSimilarity,
  rankingComponent,
  scorePair,
  traitSimilarity,
  valuesOverlap,
  type Side,
} from "@/lib/scoring";
import {
  QUESTIONS,
  QUESTIONS_BY_ID,
  SCALE_MAX,
  SCALE_MIDPOINT,
  SCALE_MIN,
  SCALE_POINTS,
  SCALE_QUESTIONS,
  SECTIONS,
  questionsFor,
  questionsInSection,
  type MultiQuestion,
  type ScaleQuestion,
} from "@/lib/questions";
import { answersAt } from "./fixtures";

// Default everyone to the midpoint, so a test only has to state what differs.
const side = (id: string, over: Partial<Side> = {}): Side => ({
  id,
  answers: answersAt(3),
  ranks: [],
  ...over,
});

describe("the question bank", () => {
  it("is 28 questions across three sections", () => {
    expect(QUESTIONS).toHaveLength(28);
    expect(SECTIONS.map((s) => s.id)).toEqual(["about", "how", "looking"]);
  });

  it("no longer carries the group-project role or the background question", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(ids).not.toContain("q29");
    expect(ids).not.toContain("q30");
    expect(ids.at(-1)).toBe("q28");
  });

  it("runs on a 1-5 scale, with everything derived from those bounds", () => {
    expect(SCALE_MIN).toBe(1);
    expect(SCALE_MAX).toBe(5);
    expect(SCALE_POINTS).toEqual([1, 2, 3, 4, 5]);
    expect(SCALE_MIDPOINT).toBe(3);
  });

  it("has dropped the dry-humour question and gained the free-day one", () => {
    const ids = QUESTIONS.map((q) => q.id);
    expect(ids).not.toContain("q9");
    expect(ids).toContain("q31");
    expect(QUESTIONS_BY_ID.q31.text).toBe("On a free day, I'd rather be…");
    const q31 = QUESTIONS_BY_ID.q31 as ScaleQuestion;
    expect([q31.low, q31.high]).toEqual(["out in nature", "out in the city"]);
    // It sits with the other lifestyle scales, not tacked on the end.
    const about = questionsInSection("about").map((q) => q.id);
    expect(about[about.indexOf("q31") - 1]).toBe("q17");
  });

  it("keeps 21 questions feeding trait similarity", () => {
    const similarity = SCALE_QUESTIONS.filter((q) => q.mode === "similarity");
    expect(similarity).toHaveLength(21);
  });

  it("asks only littles what they want out of it", () => {
    expect(QUESTIONS_BY_ID.q26.audience).toBe("little");
    expect(questionsFor("little").map((q) => q.id)).toContain("q26");
    expect(questionsFor("big").map((q) => q.id)).not.toContain("q26");
    // One question apart, both sides answer the same survey.
    expect(questionsFor("big")).toHaveLength(questionsFor("little").length - 1);
  });

  it("offers the agreed set of things to want out of this", () => {
    const q26 = QUESTIONS_BY_ID.q26 as MultiQuestion;
    expect(q26.options.map((o) => o.label)).toEqual([
      "Career clarity",
      "Technical / skill depth",
      "Expanding my network",
      "Finding direction",
      "Hanging out socially",
    ]);
    // Still pickable within the 2-3 range now that the list is shorter.
    expect(q26.options.length).toBeGreaterThanOrEqual(q26.max);
  });

  it("doesn't open with the drinking and smoking questions", () => {
    const about = questionsInSection("about").map((q) => q.id);
    expect(about[0]).toBe("q3");
    expect(about.slice(-2)).toEqual(["q1", "q2"]);
    // Ids are stored answer keys, so they must survive the reordering.
    expect(QUESTIONS_BY_ID.q1.text).toBe("I enjoy drinking");
    expect(QUESTIONS_BY_ID.q2.text).toBe("I enjoy smoking");
  });

  it("puts every question in a section that actually exists", () => {
    const sectionIds = new Set(SECTIONS.map((s) => s.id));
    for (const q of QUESTIONS) expect(sectionIds.has(q.section)).toBe(true);
  });
});

describe("§8a trait similarity", () => {
  it("scores identical responses at 1.0", () => {
    expect(traitSimilarity(answersAt(3), answersAt(3))).toBe(1);
  });

  it("scores maximally opposite responses at 0.0", () => {
    expect(traitSimilarity(answersAt(1), answersAt(5))).toBe(0);
  });

  it("is linear in the gap", () => {
    // A gap of 2 on every question is exactly half the 4-point range.
    expect(traitSimilarity(answersAt(1), answersAt(3))).toBeCloseTo(0.5, 10);
  });

  it("skips questions either side left unanswered", () => {
    const partial = answersAt(3);
    delete partial.q1;
    // q1 drops out; every remaining similarity question still agrees exactly.
    expect(traitSimilarity(partial, answersAt(3))).toBe(1);
  });

  it("returns null when there is nothing comparable", () => {
    expect(traitSimilarity(null, answersAt(3))).toBeNull();
    expect(traitSimilarity({}, {})).toBeNull();
  });

  it("excludes q10 — that is cross-preference, not similarity", () => {
    const a = answersAt(3, { q10: 1 });
    const b = answersAt(3, { q10: 5 });
    expect(traitSimilarity(a, b)).toBe(1);
  });
});

describe("§8b cross-preference (q10 → q15)", () => {
  it("mirrors the scale: q10=7 expects a partner at q15=1", () => {
    expect(expectedPartnerAnswer(5)).toBe(1);
    expect(expectedPartnerAnswer(1)).toBe(5);
    expect(expectedPartnerAnswer(3)).toBe(3);
  });

  it("scores highest when someone wanting go-with-the-flow gets a loose planner", () => {
    const wanter = answersAt(3, { q10: 5 });
    const looseplanner = answersAt(3, { q15: 1 });
    delete looseplanner.q10; // isolate the single direction under test
    expect(crossPreference(wanter, looseplanner)).toBe(1);
  });

  it("scores lowest when that same person gets a strict planner", () => {
    const wanter = answersAt(3, { q10: 5 });
    const strict = answersAt(3, { q15: 5 });
    delete strict.q10;
    expect(crossPreference(wanter, strict)).toBe(0);
  });

  it("averages the two directions", () => {
    // A wants flow (q10=5) and gets it (B q15=1) → 1.0
    // B wants a planner (q10=1) and A plans loosely (q15=1) → expected 5 vs 1 → 0.0
    const a = answersAt(3, { q10: 5, q15: 1 });
    const b = answersAt(3, { q10: 1, q15: 1 });
    expect(crossPreference(a, b)).toBeCloseTo(0.5, 10);
  });
});

describe("§8c closeness / logistics", () => {
  it("scores identical logistics answers at 1.0", () => {
    expect(closenessGap(answersAt(3), answersAt(3))).toBe(1);
  });

  it("weights q23 double q24 and q25", () => {
    // q23 maximally mismatched, q24/q25 in perfect agreement:
    // (0 × 2 + 1 × 1 + 1 × 1) / 4 = 0.5
    const a = answersAt(3, { q23: 1 });
    const b = answersAt(3, { q23: 5 });
    expect(closenessGap(a, b)).toBeCloseTo(0.5, 10);

    // The same maximal mismatch on q24 alone costs half as much.
    const c = answersAt(3, { q24: 1 });
    const d = answersAt(3, { q24: 5 });
    expect(closenessGap(c, d)).toBeCloseTo(0.75, 10);
  });

  it("collapses to 0 when all three logistics answers are opposed", () => {
    const a = answersAt(3, { q23: 1, q24: 1, q25: 1 });
    const b = answersAt(3, { q23: 5, q24: 5, q25: 5 });
    expect(closenessGap(a, b)).toBe(0);
  });

  it("drags the total down hard even when everything else agrees perfectly", () => {
    const a = side("a", { answers: answersAt(3, { q23: 1 }) });
    const b = side("b", { answers: answersAt(3, { q23: 5 }) });
    const agreed = side("c", { answers: answersAt(3) });
    const mismatched = scorePair(a, b).total;
    const matched = scorePair(agreed, side("d")).total;
    expect(mismatched).toBeLessThan(matched);
    // 0.25 weight × a 0.5 component loss, renormalised over the 0.95 of weight
    // that is live when embeddings are off.
    expect(matched - mismatched).toBeGreaterThan(0.12);
  });
});

describe("§8d values overlap", () => {
  it("computes the Jaccard index", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3, 10);
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });

  it("treats free-text 'other' values case- and space-insensitively", () => {
    const a = answersAt(4, { q26: ["network", "other:Finding  a Research LAB"] });
    const b = answersAt(4, { q26: ["network", "other:finding a research lab"] });
    expect(valuesOverlap(a, b)).toBe(1);
  });

  it("scores partial overlap proportionally", () => {
    const a = answersAt(4, { q26: ["network", "social"] });
    const b = answersAt(4, { q26: ["network", "career_clarity"] });
    expect(valuesOverlap(a, b)).toBeCloseTo(1 / 3, 10);
  });

  it("is never computable across a pair, now that only littles answer q26", () => {
    const big = answersAt(3);
    delete big.q26; // what a big's stored answers actually look like
    const little = answersAt(3);
    expect(valuesOverlap(big, little)).toBeNull();
  });

  it("returns null when either side didn't answer", () => {
    const a = answersAt(3);
    const b = answersAt(3);
    delete a.q26;
    expect(valuesOverlap(a, b)).toBeNull();
  });
});

describe("§8e open text", () => {
  it("returns null when either embedding is missing", () => {
    expect(openTextSimilarity(null, [1, 0])).toBeNull();
    expect(openTextSimilarity([1, 0], undefined)).toBeNull();
  });

  it("clamps cosine similarity into [0, 1]", () => {
    expect(openTextSimilarity([1, 0], [1, 0])).toBe(1);
    expect(openTextSimilarity([1, 0], [0, 1])).toBe(0);
    expect(openTextSimilarity([1, 0], [-1, 0])).toBe(0);
  });
});

describe("§8f ranking bonus", () => {
  const withRanks = (id: string, ranks: [string, number][]): Side => ({
    id,
    answers: answersAt(3),
    ranks: ranks.map(([rankedId, rank]) => ({ rankedId, rank })),
  });

  it("scores a mutual first choice at 1.0", () => {
    const a = withRanks("a", [["b", 1], ["x", 2], ["y", 3], ["z", 4], ["w", 5]]);
    const b = withRanks("b", [["a", 1], ["x", 2], ["y", 3], ["z", 4], ["w", 5]]);
    expect(rankingComponent(a, b)).toBe(1);
  });

  it("scores a one-sided first choice at 0.5", () => {
    const a = withRanks("a", [["b", 1], ["x", 2], ["y", 3], ["z", 4], ["w", 5]]);
    const b = withRanks("b", [["x", 1], ["y", 2], ["z", 3], ["w", 4], ["v", 5]]);
    expect(rankingComponent(a, b)).toBe(0.5);
  });

  it("scores an unranked pair at 0", () => {
    const a = withRanks("a", []);
    const b = withRanks("b", []);
    expect(rankingComponent(a, b)).toBe(0);
  });

  it("decays with position: last of five is 0.2", () => {
    const a = withRanks("a", [["x", 1], ["y", 2], ["z", 3], ["w", 4], ["b", 5]]);
    const b = withRanks("b", []);
    expect(rankingComponent(a, b)).toBeCloseTo(0.1, 10); // 0.2, halved for one-sidedness
  });

  it("normalises by list length, so a shortlist of 8 is not worth more", () => {
    const eight: [string, number][] = ["b", "p", "q", "r", "s", "t", "u", "v"].map(
      (id, i) => [id, i + 1] as [string, number],
    );
    const a = withRanks("a", eight);
    const b = withRanks("b", [["a", 1]]);
    expect(rankingComponent(a, b)).toBe(1); // both had each other at #1
  });
});

describe("§8g combining and renormalisation", () => {
  it("excludes null components and renormalises the rest", () => {
    const { total, applied } = combine(
      {
        traits: 1,
        crossPref: 1,
        closeness: 1,
        values: 1,
        openText: null,
        ranking: 1,
      },
      DEFAULT_WEIGHTS,
    );
    expect(total).toBe(1);
    expect(applied.openText).toBe(0);
    const sum = WEIGHT_KEYS.reduce((s, k) => s + applied[k], 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("does not let a disabled component drag scores down", () => {
    const withText = combine(
      { traits: 1, crossPref: 1, closeness: 1, values: 1, openText: 1, ranking: 1 },
      DEFAULT_WEIGHTS,
    );
    const withoutText = combine(
      { traits: 1, crossPref: 1, closeness: 1, values: 1, openText: null, ranking: 1 },
      DEFAULT_WEIGHTS,
    );
    expect(withoutText.total).toBeCloseTo(withText.total, 10);
  });

  it("keeps totals inside [0, 1] with embeddings disabled", () => {
    const best = scorePair(
      { id: "a", answers: answersAt(3), ranks: [{ rankedId: "b", rank: 1 }] },
      { id: "b", answers: answersAt(3), ranks: [{ rankedId: "a", rank: 1 }] },
    );
    const worst = scorePair(
      { id: "a", answers: answersAt(1, { q10: 1 }), ranks: [] },
      { id: "b", answers: answersAt(5, { q10: 5 }), ranks: [] },
    );
    expect(best.components.openText).toBeNull();
    expect(best.total).toBeLessThanOrEqual(1);
    expect(best.total).toBeGreaterThanOrEqual(0);
    expect(worst.total).toBeGreaterThanOrEqual(0);
    expect(worst.total).toBeLessThan(best.total);
  });

  it("returns 0 rather than NaN when nothing at all is scoreable", () => {
    const { total } = scorePair({ id: "a", answers: null }, { id: "b", answers: null });
    expect(total).toBe(0);
  });
});
