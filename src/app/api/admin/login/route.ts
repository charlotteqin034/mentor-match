import { NextResponse } from "next/server";
import { checkPassword, startAdminSession } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: string };

  if (!env.adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }
  if (!env.sessionSecret) {
    return NextResponse.json(
      { error: "ADMIN_SESSION_SECRET is not set on the server." },
      { status: 500 },
    );
  }
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  await startAdminSession();
  return NextResponse.json({ ok: true });
}
