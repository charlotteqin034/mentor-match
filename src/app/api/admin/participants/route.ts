import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { generateToken } from "@/lib/tokens";

type Row = { name: string; email: string; role: "mentor" | "mentee" };

/**
 * Parses pasted rows. Accepts comma or tab separated `name, email, role`,
 * and falls back to a `role` supplied for the whole paste when a line omits it.
 */
export function parseBulk(text: string, defaultRole?: "mentor" | "mentee"): {
  rows: Row[];
  problems: string[];
} {
  const rows: Row[] = [];
  const problems: string[] = [];

  for (const [i, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\t|,/).map((p) => p.trim());
    const [name, email, roleRaw] = parts;
    const role = (roleRaw?.toLowerCase() as "mentor" | "mentee") || defaultRole;

    if (!name || !email) {
      problems.push(`Line ${i + 1}: need at least a name and an email.`);
      continue;
    }
    if (!email.includes("@")) {
      problems.push(`Line ${i + 1}: "${email}" doesn't look like an email.`);
      continue;
    }
    if (role !== "mentor" && role !== "mentee") {
      problems.push(`Line ${i + 1}: role must be "mentor" or "mentee".`);
      continue;
    }
    rows.push({ name, email, role });
  }

  return { rows, problems };
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "add" | "bulk" | "delete" | "regenerate_token" | "set_role";
    round_id?: string;
    participant_id?: string;
    name?: string;
    email?: string;
    role?: "mentor" | "mentee";
    text?: string;
  };

  const client = db();

  if (body.action === "delete") {
    if (!body.participant_id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const { error } = await client.from("participants").delete().eq("id", body.participant_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "regenerate_token") {
    if (!body.participant_id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    const token = generateToken();
    const { error } = await client
      .from("participants")
      .update({ token })
      .eq("id", body.participant_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, token });
  }

  if (body.action === "set_role") {
    if (!body.participant_id || (body.role !== "mentor" && body.role !== "mentee")) {
      return NextResponse.json({ error: "Missing id or role." }, { status: 400 });
    }
    const { error } = await client
      .from("participants")
      .update({ role: body.role })
      .eq("id", body.participant_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.round_id) return NextResponse.json({ error: "Missing round." }, { status: 400 });

  let rows: Row[] = [];
  let problems: string[] = [];

  if (body.action === "add") {
    const parsed = parseBulk(`${body.name ?? ""},${body.email ?? ""}`, body.role);
    rows = parsed.rows;
    problems = parsed.problems;
  } else if (body.action === "bulk") {
    const parsed = parseBulk(body.text ?? "", body.role);
    rows = parsed.rows;
    problems = parsed.problems;
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nothing to add.", problems }, { status: 422 });
  }

  const inserts = rows.map((r) => ({
    round_id: body.round_id,
    role: r.role,
    name: r.name,
    email: r.email,
    token: generateToken(),
  }));

  const { data, error } = await client.from("participants").insert(inserts).select();
  if (error) {
    const duplicate = error.message.includes("participants_round_email_idx");
    return NextResponse.json(
      {
        error: duplicate
          ? "Someone in that list is already in this round (emails must be unique)."
          : error.message,
        problems,
      },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ added: data?.length ?? 0, problems });
}
