"use client";

import { useRef } from "react";
import type { RankedChoiceQuestion } from "@/lib/questions";

/**
 * Puts a handful of projects in preference order.
 *
 * It deliberately starts empty rather than pre-filled: a pre-ordered list is
 * one people leave alone, and "didn't think about it" would be recorded as a
 * genuine first choice. Clicking builds the order; the last one falls into
 * place on its own once the rest are picked.
 */
export function ProjectRanker({
  question,
  value,
  onChange,
}: {
  question: RankedChoiceQuestion;
  value: string[];
  onChange: (order: string[]) => void;
}) {
  const dragIndex = useRef<number | null>(null);
  const ranked = value.filter((id) => question.options.some((o) => o.id === id));
  const unranked = question.options.filter((o) => !ranked.includes(o.id));

  function pick(id: string) {
    const next = [...ranked, id];
    // One left over means its position is already decided — fill it in.
    const remaining = question.options.filter((o) => !next.includes(o.id));
    onChange(remaining.length === 1 ? [...next, remaining[0].id] : next);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= ranked.length) return;
    const next = [...ranked];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  const option = (id: string) => question.options.find((o) => o.id === id)!;

  return (
    <div className="space-y-3">
      {ranked.length > 0 && (
        <ol className="space-y-2">
          {ranked.map((id, index) => {
            const o = option(id);
            return (
              <li
                key={id}
                draggable
                onDragStart={() => (dragIndex.current = index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex.current !== null) move(dragIndex.current, index);
                  dragIndex.current = null;
                }}
                className="flex cursor-grab gap-3 rounded-md border border-accent bg-accent-soft px-4 py-3 active:cursor-grabbing"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-sm font-semibold">{o.label}</span>
                    <span className="text-xs text-muted">{o.meta}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    <span className="font-medium text-ink">Mission.</span> {o.mission}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-muted">
                    <span className="font-medium text-ink">What you&apos;d build.</span>{" "}
                    {o.product}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col justify-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move ${o.label} up`}
                    className="px-1 text-faint hover:text-ink disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${o.label} down`}
                    className="px-1 text-faint hover:text-ink disabled:opacity-30"
                    disabled={index === ranked.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {unranked.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => pick(o.id)}
          className="block w-full rounded-md border border-line bg-card px-4 py-3 text-left transition hover:border-accent/50"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-muted">{o.meta}</span>
          </span>
          <span className="mt-1 block text-xs leading-snug text-muted">
            <span className="font-medium text-ink">Mission.</span> {o.mission}
          </span>
          <span className="mt-1 block text-xs leading-snug text-muted">
            <span className="font-medium text-ink">What you&apos;d build.</span> {o.product}
          </span>
        </button>
      ))}

      <p className="text-xs text-faint">
        {ranked.length === 0
          ? "Click your first choice."
          : ranked.length < question.options.length
            ? `Click your next choice. ${question.options.length - ranked.length} to go.`
            : "Drag, or use the arrows, to change the order."}
      </p>
      {ranked.length > 0 && (
        <button
          type="button"
          className="text-xs text-accent underline underline-offset-2 hover:no-underline"
          onClick={() => onChange([])}
        >
          Start over
        </button>
      )}
    </div>
  );
}
