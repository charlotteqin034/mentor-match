"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";
import { STAGES, STAGE_BLURBS, STAGE_LABELS, type Round, type Stage } from "@/lib/types";

export function StageControl({ round }: { round: Round }) {
  const router = useRouter();
  const [pending, setPending] = useState<Stage | null>(null);
  const [error, setError] = useState("");
  const currentIndex = STAGES.indexOf(round.stage);

  async function setStage(stage: Stage) {
    const index = STAGES.indexOf(stage);
    if (index < currentIndex) {
      const ok = confirm(
        `Roll back to "${STAGE_LABELS[stage]}"? Nothing is deleted, but participants will be able to change answers again.`,
      );
      if (!ok) return;
    }
    setPending(stage);
    setError("");
    try {
      await post("/api/admin/round", { action: "set_stage", round_id: round.id, stage });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">Stage</h2>
      <p className="mt-1 text-xs text-muted">{STAGE_BLURBS[round.stage]}</p>
      <ol className="mt-4 grid gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage, index) => {
          const isCurrent = stage === round.stage;
          const isPast = index < currentIndex;
          return (
            <li key={stage}>
              <button
                type="button"
                onClick={() => setStage(stage)}
                disabled={pending !== null || isCurrent}
                className={`w-full rounded-md border px-2 py-2 text-left text-xs transition disabled:cursor-default ${
                  isCurrent
                    ? "border-accent bg-accent text-white"
                    : isPast
                      ? "border-line bg-accent-soft text-accent hover:border-accent"
                      : "border-line bg-card text-muted hover:border-accent/60"
                }`}
              >
                <span className="block font-semibold">{index + 1}</span>
                <span className="block leading-tight">{STAGE_LABELS[stage]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
