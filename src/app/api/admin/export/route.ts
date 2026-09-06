import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { getMatchRun, getParticipants, getRound } from "@/lib/data";

/**
 * CSV exports:
 *   ?kind=links     — name, email, role, survey links (for a mail merge)
 *   ?kind=pairings  — the published (or a named) run's final pairings
 */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const roundId = url.searchParams.get("round");
  const kind = url.searchParams.get("kind") ?? "links";
  if (!roundId) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  const round = await getRound(roundId);
  if (!round) return NextResponse.json({ error: "Unknown round." }, { status: 404 });

  const participants = await getParticipants(roundId);
  const slug = round.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  if (kind === "links") {
    const origin = url.origin;
    const csv = toCsv(
      ["name", "email", "role", "trait_survey_link", "ranking_survey_link", "done_trait", "done_ranking"],
      participants.map((p) => [
        p.name,
        p.email,
        p.role,
        `${origin}/s/${p.token}`,
        `${origin}/r/${p.token}`,
        p.trait_completed_at ? "yes" : "no",
        p.ranking_completed_at ? "yes" : "no",
      ]),
    );
    return csvResponse(`${slug}-links.csv`, csv);
  }

  if (kind === "pairings") {
    const runId = url.searchParams.get("run") ?? round.published_run_id;
    if (!runId) {
      return NextResponse.json({ error: "No run has been published yet." }, { status: 404 });
    }
    const run = await getMatchRun(runId);
    if (!run || run.round_id !== roundId) {
      return NextResponse.json({ error: "Unknown run." }, { status: 404 });
    }

    const byId = new Map(participants.map((p) => [p.id, p]));
    const csv = toCsv(
      ["mentor_name", "mentor_email", "mentee_name", "mentee_email", "score"],
      run.results.map((r) => {
        const mentor = byId.get(r.mentor_id);
        const mentee = byId.get(r.mentee_id);
        return [
          mentor?.name ?? "(removed)",
          mentor?.email ?? "",
          mentee?.name ?? "(removed)",
          mentee?.email ?? "",
          r.total.toFixed(4),
        ];
      }),
    );
    return csvResponse(`${slug}-pairings.csv`, csv);
  }

  return NextResponse.json({ error: "Unknown export." }, { status: 400 });
}
