import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getMatchRun } from "@/lib/data";
import { db } from "@/lib/supabase";

/** Marks a saved run as the published result for its round. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    round_id?: string;
    run_id?: string;
    unpublish?: boolean;
  };
  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  const client = db();

  if (body.unpublish) {
    const { error } = await client
      .from("rounds")
      .update({ published_run_id: null, stage: "matching" })
      .eq("id", body.round_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.run_id) return NextResponse.json({ error: "Pick a run to publish." }, { status: 400 });
  const run = await getMatchRun(body.run_id);
  if (!run || run.round_id !== body.round_id) {
    return NextResponse.json({ error: "That run isn't part of this round." }, { status: 404 });
  }

  const { error } = await client
    .from("rounds")
    .update({ published_run_id: body.run_id, stage: "published" })
    .eq("id", body.round_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
