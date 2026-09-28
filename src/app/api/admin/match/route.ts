import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { loadMatchInput } from "@/lib/data";
import { runMatching } from "@/lib/matching";
import { normaliseWeights } from "@/lib/scoring";
import { db } from "@/lib/supabase";
import { env } from "@/lib/env";

/**
 * Stage 4 — run the match (§9).
 *
 * `persist: false` (used by the live weight sliders) computes and returns
 * without writing, so dragging a slider doesn't fill the run history with
 * noise. The "Run matching" button sends `persist: true`.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    round_id?: string;
    weights?: Record<string, unknown>;
    persist?: boolean;
    embeddings?: boolean;
  };
  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  const weights = normaliseWeights(body.weights ?? {});
  const useEmbeddings = body.embeddings ?? env.embeddingsEnabled;

  let input;
  try {
    input = await loadMatchInput(body.round_id, useEmbeddings);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not load the round." },
      { status: 500 },
    );
  }

  const { bigs, littles, blocked, participants } = input;
  const result = runMatching(bigs, littles, weights, blocked);

  let runId: string | null = null;
  if (body.persist) {
    const { data, error } = await db()
      .from("match_runs")
      .insert({
        round_id: body.round_id,
        weights,
        results: result.pairs,
        total_score: result.total_score,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    runId = data.id as string;
  }

  return NextResponse.json({
    run_id: runId,
    weights,
    embeddings_used: useEmbeddings,
    result,
    people: participants.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      display_number: p.display_number,
      trait_completed: Boolean(p.trait_completed_at),
      ranking_completed: Boolean(p.ranking_completed_at),
    })),
  });
}
