import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getParticipants, getTraitResponses } from "@/lib/data";
import { buildCard, shuffled } from "@/lib/profile-cards";
import { db } from "@/lib/supabase";

/**
 * Stage 2 — generate anonymised profile cards (§6).
 *
 * Idempotent: an existing display_number is never reassigned, so links people
 * already have and rankings already submitted stay valid across regenerations.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { round_id?: string };
  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  const participants = await getParticipants(body.round_id);
  if (participants.length === 0) {
    return NextResponse.json({ error: "No participants in this round yet." }, { status: 422 });
  }

  const responses = await getTraitResponses(participants.map((p) => p.id));
  const answersById = new Map(responses.map((r) => [r.participant_id, r.answers]));

  // Numbers are unique across the whole round and deliberately shuffled, so
  // "Profile #14" leaks neither signup order nor which cohort someone is in.
  const taken = new Set(
    participants.map((p) => p.display_number).filter((n): n is number => n !== null),
  );
  const pool = shuffled(
    Array.from({ length: participants.length }, (_, i) => i + 1).filter((n) => !taken.has(n)),
  );

  const client = db();
  const numberUpdates: { id: string; display_number: number }[] = [];
  const numbersById = new Map<string, number>();

  for (const p of shuffled(participants)) {
    if (p.display_number !== null) {
      numbersById.set(p.id, p.display_number);
      continue;
    }
    const next = pool.pop();
    if (next === undefined) continue;
    numbersById.set(p.id, next);
    numberUpdates.push({ id: p.id, display_number: next });
  }

  for (const update of numberUpdates) {
    const { error } = await client
      .from("participants")
      .update({ display_number: update.display_number })
      .eq("id", update.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cards = [];
  const missing: string[] = [];
  for (const p of participants) {
    const answers = answersById.get(p.id);
    const displayNumber = numbersById.get(p.id);
    if (!answers || displayNumber === undefined) {
      missing.push(p.name);
      continue;
    }
    cards.push({
      participant_id: p.id,
      display_number: displayNumber,
      card: buildCard(p.role, displayNumber, answers),
      generated_at: new Date().toISOString(),
    });
  }

  if (cards.length > 0) {
    const { error } = await client
      .from("profile_cards")
      .upsert(cards, { onConflict: "participant_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generated: cards.length, missing });
}
