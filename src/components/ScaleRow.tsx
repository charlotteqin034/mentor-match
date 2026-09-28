"use client";

import { SCALE_POINTS, type ScaleQuestion } from "@/lib/questions";

export function ScaleRow({
  question,
  value,
  onChange,
}: {
  question: ScaleQuestion;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="hidden w-28 shrink-0 text-right text-xs leading-tight text-muted sm:block">
          {question.low}
        </span>
        <div className="scale-row flex-1">
          {SCALE_POINTS.map((n) => {
            const selected = value === n;
            return (
              <label
                key={n}
                className={`flex cursor-pointer items-center justify-center rounded border py-2 text-sm transition ${
                  selected
                    ? "border-accent bg-accent font-semibold text-white"
                    : "border-line bg-card text-muted hover:border-accent/50 hover:bg-accent-soft"
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={n}
                  checked={selected}
                  onChange={() => onChange(n)}
                  className="sr-only"
                />
                {n}
              </label>
            );
          })}
        </div>
        <span className="hidden w-28 shrink-0 text-xs leading-tight text-muted sm:block">
          {question.high}
        </span>
      </div>
      {/* Narrow screens can't spare the side columns, so the anchors go below. */}
      <div className="mt-1 flex justify-between gap-4 text-xs leading-tight text-muted sm:hidden">
        <span>{question.low}</span>
        <span className="text-right">{question.high}</span>
      </div>
    </div>
  );
}
