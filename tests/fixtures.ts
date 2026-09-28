/** Hand-built fixtures + a seeded generator for the synthetic pipeline test. */

import { SCALE_MAX, SCALE_MIN, SCALE_QUESTIONS } from "@/lib/questions";
import type { Answers } from "@/lib/scoring";
import type { MatchParticipant } from "@/lib/matching";

export const VALUE_IDS = [
  "career_clarity",
  "technical_depth",
  "network",
  "direction",
  "social",
];

/** A complete, valid answer set with every scale question set to `scaleValue`. */
export function answersAt(scaleValue: number, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const q of SCALE_QUESTIONS) answers[q.id] = scaleValue;
  answers.q26 = ["career_clarity", "network"];
  answers.q27 = "I'm building a small synth out of parts from a broken keyboard.";
  answers.q28 = "Someone I can ask half-formed questions without feeling silly.";
  return { ...answers, ...overrides };
}

/** Deterministic PRNG so the synthetic run is reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function syntheticCohort(
  role: "big" | "little",
  count: number,
  seed: number,
): MatchParticipant[] {
  const rand = mulberry32(seed);
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const scale = () => SCALE_MIN + Math.floor(rand() * (SCALE_MAX - SCALE_MIN + 1));

  return Array.from({ length: count }, (_, i) => {
    const answers: Answers = {};
    for (const q of SCALE_QUESTIONS) answers[q.id] = scale();
    const values = new Set<string>();
    while (values.size < 2 + Math.floor(rand() * 2)) values.add(pick(VALUE_IDS));
    answers.q26 = [...values];
    answers.q27 = `Synthetic ${role} ${i} is excited about something.`;
    answers.q28 = `Synthetic ${role} ${i} wants a supportive relationship.`;

    return {
      id: `${role}-${i}`,
      name: `${role === "big" ? "Big" : "Little"} ${i}`,
      email: `${role}${i}@example.test`,
      role,
      answers,
      embedding: null,
    } satisfies MatchParticipant;
  });
}

