import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "./env";

const COOKIE_NAME = "mm_admin";
const SESSION_HOURS = 12;

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  if (!env.adminPassword) return false;
  return safeEqual(input, env.adminPassword);
}

function mintSession(): string {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${expires}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

function verifySession(value: string | undefined): boolean {
  if (!value || !env.sessionSecret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, mac] = parts;
  if (!safeEqual(mac, sign(`${expires}.${nonce}`))) return false;
  return Number(expires) > Date.now();
}

export async function startAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, mintSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(COOKIE_NAME)?.value);
}

/** For route handlers: returns a 401 response when not signed in, else null. */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "Not signed in." }, { status: 401 });
}
