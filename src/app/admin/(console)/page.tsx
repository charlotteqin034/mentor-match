import Link from "next/link";
import { ConfigError } from "@/components/admin/ConfigError";
import { GenerateProfilesButton } from "@/components/admin/GenerateProfilesButton";
import { RoundBar } from "@/components/admin/RoundBar";
import { StageControl } from "@/components/admin/StageControl";
import { getSelectedRound } from "@/lib/admin";
import { getParticipants, getProfileCards, listRounds } from "@/lib/data";
import { env } from "@/lib/env";
import type { Participant } from "@/lib/types";

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

function completion(list: Participant[], key: "trait_completed_at" | "ranking_completed_at") {
  const done = list.filter((p) => p[key]).length;
  return { done, total: list.length };
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
  const cards = await getProfileCards(participants.map((p) => p.id));

  const trait = completion(participants, "trait_completed_at");
  const ranking = completion(participants, "ranking_completed_at");

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
          label="Trait survey"
          value={`${trait.done}/${trait.total}`}
          sub={trait.done === trait.total && trait.total > 0 ? "Everyone's in" : "Still waiting"}
        />
        <Stat
          label="Ranking survey"
          value={`${ranking.done}/${ranking.total}`}
          sub="Optional — matching runs without it"
        />
        <Stat
          label="Profile cards"
          value={String(cards.length)}
          sub={env.embeddingsEnabled ? "Embeddings on" : "Embeddings off"}
        />
      </div>

      {bigs.length !== littles.length && participants.length > 0 && (
        <div className="card border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          There are {bigs.length} bigs and {littles.length} littles. Matching will still
          run — {Math.abs(bigs.length - littles.length)}{" "}
          {bigs.length > littles.length ? "bigs" : "littles"} will be reported as
          unmatched rather than paired badly.
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Profile cards</h2>
            <p className="mt-1 text-xs text-muted">
              Build the anonymous cards from trait answers. Safe to re-run — existing profile
              numbers are kept, so links and submitted rankings stay valid.
            </p>
          </div>
          <GenerateProfilesButton roundId={round.id} />
        </div>
      </div>

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
                <th className="px-4 py-2 font-medium">Profile</th>
                <th className="px-4 py-2 font-medium">Trait</th>
                <th className="px-4 py-2 font-medium">Ranking</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-muted">{p.role}</td>
                  <td className="px-4 py-2 tabular-nums text-muted">
                    {p.display_number ? `#${p.display_number}` : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {p.trait_completed_at ? (
                      <span className="text-accent">done</span>
                    ) : (
                      <span className="text-faint">waiting</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {p.ranking_completed_at ? (
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
