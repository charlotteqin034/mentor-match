import Link from "next/link";
import { ConfigError } from "@/components/admin/ConfigError";
import { RoundBar } from "@/components/admin/RoundBar";
import { StageControl } from "@/components/admin/StageControl";
import { getSelectedRound } from "@/lib/admin";
import { getParticipants, getTraitResponses, listRounds } from "@/lib/data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default async function OverviewPage() {
  let rounds, round;
  try {
    [rounds, round] = await Promise.all([listRounds(), getSelectedRound()]);
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }

  if (!round) {
    return (
      <div className="space-y-6">
        <RoundBar round={null} rounds={rounds} />
        <p className="text-sm text-muted">
          A round holds one semester&apos;s participants, answers and matches. Create one above.
        </p>
      </div>
    );
  }

  const participants = await getParticipants(round.id);
  const bigs = participants.filter((p) => p.role === "big");
  const littles = participants.filter((p) => p.role === "little");
  const responses = await getTraitResponses(participants.map((p) => p.id));

  const done = participants.filter((p) => p.trait_completed_at).length;
  const namedSomeone = responses.filter(
    (r) => Array.isArray(r.answers?.q32) && (r.answers.q32 as string[]).length > 0,
  ).length;

  return (
    <div className="space-y-6">
      <RoundBar round={round} rounds={rounds} />
      <StageControl round={round} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Participants"
          value={String(participants.length)}
          sub={`${bigs.length} bigs · ${littles.length} littles`}
        />
        <Stat
          label="Survey"
          value={`${done}/${participants.length}`}
          sub={done === participants.length && participants.length > 0 ? "Everyone's in" : "Still waiting"}
        />
        <Stat
          label="Named a preference"
          value={String(namedSomeone)}
          sub="Shown alongside the match, not scored"
        />
        <Stat
          label="Embeddings"
          value={env.embeddingsEnabled ? "On" : "Off"}
          sub="Open-text similarity"
        />
      </div>

      {bigs.length !== littles.length && participants.length > 0 && (
        <div className="card border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          There are {bigs.length} bigs and {littles.length} littles. Matching will still run —{" "}
          {Math.abs(bigs.length - littles.length)}{" "}
          {bigs.length > littles.length ? "bigs" : "littles"} will be reported as unmatched
          rather than paired badly.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">Everyone in this round</h2>
          <Link href="/admin/participants" className="text-xs text-accent hover:underline">
            Manage participants →
          </Link>
        </div>
        {participants.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            Nobody yet.{" "}
            <Link href="/admin/participants" className="text-accent hover:underline">
              Add participants
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Survey</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-muted">{p.role}</td>
                  <td className="px-4 py-2">
                    {p.trait_completed_at ? (
                      <span className="text-accent">done</span>
                    ) : (
                      <span className="text-faint">waiting</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
