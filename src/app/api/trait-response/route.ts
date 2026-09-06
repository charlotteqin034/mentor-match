import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getParticipantByToken } from "@/lib/data";
import { validateAnswers } from "@/lib/validation";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    answers?: unknown;
  };

  if (!body.token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const found = await getParticipantByToken(body.token);
  if (!found) return NextResponse.json({ error: "Unknown link." }, { status: 404 });

  const { participant, round } = found;
  if (round.stage !== "trait_survey") {
    return NextResponse.json({ error: "The trait survey is closed." }, { status: 409 });
  }

  const validated = validateAnswers(body.answers);
  if (!validated.ok) {
    return NextResponse.json(
      { error: "Some answers are missing.", errors: validated.errors },
      { status: 422 },
    );
  }

  const client = db();
  const { error } = await client
    .from("trait_responses")
    .upsert(
      {
        participant_id: participant.id,
        answers: validated.answers,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "participant_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the original completion time on edits — it's the "are they done?" flag.
  if (!participant.trait_completed_at) {
    await client
      .from("participants")
      .update({ trait_completed_at: new Date().toISOString() })
      .eq("id", participant.id);
  }

  return NextResponse.json({ ok: true });
}
