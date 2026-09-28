import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getParticipantByToken, getShortlists } from "@/lib/data";
import { RANK_COUNT } from "@/lib/shortlists";

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

  // People rank within the shortlist they were offered, not the whole cohort.
  const shortlist = await getShortlists([participant.id]);
  if (shortlist.length === 0) {
    return NextResponse.json(
      { error: "You haven't been given any profiles to rank yet." },
      { status: 409 },
    );
  }
  const offered = new Set(shortlist.map((s) => s.candidate_id));

  // A shortlist shorter than the target can't be ranked any deeper than it is.
  const required = Math.min(RANK_COUNT, offered.size);
  if (ranked.length !== required) {
    return NextResponse.json(
      { error: `Put exactly ${required} in order.` },
      { status: 422 },
    );
  }
  if (!ranked.every((id) => offered.has(id))) {
    return NextResponse.json(
      { error: "That ranking includes someone who wasn't on your shortlist." },
      { status: 422 },
    );
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
