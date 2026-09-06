import { BlockedPairs } from "@/components/admin/BlockedPairs";
import { ConfigError } from "@/components/admin/ConfigError";
import { getSelectedRound } from "@/lib/admin";
import { getBlockedPairs, getParticipants } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function BlockedPage() {
  let round;
  try {
    round = await getSelectedRound();
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!round) return <p className="text-sm text-muted">Create a round on the overview first.</p>;

  const [participants, blocked] = await Promise.all([
    getParticipants(round.id),
    getBlockedPairs(round.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Blocked pairs</h1>
        <p className="mt-1 text-sm text-muted">
          Pairs the matcher must never produce.
        </p>
      </div>
      <BlockedPairs roundId={round.id} participants={participants} blocked={blocked} />
    </div>
  );
}
