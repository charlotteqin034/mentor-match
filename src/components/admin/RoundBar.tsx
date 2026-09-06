"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, post } from "@/lib/client";
import { STAGE_LABELS, type Round } from "@/lib/types";

export function RoundBar({ round, rounds }: { round: Round | null; rounds: Round[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/round", body);
      setName("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-4">
      <div className="flex-1">
        {round ? (
          <>
            <h1 className="text-lg font-semibold tracking-tight">{round.name}</h1>
            <p className="text-xs text-muted">
              {STAGE_LABELS[round.stage]} · created{" "}
              {new Date(round.created_at).toLocaleDateString()}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold tracking-tight">No round yet</h1>
            <p className="text-xs text-muted">Create one to get started.</p>
          </>
        )}
      </div>

      {rounds.length > 1 && round && (
        <select
          className="input w-auto"
          value={round.id}
          onChange={(e) => run({ action: "select", round_id: e.target.value })}
          disabled={busy}
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run({ action: "create", name });
        }}
      >
        <input
          className="input w-48"
          placeholder="New round name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" disabled={busy}>
          Create
        </button>
      </form>

      {error && <p className="w-full text-sm text-bad">{error}</p>}
    </div>
  );
}
