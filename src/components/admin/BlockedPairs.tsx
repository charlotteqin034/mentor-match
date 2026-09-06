"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { errorMessage, post } from "@/lib/client";
import type { BlockedPair, Participant } from "@/lib/types";

function PersonPicker({
  label,
  people,
  value,
  onChange,
  exclude,
}: {
  label: string;
  people: Participant[];
  value: string | null;
  onChange: (id: string | null) => void;
  exclude: string | null;
}) {
  const [query, setQuery] = useState("");
  const selected = people.find((p) => p.id === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => p.id !== exclude)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [people, query, exclude]);

  return (
    <div>
      <p className="label">{label}</p>
      {selected ? (
        <div className="mt-1 flex items-center gap-2 rounded-md border border-accent bg-accent-soft px-3 py-2 text-sm">
          <span className="flex-1">
            {selected.name} <span className="text-muted">· {selected.role}</span>
          </span>
          <button type="button" className="text-faint hover:text-bad" onClick={() => onChange(null)}>
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            className="input mt-1"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-line">
              {matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted">No one matches.</li>
              )}
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-paper"
                    onClick={() => {
                      onChange(p.id);
                      setQuery("");
                    }}
                  >
                    {p.name} <span className="text-muted">· {p.role}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

export function BlockedPairs({
  roundId,
  participants,
  blocked,
}: {
  roundId: string;
  participants: Participant[];
  blocked: BlockedPair[];
}) {
  const router = useRouter();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);

  async function run(body: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/blocked", body);
      after?.();
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <h2 className="text-sm font-semibold">Block a pair</h2>
        <p className="mt-1 text-xs text-muted">
          Prior relationship, a conflict, an ex-manager — anything the survey can&apos;t know.
          Blocked pairs are scored as forbidden, not merely bad, so the optimiser will take a
          genuinely poor match over one of these.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <PersonPicker label="Person A" people={participants} value={a} onChange={setA} exclude={b} />
          <PersonPicker label="Person B" people={participants} value={b} onChange={setB} exclude={a} />
        </div>
        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || !a || !b}
          onClick={() =>
            run({ action: "add", round_id: roundId, participant_a: a, participant_b: b }, () => {
              setA(null);
              setB(null);
            })
          }
        >
          Block this pair
        </button>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          {blocked.length} blocked pair{blocked.length === 1 ? "" : "s"}
        </h2>
        {blocked.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {blocked.map((pair) => {
              const pa = byId.get(pair.participant_a);
              const pb = byId.get(pair.participant_b);
              return (
                <li key={pair.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1">
                    {pa?.name ?? "(removed)"}{" "}
                    <span className="text-faint">never with</span> {pb?.name ?? "(removed)"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger px-2 py-1 text-xs"
                    disabled={busy}
                    onClick={() => run({ action: "delete", id: pair.id })}
                  >
                    Unblock
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
