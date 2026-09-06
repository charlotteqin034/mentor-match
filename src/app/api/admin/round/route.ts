import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/lib/supabase";
import { ROUND_COOKIE } from "@/lib/admin";
import { STAGES, type Stage } from "@/lib/types";

/** Create a round, or move one between stages. */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "create" | "set_stage" | "rename" | "select" | "delete";
    round_id?: string;
    name?: string;
    stage?: string;
  };

  const client = db();

  if (body.action === "create") {
    const name = body.name?.trim() || `Round ${new Date().toLocaleDateString()}`;
    const { data, error } = await client
      .from("rounds")
      .insert({ name, stage: "setup" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const store = await cookies();
    store.set(ROUND_COOKIE, data.id as string, { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.json({ round: data });
  }

  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  if (body.action === "select") {
    const store = await cookies();
    store.set(ROUND_COOKIE, body.round_id, { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    const { error } = await client.from("rounds").delete().eq("id", body.round_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const store = await cookies();
    if (store.get(ROUND_COOKIE)?.value === body.round_id) store.delete(ROUND_COOKIE);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "rename") {
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: "Name can't be blank." }, { status: 422 });
    const { error } = await client.from("rounds").update({ name }).eq("id", body.round_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_stage") {
    if (!STAGES.includes(body.stage as Stage)) {
      return NextResponse.json({ error: "Unknown stage." }, { status: 422 });
    }
    const { error } = await client
      .from("rounds")
      .update({ stage: body.stage })
      .eq("id", body.round_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
