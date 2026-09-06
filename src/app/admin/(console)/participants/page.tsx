import { ConfigError } from "@/components/admin/ConfigError";
import { ParticipantsManager } from "@/components/admin/ParticipantsManager";
import { getSelectedRound } from "@/lib/admin";
import { getParticipants } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  let round;
  try {
    round = await getSelectedRound();
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!round) return <p className="text-sm text-muted">Create a round on the overview first.</p>;

  const participants = await getParticipants(round.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Participants</h1>
        <p className="mt-1 text-sm text-muted">
          Each person gets a private link. There are no accounts and no passwords — the link{" "}
          <em>is</em> the login, so send it to them directly rather than posting it anywhere.
        </p>
      </div>
      <ParticipantsManager roundId={round.id} participants={participants} />
    </div>
  );
}
