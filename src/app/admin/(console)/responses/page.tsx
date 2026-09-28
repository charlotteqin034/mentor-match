import { ConfigError } from "@/components/admin/ConfigError";
import { ResponsesTable, type ResponseRow } from "@/components/admin/ResponsesTable";
import { getSelectedRound } from "@/lib/admin";
import { getParticipants, getTraitResponses } from "@/lib/data";
import { buildCard } from "@/lib/profile-cards";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  let round;
  try {
    round = await getSelectedRound();
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!round) return <p className="text-sm text-muted">Create a round on the overview first.</p>;

  const participants = await getParticipants(round.id);
  const ids = participants.map((p) => p.id);
  const responses = await getTraitResponses(ids);
  const answersById = new Map(responses.map((r) => [r.participant_id, r]));
  const nameById = new Map(participants.map((p) => [p.id, p.name]));

  const rows: ResponseRow[] = participants.map((p) => {
    const answers = (answersById.get(p.id)?.answers as Record<string, unknown>) ?? null;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      submitted_at: answersById.get(p.id)?.submitted_at ?? null,
      answers,
      card: answers ? buildCard(p.role, answers) : null,
      preferences: Array.isArray(answers?.q32)
        ? (answers.q32 as string[]).map((id) => nameById.get(id) ?? "(removed)")
        : [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Responses</h1>
        <p className="mt-1 text-sm text-muted">
          Every trait answer, plus the card it generates. Click a row to open it.
        </p>
      </div>
      <ResponsesTable rows={rows} />
    </div>
  );
}
