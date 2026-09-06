import { ConfigError } from "@/components/admin/ConfigError";
import { RunHistory } from "@/components/admin/RunHistory";
import { getSelectedRound } from "@/lib/admin";
import { getMatchRuns, getParticipants } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  let round;
  try {
    round = await getSelectedRound();
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!round) return <p className="text-sm text-muted">Create a round on the overview first.</p>;

  const [runs, participants] = await Promise.all([
    getMatchRuns(round.id),
    getParticipants(round.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Run history</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every saved run keeps the weights it was produced with, so you can put two weightings
          side by side before deciding. Publishing one marks it as the round&apos;s final result
          and moves the round to Published.
        </p>
      </div>
      <RunHistory round={round} runs={runs} participants={participants} />
    </div>
  );
}
