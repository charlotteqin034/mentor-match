import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getParticipants, getRankings, loadMatchInput } from "@/lib/data";
import { normaliseWeights } from "@/lib/scoring";
import { SHORTLIST_SIZE, buildShortlists } from "@/lib/shortlists";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";

/**
 * Builds each person's ranking shortlist (§7).
 *
 * Refuses to overwrite once anyone has ranked, unless explicitly forced:
 * regenerating moves the goalposts under rankings already submitted, and those
 * rankings point at candidates that might not be on the new list.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    round_id?: string;
    weights?: Record<string, unknown>;
    size?: number;
    force?: boolean;
  };
  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  const participants = await getParticipants(body.round_id);
  const alreadyRanked = participants.filter((p) => p.ranking_completed_at);
  if (alreadyRanked.length > 0 && !body.force) {
    return NextResponse.json(
      {
        error: `${alreadyRanked.length} ${
          alreadyRanked.length === 1 ? "person has" : "people have"
        } already submitted a ranking. Regenerating replaces what they were asked to rank — their answers would be discarded.`,
        needs_force: true,
        already_ranked: alreadyRanked.map((p) => p.name),
      },
      { status: 409 },
    );
  }

  const weights = normaliseWeights(body.weights ?? {});
  const size = Math.max(1, Math.min(body.size ?? SHORTLIST_SIZE, 12));

  const { bigs, littles, blocked } = await loadMatchInput(body.round_id, env.embeddingsEnabled);

  // Only someone with a generated card can appear on a shortlist — there'd be
  // nothing to show. People without one still get a shortlist of their own.
  const hasCard = (p: { id: string }) =>
    participants.some((x) => x.id === p.id && x.display_number !== null);
  const entries = buildShortlists(
    bigs.filter(hasCard),
    littles.filter(hasCard),
    weights,
    blocked,
    size,
  );

  const client = db();
  await client.from("shortlists").delete().eq("round_id", body.round_id);
  if (alreadyRanked.length > 0) {
    // Forced regeneration: the old rankings referred to a list that no longer
    // exists, so clear them rather than leave dangling picks behind.
    const ids = participants.map((p) => p.id);
    await client.from("rankings").delete().in("ranker_id", ids);
    await client
      .from("participants")
      .update({ ranking_completed_at: null })
      .in("id", ids);
  }

  const rows = entries.map((e) => ({
    round_id: body.round_id,
    participant_id: e.participant_id,
    candidate_id: e.candidate_id,
    position: e.position,
    score: e.score,
  }));

  if (rows.length > 0) {
    const { error } = await client.from("shortlists").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const remaining = await getRankings(participants.map((p) => p.id));
  return NextResponse.json({
    generated: rows.length,
    people: new Set(rows.map((r) => r.participant_id)).size,
    size,
    cleared_rankings: alreadyRanked.length > 0 ? alreadyRanked.length : 0,
    remaining_rankings: remaining.length,
  });
}
