import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getParticipantByToken, getParticipants } from "@/lib/data";

export const MIN_RANKS = 5;
export const MAX_RANKS = 8;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    ranked?: unknown;
  };

  if (!body.token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const found = await getParticipantByToken(body.token);
  if (!found) return NextResponse.json({ error: "Unknown link." }, { status: 404 });

  const { participant, round } = found;
  if (round.stage !== "ranking_survey") {
    return NextResponse.json({ error: "The ranking survey is closed." }, { status: 409 });
  }

  const ranked = Array.isArray(body.ranked)
    ? body.ranked.filter((x): x is string => typeof x === "string")
    : [];

  if (new Set(ranked).size !== ranked.length) {
    return NextResponse.json({ error: "Duplicate entries in the shortlist." }, { status: 422 });
  }

  const everyone = await getParticipants(round.id);
  const oppositeIds = new Set(
    everyone.filter((p) => p.role !== participant.role).map((p) => p.id),
  );

  // With a tiny cohort the floor can't exceed the number of people available.
  const required = Math.min(MIN_RANKS, oppositeIds.size);
  if (ranked.length < required || ranked.length > MAX_RANKS) {
    return NextResponse.json(
      { error: `Pick between ${required} and ${MAX_RANKS} profiles.` },
      { status: 422 },
    );
  }
  if (!ranked.every((id) => oppositeIds.has(id))) {
    return NextResponse.json({ error: "That shortlist contains someone you can't rank." }, { status: 422 });
  }

  const client = db();
  await client.from("rankings").delete().eq("ranker_id", participant.id);

  const rows = ranked.map((rankedId, index) => ({
    ranker_id: participant.id,
    ranked_id: rankedId,
    rank: index + 1,
  }));
  const { error } = await client.from("rankings").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!participant.ranking_completed_at) {
    await client
      .from("participants")
      .update({ ranking_completed_at: new Date().toISOString() })
      .eq("id", participant.id);
  }

  return NextResponse.json({ ok: true });
}
