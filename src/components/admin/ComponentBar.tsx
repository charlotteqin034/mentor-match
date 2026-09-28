"use client";

import { WEIGHT_KEYS, WEIGHT_LABELS, type Components, type WeightKey } from "@/lib/scoring";

export const COMPONENT_COLORS: Record<WeightKey, string> = {
  traits: "#3d6b5c",
  crossPref: "#7fa88f",
  closeness: "#c2703d",
  values: "#7d6ba8",
  openText: "#4a7fa8",
  project: "#b8722f",
};

/**
 * A pair's score, broken into the weighted contribution of each component.
 * Segment widths add up to the total; the pale remainder is the score it
 * didn't earn.
 */
export function ComponentBar({
  components,
  applied,
  height = "h-2.5",
}: {
  components: Components;
  applied: Record<WeightKey, number>;
  height?: string;
}) {
  return (
    <div className={`flex w-full overflow-hidden rounded-sm bg-line ${height}`}>
      {WEIGHT_KEYS.map((key) => {
        const value = components[key];
        const weight = applied[key] ?? 0;
        if (value === null || weight <= 0) return null;
        const width = value * weight * 100;
        if (width <= 0) return null;
        return (
          <span
            key={key}
            style={{ width: `${width}%`, backgroundColor: COMPONENT_COLORS[key] }}
            title={`${WEIGHT_LABELS[key]}: ${value.toFixed(2)} × ${weight.toFixed(2)} = ${(
              value * weight
            ).toFixed(3)}`}
          />
        );
      })}
    </div>
  );
}

export function ComponentLegend({ applied }: { applied: Record<WeightKey, number> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {WEIGHT_KEYS.map((key) => (
        <li key={key} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm"
            style={{
              backgroundColor: COMPONENT_COLORS[key],
              opacity: (applied[key] ?? 0) > 0 ? 1 : 0.25,
            }}
          />
          <span className={(applied[key] ?? 0) > 0 ? "" : "line-through opacity-60"}>
            {WEIGHT_LABELS[key]}
          </span>
        </li>
      ))}
    </ul>
  );
}
