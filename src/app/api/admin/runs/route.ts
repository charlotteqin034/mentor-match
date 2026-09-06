import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { normaliseWeights } from "@/lib/scoring";
import { db } from "@/lib/supabase";
import type { MatchRunResultRow } from "@/lib/types";

/** Saves a run — including one the organiser has hand-edited via the override tool. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    round_id?: string;
    weights?: Record<string, unknown>;
    pairs?: MatchRunResultRow[];
  };

  if (!body.round_id || !Array.isArray(body.pairs)) {
    return NextResponse.json({ error: "Missing round or pairs." }, { status: 400 });
  }

  const totalScore = body.pairs.reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  const { data, error } = await db()
    .from("match_runs")
    .insert({
      round_id: body.round_id,
      weights: normaliseWeights(body.weights ?? {}),
      results: body.pairs,
      total_score: totalScore,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ run_id: data.id });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const { error } = await db().from("match_runs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
