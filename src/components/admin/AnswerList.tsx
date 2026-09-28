"use client";

import { QUESTIONS, SCALE_MIDPOINT, SCALE_POINTS, type Question } from "@/lib/questions";
import { valueLabel } from "@/lib/profile-cards";

function renderAnswer(question: Question, value: unknown): React.ReactNode {
  switch (question.kind) {
    case "scale": {
      const n = typeof value === "number" ? value : null;
      if (n === null) return <span className="text-faint">—</span>;
      return (
        <span className="flex items-center gap-2">
          <span className="flex gap-0.5">
            {SCALE_POINTS.map((i) => (
              <span
                key={i}
                className={`h-3 w-1.5 rounded-sm ${i === n ? "bg-accent" : "bg-line"}`}
              />
            ))}
          </span>
          <span className="tabular-nums text-muted">{n}</span>
          <span className="text-xs text-faint">
            {n > SCALE_MIDPOINT
              ? question.phrases.high
              : n < SCALE_MIDPOINT
                ? question.phrases.low
                : "middle"}
          </span>
        </span>
      );
    }
    case "multi":
      return Array.isArray(value) ? (
        <span>{(value as string[]).map(valueLabel).join(" · ")}</span>
      ) : (
        <span className="text-faint">—</span>
      );
    case "text":
      return typeof value === "string" ? (
        <span className="italic">&ldquo;{value}&rdquo;</span>
      ) : (
        <span className="text-faint">—</span>
      );
  }
}

export function AnswerList({ answers }: { answers: Record<string, unknown> }) {
  return (
    <dl className="divide-y divide-line/60 text-sm">
      {QUESTIONS.map((q) => (
        <div key={q.id} className="grid gap-1 py-1.5 sm:grid-cols-[1.5rem_1fr_1.4fr] sm:gap-3">
          <dt className="text-xs text-faint">{q.id}</dt>
          <dd className="text-muted">{q.text}</dd>
          <dd>{renderAnswer(q, answers[q.id])}</dd>
        </div>
      ))}
    </dl>
  );
}
