import "server-only";
import { cookies } from "next/headers";
import { getCurrentRound, getRound } from "./data";
import type { Round } from "./types";

export const ROUND_COOKIE = "mm_round";

/**
 * The round the console is pointed at: whatever the organiser last selected,
 * falling back to the most recently created round.
 */
export async function getSelectedRound(): Promise<Round | null> {
  const store = await cookies();
  const id = store.get(ROUND_COOKIE)?.value;
  if (id) {
    const round = await getRound(id);
    if (round) return round;
  }
  return getCurrentRound();
}
