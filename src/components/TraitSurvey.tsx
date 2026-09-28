"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearJson, readJson, useHydrated, writeJson } from "@/lib/use-client-value";
import {
  SCALE_INSTRUCTION,
  SECTIONS,
  questionsFor,
  questionsInSection,
  type Question,
} from "@/lib/questions";
import { OTHER_PREFIX, missingQuestionIds } from "@/lib/validation";
import { PeoplePicker, type Candidate } from "./PeoplePicker";
import { ScaleRow } from "./ScaleRow";

type Answers = Record<string, unknown>;

const draftKey = (token: string) => `mm:trait-draft:${token}`;

export function TraitSurvey({
  token,
  name,
  role,
  alreadyDone,
  serverAnswers,
  candidates,
}: {
  token: string;
  name: string;
  role: "big" | "little";
  alreadyDone: boolean;
  serverAnswers: Answers | null;
  /** The other side's roster, for the preference question. */
  candidates: Candidate[];
}) {
  const [answers, setAnswers] = useState<Answers>(serverAnswers ?? {});
  const [editing, setEditing] = useState(!alreadyDone);
  const [missing, setMissing] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [draftChecked, setDraftChecked] = useState(false);
  const hydrated = useHydrated();
  const formRef = useRef<HTMLFormElement>(null);

  // A local draft, when present, is unsaved work and beats whatever the server
  // has. Adjusting state during render (rather than in an effect) keeps the
  // hydration render identical to the server's.
  if (hydrated && !draftChecked) {
    setDraftChecked(true);
    const draft = readJson<Answers>(draftKey(token));
    if (draft) setAnswers(draft);
  }

  useEffect(() => {
    if (!draftChecked) return;
    writeJson(draftKey(token), answers);
  }, [answers, draftChecked, token]);

  const set = useCallback((id: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setMissing((prev) => prev.filter((m) => m !== id));
  }, []);

  // Everything counts against the questions *this* person is asked, not the
  // whole bank — otherwise a big could never reach 100%.
  const myQuestions = useMemo(() => questionsFor(role), [role]);
  const outstanding = useMemo(() => missingQuestionIds(answers, role), [answers, role]);
  const answered = myQuestions.length - outstanding.length;
  const progress = Math.round((answered / myQuestions.length) * 100);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const gaps = missingQuestionIds(answers, role);
    setMissing(gaps);
    if (gaps.length > 0) {
      const first = formRef.current?.querySelector(`[data-question="${gaps[0]}"]`);
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setStatus("saving");
    setErrorText("");
    const res = await fetch("/api/trait-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, answers }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; errors?: object };
      setStatus("error");
      setErrorText(body.error ?? "Something went wrong. Try again in a moment.");
      if (body.errors) setMissing(Object.keys(body.errors));
      return;
    }

    clearJson(draftKey(token));
    setStatus("saved");
    setEditing(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!editing) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20">
        <div className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {status === "saved" ? "Saved" : "All done"}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Thanks, {name.split(" ")[0]} — your answers are in.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Nothing else to do — that&apos;s the whole thing. The organiser will be in touch
            once the pairings are worked out.
          </p>
          <p className="mt-3 text-sm text-muted">
            You can still change your answers until the organiser closes this stage.
          </p>
          <button type="button" className="btn mt-6" onClick={() => setEditing(true)}>
            Edit my answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="mx-auto max-w-4xl px-6 pb-32 pt-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {role === "big" ? "Big" : "Little"} · trait survey
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hi {name.split(" ")[0]}.</h1>
        <p className="mt-3 max-w-prose text-muted">
          {myQuestions.length} questions, about ten minutes. Answer honestly rather
          than aspirationally —
          this is used to pair you with someone, so a flattering answer just gets you a
          worse match. Nobody sees your answers but the organiser.
        </p>
      </header>

      {SECTIONS.map((section, sectionIndex) => {
        const sectionQuestions = questionsInSection(section.id, role);
        if (sectionQuestions.length === 0) return null;
        return (
        <section key={section.id} className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
          {section.blurb && <p className="mt-1 text-sm text-muted">{section.blurb}</p>}

          {sectionIndex === 0 && (
            <p className="mt-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink">
              {SCALE_INSTRUCTION}
            </p>
          )}

          <div className="mt-5 space-y-3">
            {sectionQuestions.map((question) => (
              <QuestionBlock
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={(v) => set(question.id, v)}
                flagged={missing.includes(question.id)}
                candidates={candidates}
              />
            ))}
          </div>
        </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-3">
          <div className="flex-1">
            <div className="flex items-baseline justify-between text-xs text-muted">
              <span>
                {/* Their name stays visible the whole way down, so it's always
                    obvious whose survey this is. */}
                <span className="font-medium text-ink">{name}</span> · {answered} of{" "}
                {myQuestions.length} answered
              </span>
              {missing.length > 0 && (
                <span className="text-bad">{missing.length} still need an answer</span>
              )}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
            {status === "saving" ? "Saving…" : "Submit"}
          </button>
        </div>
        {errorText && (
          <p className="mx-auto max-w-4xl px-6 pb-3 text-sm text-bad">{errorText}</p>
        )}
      </div>
    </form>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
  flagged,
  candidates,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  flagged: boolean;
  candidates: Candidate[];
}) {
  return (
    <fieldset
      data-question={question.id}
      className={`card scroll-mt-24 px-4 py-3 ${flagged ? "border-bad bg-bad-soft" : ""}`}
    >
      <legend className="sr-only">{question.text}</legend>
      <div className={question.kind === "scale" ? "sm:flex sm:items-center sm:gap-6" : ""}>
        <p
          className={`text-sm font-medium ${
            question.kind === "scale" ? "sm:w-72 sm:shrink-0" : ""
          }`}
        >
          {question.text}
        </p>
        <div className={question.kind === "scale" ? "mt-2 flex-1 sm:mt-0" : "mt-3"}>
          <QuestionInput
            question={question}
            value={value}
            onChange={onChange}
            candidates={candidates}
          />
        </div>
      </div>
      {"hint" in question && question.hint && (
        <p className="mt-2 text-xs text-faint">{question.hint}</p>
      )}
    </fieldset>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
  candidates,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  candidates: Candidate[];
}) {
  switch (question.kind) {
    case "scale":
      return (
        <ScaleRow
          question={question}
          value={typeof value === "number" ? value : undefined}
          onChange={onChange}
        />
      );

    case "multi": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const otherEntry = selected.find((s) => s.startsWith(OTHER_PREFIX));
      const toggle = (id: string) => {
        const has = selected.includes(id);
        if (has) onChange(selected.filter((s) => s !== id));
        else if (selected.length < question.max) onChange([...selected, id]);
      };
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const on = selected.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    on
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-card text-muted hover:border-accent/50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                if (otherEntry) onChange(selected.filter((s) => s !== otherEntry));
                else if (selected.length < question.max)
                  onChange([...selected, `${OTHER_PREFIX}`]);
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                otherEntry
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-card text-muted hover:border-accent/50"
              }`}
            >
              Other
            </button>
          </div>
          {otherEntry !== undefined && (
            <input
              className="input mt-2"
              placeholder="What else are you after?"
              value={otherEntry.slice(OTHER_PREFIX.length)}
              onChange={(e) =>
                onChange(
                  selected.map((s) =>
                    s.startsWith(OTHER_PREFIX) ? `${OTHER_PREFIX}${e.target.value}` : s,
                  ),
                )
              }
            />
          )}
          <p className="mt-2 text-xs text-faint">
            Pick {question.min}–{question.max}. {selected.length} selected.
          </p>
        </div>
      );
    }

    case "choice":
      return (
        <div className="space-y-2">
          {question.options.map((option) => {
            const on = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                className={`block w-full rounded-md border px-4 py-3 text-left transition ${
                  on
                    ? "border-accent bg-accent-soft ring-1 ring-accent"
                    : "border-line bg-card hover:border-accent/50"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className="text-xs text-muted">{option.meta}</span>
                </span>
                <span className="mt-1.5 block text-xs leading-snug text-muted">
                  <span className="font-medium text-ink">Mission.</span> {option.mission}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted">
                  <span className="font-medium text-ink">What you&apos;d build.</span>{" "}
                  {option.product}
                </span>
              </button>
            );
          })}
        </div>
      );

    case "people":
      return (
        <PeoplePicker
          candidates={candidates}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder={question.placeholder}
          max={question.max}
        />
      );

    case "text": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <textarea
            className="input min-h-20 resize-y"
            placeholder={question.placeholder}
            maxLength={question.maxLength}
            value={text}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-faint">
            {text.length}/{question.maxLength}
          </p>
        </div>
      );
    }

  }
}
