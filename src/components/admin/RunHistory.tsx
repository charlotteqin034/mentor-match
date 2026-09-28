"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";
import { WEIGHT_KEYS, WEIGHT_LABELS } from "@/lib/scoring";
import type { MatchRun, Participant, Round } from "@/lib/types";

export function RunHistory({
  round,
  runs,
  participants,
}: {
  round: Round;
  runs: MatchRun[];
  participants: Participant[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const byId = new Map(participants.map((p) => [p.id, p]));

  async function act(url: string, body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      await post(url, body);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this run? The pairings it holds go with it.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/runs?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete that run.");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted">
        No runs saved yet. Run the matcher and it&apos;ll show up here with the weights it used.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-bad">{error}</p>}

      {runs.map((run) => {
        const published = round.published_run_id === run.id;
        const isOpen = open === run.id;
        const average = run.results.length
          ? (run.total_score ?? 0) / run.results.length
          : 0;
        return (
          <div key={run.id} className={`card p-4 ${published ? "border-accent" : ""}`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {new Date(run.created_at).toLocaleString()}
                  {published && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                      published
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {run.results.length} pairs · average {average.toFixed(3)} · total{" "}
                  {(run.total_score ?? 0).toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                className="btn px-2 py-1 text-xs"
                onClick={() => setOpen(isOpen ? null : run.id)}
              >
                {isOpen ? "Hide pairs" : "Show pairs"}
              </button>
              <a
                className="btn px-2 py-1 text-xs"
                href={`/api/admin/export?kind=pairings&round=${round.id}&run=${run.id}`}
              >
                CSV
              </a>
              {published ? (
                <button
                  type="button"
                  className="btn px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() =>
                    act(
                      "/api/admin/publish",
                      { round_id: round.id, unpublish: true },
                      "Unpublish this round? The round goes back to the matching stage.",
                    )
                  }
                >
                  Unpublish
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary px-2 py-1 text-xs"
                  disabled={busy}
                  onClick={() =>
                    act(
                      "/api/admin/publish",
                      { round_id: round.id, run_id: run.id },
                      "Publish this run as the final pairing for the round?",
                    )
                  }
                >
                  Publish
                </button>
              )}
              <button
                type="button"
                className="btn btn-danger px-2 py-1 text-xs"
                disabled={busy || published}
                onClick={() => remove(run.id)}
              >
                Delete
              </button>
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {WEIGHT_KEYS.map((key) => (
                <li key={key}>
                  {WEIGHT_LABELS[key]} <span className="tabular-nums">{run.weights[key]?.toFixed(2)}</span>
                </li>
              ))}
            </ul>

            {isOpen && (
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {[...run.results]
                    .sort((a, b) => a.total - b.total)
                    .map((r) => (
                      <tr key={`${r.big_id}-${r.little_id}`} className="border-t border-line/60">
                        <td className="py-1.5 pr-3">{byId.get(r.big_id)?.name ?? "(removed)"}</td>
                        <td className="py-1.5 pr-3 text-faint">+</td>
                        <td className="py-1.5 pr-3">{byId.get(r.little_id)?.name ?? "(removed)"}</td>
                        <td className="py-1.5 text-right tabular-nums">{r.total.toFixed(3)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
