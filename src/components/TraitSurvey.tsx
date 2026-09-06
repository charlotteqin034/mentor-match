"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearJson, readJson, useHydrated, writeJson } from "@/lib/use-client-value";
import {
  QUESTIONS,
  SCALE_INSTRUCTION,
  SECTIONS,
  questionsInSection,
  type Question,
} from "@/lib/questions";
import { OTHER_PREFIX, missingQuestionIds } from "@/lib/validation";
import { ScaleRow } from "./ScaleRow";

type Answers = Record<string, unknown>;

const draftKey = (token: string) => `mm:trait-draft:${token}`;

export function TraitSurvey({
  token,
  name,
  role,
  alreadyDone,
  serverAnswers,
}: {
  token: string;
  name: string;
  role: "mentor" | "mentee";
  alreadyDone: boolean;
  serverAnswers: Answers | null;
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

  const outstanding = useMemo(() => missingQuestionIds(answers), [answers]);
  const answered = QUESTIONS.length - outstanding.length;
  const progress = Math.round((answered / QUESTIONS.length) * 100);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const gaps = missingQuestionIds(answers);
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
            Nothing else to do for now. When the ranking round opens you&apos;ll get a second
            link, where you&apos;ll rank anonymous profiles of the {role === "mentor" ? "mentees" : "mentors"}.
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
          {role === "mentor" ? "Mentor" : "Mentee"} · trait survey
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hi {name.split(" ")[0]}.</h1>
        <p className="mt-3 max-w-prose text-muted">
          Thirty questions, about ten minutes. Answer honestly rather than aspirationally —
          this is used to pair you with someone, so a flattering answer just gets you a
          worse match. Nobody sees your answers but the organiser.
        </p>
      </header>

      {SECTIONS.map((section, sectionIndex) => (
        <section key={section.id} className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
          {section.blurb && <p className="mt-1 text-sm text-muted">{section.blurb}</p>}

          {sectionIndex === 0 && (
            <p className="mt-4 rounded-md border border-line bg-accent-soft px-4 py-3 text-sm leading-relaxed text-ink">
              {SCALE_INSTRUCTION}
            </p>
          )}

          <div className="mt-5 space-y-3">
            {questionsInSection(section.id).map((question) => (
              <QuestionBlock
                key={question.id}
                question={question}
                value={answers[question.id]}
                onChange={(v) => set(question.id, v)}
                flagged={missing.includes(question.id)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-3">
          <div className="flex-1">
            <div className="flex items-baseline justify-between text-xs text-muted">
              <span>
                {answered} of {QUESTIONS.length} answered
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
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
  flagged: boolean;
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
          <QuestionInput question={question} value={value} onChange={onChange} />
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
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
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

    case "select":
      return (
        <div className="flex flex-wrap gap-2">
          {question.options.map((option) => {
            const on = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
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
        </div>
      );

    case "background": {
      const v = (value ?? {}) as { year?: string; focus?: string };
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className="input"
            value={v.year ?? ""}
            onChange={(e) => onChange({ ...v, year: e.target.value })}
          >
            <option value="">Year / experience level…</option>
            {question.yearOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder={question.focusLabel}
            value={v.focus ?? ""}
            onChange={(e) => onChange({ ...v, focus: e.target.value })}
          />
        </div>
      );
    }
  }
}
