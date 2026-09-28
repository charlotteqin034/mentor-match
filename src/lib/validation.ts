/**
 * Answer validation, driven entirely by lib/questions.ts.
 *
 * Pure and isomorphic: the survey UI runs it to highlight the first missing
 * question, and the route handler runs it again before writing anything.
 */

import { QUESTIONS, SCALE_MAX, SCALE_MIN, type Question } from "./questions";
import type { Answers } from "./scoring";

export const OTHER_PREFIX = "other:";

export type Errors = Record<string, string>;

function checkOne(q: Question, raw: unknown): { error?: string; value?: unknown } {
  switch (q.kind) {
    case "scale": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isInteger(n) || n < SCALE_MIN || n > SCALE_MAX) {
        return { error: "Pick a point on the scale." };
      }
      return { value: n };
    }
    case "multi": {
      if (!Array.isArray(raw)) return { error: `Pick ${q.min}–${q.max}.` };
      const values = raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      const valid = values.filter(
        (v) => q.options.some((o) => o.id === v) || v.startsWith(OTHER_PREFIX),
      );
      const other = valid.find((v) => v.startsWith(OTHER_PREFIX));
      if (other && other.slice(OTHER_PREFIX.length).trim().length === 0) {
        return { error: "Fill in your 'other' answer or unselect it." };
      }
      if (valid.length < q.min) return { error: `Pick at least ${q.min}.` };
      if (valid.length > q.max) return { error: `Pick at most ${q.max}.` };
      return { value: valid.map((v) => (v.startsWith(OTHER_PREFIX) ? v.trim() : v)) };
    }
    case "text": {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!s) return { error: "This one's required." };
      if (s.length > q.maxLength) return { error: `Keep it under ${q.maxLength} characters.` };
      return { value: s };
    }
  }
}

/** Validates a whole submission. Returns cleaned answers or per-question errors. */
export function validateAnswers(
  input: unknown,
): { ok: true; answers: Answers } | { ok: false; errors: Errors } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const errors: Errors = {};
  const answers: Answers = {};

  for (const q of QUESTIONS) {
    const { error, value } = checkOne(q, raw[q.id]);
    if (error) errors[q.id] = error;
    else answers[q.id] = value;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers };
}

/** Ids of unanswered/invalid questions, in survey order — used to scroll to the first. */
export function missingQuestionIds(raw: Record<string, unknown>): string[] {
  return QUESTIONS.filter((q) => Boolean(checkOne(q, raw[q.id]).error)).map((q) => q.id);
}
