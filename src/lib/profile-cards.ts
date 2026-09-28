/**
 * Stage 2 — anonymised profile card generation (§6).
 *
 * A card never carries a name, an email or a token. That anonymity is the
 * whole point of the stage: rankings should respond to the person described,
 * not to who they already know.
 */

import {
  QUESTIONS_BY_ID,
  SCALE_MIDPOINT,
  SCALE_QUESTIONS,
  type MultiQuestion,
} from "./questions";
import { OTHER_PREFIX } from "./validation";
import type { Answers } from "./scoring";

export type StandoutTrait = { label: string; source: string; value: number };

export type ProfileCard = {
  display_number: number;
  role: "mentor" | "mentee";
  values: string[];
  excited_about: string;
  ideal_relationship: string;
  standout_traits: StandoutTrait[];
  wants: { closeness: number; communication: number; cadence: number };
};

const MAX_STANDOUT = 5;

export function valueLabel(token: string): string {
  if (token.startsWith(OTHER_PREFIX)) return token.slice(OTHER_PREFIX.length).trim();
  const q = QUESTIONS_BY_ID.q26 as MultiQuestion;
  return q.options.find((o) => o.id === token)?.label ?? token;
}

const num = (answers: Answers, id: string, fallback = SCALE_MIDPOINT): number => {
  const v = answers[id];
  return typeof v === "number" ? v : fallback;
};

const str = (answers: Answers, id: string): string => {
  const v = answers[id];
  return typeof v === "string" ? v : "";
};

/**
 * The answers furthest from the midpoint, turned into phrases.
 *
 * Only similarity-mode questions are eligible: the logistics questions
 * (q23–q25) already have their own `wants` block, and q10 describes what
 * someone wants in a partner rather than what they're like.
 */
export function standoutTraits(answers: Answers): StandoutTrait[] {
  return SCALE_QUESTIONS.filter((q) => q.mode === "similarity")
    .map((q) => {
      const value = num(answers, q.id, SCALE_MIDPOINT);
      return {
        question: q,
        value,
        deviation: Math.abs(value - SCALE_MIDPOINT),
      };
    })
    .filter((x) => x.deviation > 0)
    .sort((a, b) => b.deviation - a.deviation) // stable sort keeps survey order for ties
    .slice(0, MAX_STANDOUT)
    .map(({ question, value }) => ({
      label: value > SCALE_MIDPOINT ? question.phrases.high : question.phrases.low,
      source: question.id,
      value,
    }));
}

export function buildCard(
  role: "mentor" | "mentee",
  displayNumber: number,
  answers: Answers,
): ProfileCard {
  const values = Array.isArray(answers.q26) ? (answers.q26 as string[]) : [];

  return {
    display_number: displayNumber,
    role,
    values: values.map(valueLabel),
    excited_about: str(answers, "q27"),
    ideal_relationship: str(answers, "q28"),
    standout_traits: standoutTraits(answers),
    wants: {
      closeness: num(answers, "q23"),
      communication: num(answers, "q24"),
      cadence: num(answers, "q25"),
    },
  };
}

/** Fisher–Yates with a caller-supplied RNG, so display numbers leak no signup order. */
export function shuffled<T>(items: T[], rand: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
