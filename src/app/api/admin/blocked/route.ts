import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getBlockedPairs } from "@/lib/data";
import { db } from "@/lib/supabase";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "add" | "delete";
    round_id?: string;
    participant_a?: string;
    participant_b?: string;
    id?: string;
  };

  const client = db();

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await client.from("blocked_pairs").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "add") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (!body.round_id || !body.participant_a || !body.participant_b) {
    return NextResponse.json({ error: "Pick two people." }, { status: 400 });
  }
  if (body.participant_a === body.participant_b) {
    return NextResponse.json({ error: "That's the same person twice." }, { status: 422 });
  }

  const existing = await getBlockedPairs(body.round_id);
  const already = existing.some(
    (p) =>
      (p.participant_a === body.participant_a && p.participant_b === body.participant_b) ||
      (p.participant_a === body.participant_b && p.participant_b === body.participant_a),
  );
  if (already) return NextResponse.json({ error: "That pair is already blocked." }, { status: 409 });

  const { error } = await client.from("blocked_pairs").insert({
    round_id: body.round_id,
    participant_a: body.participant_a,
    participant_b: body.participant_b,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
