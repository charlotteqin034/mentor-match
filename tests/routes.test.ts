/**
 * End-to-end pass over the real route handlers, against an in-memory database.
 *
 * Covers the whole organiser flow: create a round, add people, run the trait
 * survey, generate cards, run the ranking survey, match, override, publish and
 * export — plus the stage gates that keep participants out of the wrong stage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, type FakeSupabase } from "./fake-supabase";
import { answersAt } from "./fixtures";

let store: FakeSupabase;
const cookieStore = new Map<string, string>();

vi.mock("@/lib/supabase", () => ({ db: () => store }));
vi.mock("@/lib/auth", () => ({
  requireAdmin: async () => null,
  isAdmin: async () => true,
  checkPassword: () => true,
  startAdminSession: async () => {},
  endAdminSession: async () => {},
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (cookieStore.has(k) ? { value: cookieStore.get(k) } : undefined),
    set: (k: string, v: string) => cookieStore.set(k, v),
    delete: (k: string) => cookieStore.delete(k),
  }),
}));

const { POST: roundRoute } = await import("@/app/api/admin/round/route");
const { POST: participantsRoute } = await import("@/app/api/admin/participants/route");
const { POST: traitRoute } = await import("@/app/api/trait-response/route");
const { POST: blockedRoute } = await import("@/app/api/admin/blocked/route");
const { POST: matchRoute } = await import("@/app/api/admin/match/route");
const { POST: runsRoute } = await import("@/app/api/admin/runs/route");
const { POST: publishRoute } = await import("@/app/api/admin/publish/route");
const { GET: exportRoute } = await import("@/app/api/admin/export/route");
const { POST: joinRoute, destinationForStage } = await import("@/app/api/join/route");
const { getParticipantToken } = await import("@/lib/participant-session");

const req = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

type Json = Record<string, never> & Record<string, unknown>;
const json = async (res: Response) => (await res.json()) as Json;

const NAMES = ["Ada", "Grace", "Katherine", "Radia", "Barbara", "Annie"];

async function seedRound() {
  const created = await json(await roundRoute(req("/api/admin/round", {
    action: "create",
    name: "Fall 2026",
  })));
  const roundId = (created.round as { id: string }).id;

  await participantsRoute(
    req("/api/admin/participants", {
      action: "bulk",
      round_id: roundId,
      role: "big",
      text: NAMES.map((n) => `${n} Big, ${n.toLowerCase()}.m@example.com`).join("\n"),
    }),
  );
  await participantsRoute(
    req("/api/admin/participants", {
      action: "bulk",
      round_id: roundId,
      role: "little",
      text: NAMES.map((n) => `${n} Little, ${n.toLowerCase()}.e@example.com`).join("\n"),
    }),
  );
  return roundId;
}

const people = () => store.tables.participants as unknown as {
  id: string;
  role: "big" | "little";
  name: string;
  token: string;
  display_number: number | null;
  trait_completed_at: string | null;
  ranking_completed_at: string | null;
}[];

const setStage = (roundId: string, stage: string) =>
  roundRoute(req("/api/admin/round", { action: "set_stage", round_id: roundId, stage }));

async function submitAllTraits() {
  for (const [i, p] of people().entries()) {
    // Spread the answers out so pairs don't all score identically.
    const base = 1 + (i % 5);
    const res = await traitRoute(
      req("/api/trait-response", {
        token: p.token,
        answers: answersAt(base, {
          q23: 1 + ((i * 3) % 5),
          q26: i % 2 ? ["network", "social"] : ["career_clarity", "network"],
        }),
      }),
    );
    expect(res.status).toBe(200);
  }
}

beforeEach(() => {
  store = createFakeSupabase();
  cookieStore.clear();
});

describe("stage gating", () => {
  it("refuses the trait survey before the stage opens and after it closes", async () => {
    const roundId = await seedRound();
    const token = people()[0].token;

    const early = await traitRoute(
      req("/api/trait-response", { token, answers: answersAt(4) }),
    );
    expect(early.status).toBe(409);

    await setStage(roundId, "trait_survey");
    expect(
      (await traitRoute(req("/api/trait-response", { token, answers: answersAt(4) }))).status,
    ).toBe(200);

    await setStage(roundId, "matching");
    expect(
      (await traitRoute(req("/api/trait-response", { token, answers: answersAt(5) }))).status,
    ).toBe(409);
  });

  it("rejects an unknown token", async () => {
    await seedRound();
    const res = await traitRoute(
      req("/api/trait-response", { token: "nope", answers: answersAt(4) }),
    );
    expect(res.status).toBe(404);
  });

  it("rejects an incomplete answer set with per-question errors", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const little = people().find((p) => p.role === "little")!;
    const partial = answersAt(3);
    delete partial.q26;
    delete partial.q27;
    const res = await traitRoute(
      req("/api/trait-response", { token: little.token, answers: partial }),
    );
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(Object.keys(body.errors as object).sort()).toEqual(["q26", "q27"]);
    expect(store.tables.trait_responses).toHaveLength(0);
  });

  it("doesn't ask a big for q26 at all", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const big = people().find((p) => p.role === "big")!;

    const withoutQ26 = answersAt(3);
    delete withoutQ26.q26;
    const res = await traitRoute(
      req("/api/trait-response", { token: big.token, answers: withoutQ26 }),
    );
    expect(res.status).toBe(200);
  });

  it("drops q26 from a big's stored answers even if it's submitted", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const big = people().find((p) => p.role === "big")!;

    await traitRoute(
      req("/api/trait-response", {
        token: big.token,
        answers: answersAt(3, { q26: ["network", "social"] }),
      }),
    );
    const stored = store.tables.trait_responses[0].answers as Record<string, unknown>;
    expect(stored).not.toHaveProperty("q26");
    expect(stored).toHaveProperty("q27");
  });
});

describe("participants", () => {
  it("refuses a duplicate email inside one round", async () => {
    const roundId = await seedRound();
    const res = await participantsRoute(
      req("/api/admin/participants", {
        action: "add",
        round_id: roundId,
        name: "Ada Again",
        email: "ada.m@example.com",
        role: "big",
      }),
    );
    expect(res.status).toBe(409);
  });

  it("reports unparseable lines instead of dropping them silently", async () => {
    const roundId = await seedRound();
    const body = await json(
      await participantsRoute(
        req("/api/admin/participants", {
          action: "bulk",
          round_id: roundId,
          role: "little",
          text: "Valid Person, valid@example.com\nBroken Line\nAlso Broken, not-an-email",
        }),
      ),
    );
    expect(body.added).toBe(1);
    expect(body.problems).toHaveLength(2);
  });
});

describe("matching, override and publishing", () => {
  async function readyToMatch() {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await submitAllTraits();
    await setStage(roundId, "matching");
    return roundId;
  }

  it("runs, saves the run, and returns a component breakdown for every pair", async () => {
    const roundId = await readyToMatch();
    const body = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: true })),
    );
    const result = body.result as {
      pairs: { total: number; components: Record<string, number | null> }[];
      unmatched_bigs: string[];
      average_score: number;
    };

    expect(result.pairs).toHaveLength(6);
    expect(result.unmatched_bigs).toHaveLength(0);
    for (const pair of result.pairs) {
      expect(pair.total).toBeGreaterThan(0);
      expect(pair.total).toBeLessThanOrEqual(1);
      expect(pair.components.traits).not.toBeNull();
      expect(pair.components.openText).toBeNull(); // embeddings off by default
    }
    expect(store.tables.match_runs).toHaveLength(1);
    expect(body.run_id).toBeTruthy();
  });

  it("does not save when persist is false", async () => {
    const roundId = await readyToMatch();
    await matchRoute(req("/api/admin/match", { round_id: roundId, persist: false }));
    expect(store.tables.match_runs).toHaveLength(0);
  });

  it("keeps a blocked pair out of the assignment", async () => {
    const roundId = await readyToMatch();
    const before = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: false })),
    );
    const firstPair = (before.result as { pairs: { big_id: string; little_id: string }[] })
      .pairs[0];

    await blockedRoute(
      req("/api/admin/blocked", {
        action: "add",
        round_id: roundId,
        participant_a: firstPair.big_id,
        participant_b: firstPair.little_id,
      }),
    );

    const after = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: false })),
    );
    const pairs = (after.result as { pairs: { big_id: string; little_id: string; blocked: boolean }[] })
      .pairs;
    expect(
      pairs.some(
        (p) => p.big_id === firstPair.big_id && p.little_id === firstPair.little_id,
      ),
    ).toBe(false);
    expect(pairs.every((p) => !p.blocked)).toBe(true);
  });

  it("saves a hand-edited arrangement and publishes it", async () => {
    const roundId = await readyToMatch();
    const body = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: true })),
    );
    const pairs = (body.result as { pairs: Record<string, unknown>[] }).pairs;

    const saved = await json(
      await runsRoute(
        req("/api/admin/runs", { round_id: roundId, weights: body.weights, pairs }),
      ),
    );
    expect(store.tables.match_runs).toHaveLength(2);

    const published = await publishRoute(
      req("/api/admin/publish", { round_id: roundId, run_id: saved.run_id }),
    );
    expect(published.status).toBe(200);

    const round = store.tables.rounds[0];
    expect(round.stage).toBe("published");
    expect(round.published_run_id).toBe(saved.run_id);
  });

  it("refuses to publish a run from another round", async () => {
    const roundId = await readyToMatch();
    await matchRoute(req("/api/admin/match", { round_id: roundId, persist: true }));
    const otherRound = await json(
      await roundRoute(req("/api/admin/round", { action: "create", name: "Spring" })),
    );
    const res = await publishRoute(
      req("/api/admin/publish", {
        round_id: (otherRound.round as { id: string }).id,
        run_id: store.tables.match_runs[0].id,
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("naming a preference", () => {
  it("stores the ids someone named", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const big = people().find((p) => p.role === "big")!;
    const wanted = people().filter((p) => p.role === "little").slice(0, 2);

    const res = await traitRoute(
      req("/api/trait-response", {
        token: big.token,
        answers: answersAt(3, { q32: wanted.map((p) => p.id) }),
      }),
    );
    expect(res.status).toBe(200);
    expect(store.tables.trait_responses[0].answers).toMatchObject({
      q32: wanted.map((p) => p.id),
    });
  });

  it("is optional — naming nobody is fine", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const noPreference = answersAt(3);
    delete noPreference.q32;
    const res = await traitRoute(
      req("/api/trait-response", { token: people()[0].token, answers: noPreference }),
    );
    expect(res.status).toBe(200);
    expect((store.tables.trait_responses[0].answers as Record<string, unknown>).q32).toEqual([]);
  });

  it("refuses someone from the ranker's own side, or a stranger", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const big = people().find((p) => p.role === "big")!;
    const anotherBig = people().filter((p) => p.role === "big")[1];

    const ownSide = await traitRoute(
      req("/api/trait-response", {
        token: big.token,
        answers: answersAt(3, { q32: [anotherBig.id] }),
      }),
    );
    expect(ownSide.status).toBe(422);

    const stranger = await traitRoute(
      req("/api/trait-response", {
        token: big.token,
        answers: answersAt(3, { q32: ["not-a-real-id"] }),
      }),
    );
    expect(stranger.status).toBe(422);
  });

  it("caps how many people one person can name", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const big = people().find((p) => p.role === "big")!;
    const everyone = people().filter((p) => p.role === "little");
    const res = await traitRoute(
      req("/api/trait-response", {
        token: big.token,
        answers: answersAt(3, { q32: everyone.map((p) => p.id) }),
      }),
    );
    expect(res.status).toBe(422);
  });
});

describe("CSV export", () => {
  it("exports one survey link per person", async () => {
    const roundId = await seedRound();
    const res = await exportRoute(
      new Request(`http://localhost/api/admin/export?kind=links&round=${roundId}`),
    );
    const text = await res.text();
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(text.split("\r\n")).toHaveLength(13); // header + 12 people
    expect(text).toContain(`http://localhost/s/${people()[0].token}`);
    expect(text).not.toContain("/r/"); // the ranking round is gone
  });

  it("exports the published pairings with names, emails and scores", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await submitAllTraits();
    await setStage(roundId, "matching");
    const body = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: true })),
    );
    await publishRoute(req("/api/admin/publish", { round_id: roundId, run_id: body.run_id }));

    const res = await exportRoute(
      new Request(`http://localhost/api/admin/export?kind=pairings&round=${roundId}`),
    );
    const text = await res.text();
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("big_name,big_email,little_name,little_email,score");
    expect(lines).toHaveLength(7);
    expect(lines[1]).toMatch(/Big,.+@example\.com,.+Little,.+@example\.com,0\.\d{4}/);
  });

  it("says so plainly when nothing is published yet", async () => {
    const roundId = await seedRound();
    const res = await exportRoute(
      new Request(`http://localhost/api/admin/export?kind=pairings&round=${roundId}`),
    );
    expect(res.status).toBe(404);
  });
});

describe("picking your name from the shared link", () => {
  it("routes each stage to the right survey", () => {
    expect(destinationForStage("trait_survey")).toBe("/s");
    expect(destinationForStage("setup")).toBe("/");
    expect(destinationForStage("matching")).toBe("/");
    expect(destinationForStage("published")).toBe("/");
  });

  it("remembers who you said you were and sends you to the open survey", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const me = people()[0];

    const res = await joinRoute(req("/api/join", { participant_id: me.id }));
    expect(res.status).toBe(200);
    expect((await json(res)).next).toBe("/s");
    expect(await getParticipantToken()).toBe(me.token);
  });

  it("sends people back to the start once the survey closes", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "matching");
    const body = await json(await joinRoute(req("/api/join", { participant_id: people()[0].id })));
    expect(body.next).toBe("/");
  });

  it("lets someone hand the device over", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await joinRoute(req("/api/join", { participant_id: people()[0].id }));
    expect(await getParticipantToken()).toBeTruthy();

    await joinRoute(req("/api/join", { action: "leave" }));
    expect(await getParticipantToken()).toBeNull();
  });

  it("refuses a name that isn't in this round", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");

    expect((await joinRoute(req("/api/join", { participant_id: "nobody" }))).status).toBe(404);
    expect((await joinRoute(req("/api/join", {}))).status).toBe(400);
    expect(await getParticipantToken()).toBeNull();
  });

  it("refuses someone belonging to a previous round", async () => {
    const firstRound = await seedRound();
    await setStage(firstRound, "trait_survey");
    const oldParticipant = people()[0];

    // A newer round becomes the current one.
    await roundRoute(req("/api/admin/round", { action: "create", name: "Spring 2027" }));

    const res = await joinRoute(req("/api/join", { participant_id: oldParticipant.id }));
    expect(res.status).toBe(404);
    expect(await getParticipantToken()).toBeNull();
  });

  it("still accepts the token a direct link carries", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    const me = people()[0];
    // The submit endpoints are token-based either way, so a direct /s/<token>
    // link and a name pick end up in exactly the same place.
    const res = await traitRoute(
      req("/api/trait-response", { token: me.token, answers: answersAt(4) }),
    );
    expect(res.status).toBe(200);
  });
});
