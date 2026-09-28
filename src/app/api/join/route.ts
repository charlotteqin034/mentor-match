import { NextResponse } from "next/server";
import { getCurrentRound, getParticipantById } from "@/lib/data";
import { clearParticipantToken, setParticipantToken } from "@/lib/participant-session";
import type { Stage } from "@/lib/types";

/** Where someone should land once we know who they are. */
export function destinationForStage(stage: Stage): string {
  return stage === "trait_survey" ? "/s" : "/";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    participant_id?: string;
    action?: "leave";
  };

  if (body.action === "leave") {
    await clearParticipantToken();
    return NextResponse.json({ ok: true });
  }

  if (!body.participant_id) {
    return NextResponse.json({ error: "Pick your name from the list." }, { status: 400 });
  }

  const round = await getCurrentRound();
  if (!round) {
    return NextResponse.json({ error: "There's no round open right now." }, { status: 404 });
  }

  const participant = await getParticipantById(body.participant_id);
  if (!participant || participant.round_id !== round.id) {
    return NextResponse.json(
      { error: "That name isn't on the list for this round." },
      { status: 404 },
    );
  }

  await setParticipantToken(participant.token);
  return NextResponse.json({ ok: true, next: destinationForStage(round.stage) });
}
