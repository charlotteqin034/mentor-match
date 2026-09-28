import "server-only";
import { cookies } from "next/headers";

/**
 * Who the browser says it is.
 *
 * The cookie holds the participant's token — the same credential the /s/<token>
 * links carry, just remembered rather than typed. It's httpOnly so page scripts
 * can't read it, and it survives a browser restart so nobody has to re-pick
 * their name halfway through a survey.
 */
const COOKIE_NAME = "mm_participant";
const DAYS = 45;

export async function getParticipantToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function setParticipantToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DAYS * 24 * 60 * 60,
  });
}

export async function clearParticipantToken(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
