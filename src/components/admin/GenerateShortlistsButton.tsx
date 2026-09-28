"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";
import { DEFAULT_WEIGHTS } from "@/lib/scoring";
import { RANK_COUNT, SHORTLIST_SIZE } from "@/lib/shortlists";

type Result = { generated: number; people: number; size: number; cleared_rankings: number };

export function GenerateShortlistsButton({ roundId }: { roundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState(SHORTLIST_SIZE);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function run(force: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await post<Result>("/api/admin/shortlists", {
        round_id: roundId,
        weights: DEFAULT_WEIGHTS,
        size,
        force,
      });
      setResult(res);
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      // The route refuses to clobber submitted rankings without confirmation.
      if (/already submitted a ranking/.test(message)) {
        if (confirm(`${message}\n\nRegenerate anyway and clear those rankings?`)) {
          await run(true);
          return;
        }
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="flex items-center gap-2 text-xs text-muted">
        Shortlist size
        <input
          type="number"
          min={RANK_COUNT}
          max={12}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-16 rounded-md border border-line bg-card px-2 py-1 text-sm"
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={busy}
        onClick={() => run(false)}
      >
        {busy ? "Building…" : "Generate shortlists"}
      </button>
      {result && (
        <p className="w-full text-right text-xs text-muted">
          {result.people} {result.people === 1 ? "person" : "people"} got a shortlist of up to{" "}
          {result.size}.
          {result.cleared_rankings > 0 &&
            ` Cleared ${result.cleared_rankings} existing ranking${
              result.cleared_rankings === 1 ? "" : "s"
            }.`}
        </p>
      )}
      {error && <p className="w-full text-right text-sm text-bad">{error}</p>}
    </div>
  );
}
