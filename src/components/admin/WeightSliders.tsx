"use client";

import {
  DEFAULT_WEIGHTS,
  WEIGHT_KEYS,
  WEIGHT_LABELS,
  type Weights,
} from "@/lib/scoring";
import { COMPONENT_COLORS } from "./ComponentBar";

const NOTES: Record<string, string> = {
  traits: "How alike the two of you are across the 22 personality scales.",
  crossPref: "What you said you want in a partner (q10) vs how they actually are (q15).",
  closeness: "Agreement on closeness, medium and cadence. The costliest thing to get wrong.",
  values: "How much the two of you want the same things out of this.",
  openText: "Similarity of the two free-text answers. Needs embeddings switched on.",
  ranking: "Whether the two of you picked each other in the ranking round.",
};

export function WeightSliders({
  weights,
  onChange,
  disabled,
}: {
  weights: Weights;
  onChange: (weights: Weights) => void;
  disabled?: boolean;
}) {
  const sum = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0);
  const isDefault = WEIGHT_KEYS.every((k) => weights[k] === DEFAULT_WEIGHTS[k]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Weights</h2>
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          disabled={isDefault}
          onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
        >
          Reset to defaults
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        These don&apos;t have to add to 1 — scores are renormalised over whatever is live, so
        only the ratios between them matter.
      </p>

      <div className="mt-4 space-y-3">
        {WEIGHT_KEYS.map((key) => {
          const share = sum > 0 ? (weights[key] / sum) * 100 : 0;
          return (
            <div key={key}>
              <div className="flex items-baseline gap-2 text-sm">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: COMPONENT_COLORS[key] }}
                />
                <span className="flex-1 font-medium">{WEIGHT_LABELS[key]}</span>
                <span className="tabular-nums text-muted">{weights[key].toFixed(2)}</span>
                <span className="w-12 text-right text-xs tabular-nums text-faint">
                  {share.toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={weights[key]}
                disabled={disabled}
                className="mt-1 w-full accent-accent"
                onChange={(e) => onChange({ ...weights, [key]: Number(e.target.value) })}
              />
              <p className="text-xs text-faint">{NOTES[key]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
