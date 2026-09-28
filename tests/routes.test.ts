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
const { POST: profilesRoute } = await import("@/app/api/admin/profiles/route");
const { POST: rankingsRoute } = await import("@/app/api/rankings/route");
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
      role: "mentor",
      text: NAMES.map((n) => `${n} Mentor, ${n.toLowerCase()}.m@example.com`).join("\n"),
    }),
  );
  await participantsRoute(
    req("/api/admin/participants", {
      action: "bulk",
      round_id: roundId,
      role: "mentee",
      text: NAMES.map((n) => `${n} Mentee, ${n.toLowerCase()}.e@example.com`).join("\n"),
    }),
  );
  return roundId;
}

const people = () => store.tables.participants as unknown as {
  id: string;
  role: "mentor" | "mentee";
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
    const base = 1 + (i % 7);
    const res = await traitRoute(
      req("/api/trait-response", {
        token: p.token,
        answers: answersAt(base, {
          q23: 1 + ((i * 3) % 7),
          q26: i % 2 ? ["network", "confidence"] : ["career_clarity", "network"],
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
    const partial = answersAt(4);
    delete partial.q26;
    delete partial.q27;
    const res = await traitRoute(
      req("/api/trait-response", { token: people()[0].token, answers: partial }),
    );
    expect(res.status).toBe(422);
    const body = await json(res);
    expect(Object.keys(body.errors as object).sort()).toEqual(["q26", "q27"]);
    expect(store.tables.trait_responses).toHaveLength(0);
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
        role: "mentor",
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
          role: "mentee",
          text: "Valid Person, valid@example.com\nBroken Line\nAlso Broken, not-an-email",
        }),
      ),
    );
    expect(body.added).toBe(1);
    expect(body.problems).toHaveLength(2);
  });
});

describe("profile cards", () => {
  it("builds anonymous cards and keeps numbers stable across regeneration", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await submitAllTraits();

    const first = await json(await profilesRoute(req("/api/admin/profiles", { round_id: roundId })));
    expect(first.generated).toBe(12);

    const numbers = people().map((p) => p.display_number);
    expect(new Set(numbers).size).toBe(12);
    expect(numbers.every((n) => typeof n === "number")).toBe(true);

    const cards = store.tables.profile_cards;
    const serialised = JSON.stringify(cards);
    for (const p of people()) {
      expect(serialised).not.toContain(p.token);
      expect(serialised).not.toContain(p.name);
    }
    expect(serialised).not.toContain("@example.com");

    await profilesRoute(req("/api/admin/profiles", { round_id: roundId }));
    expect(people().map((p) => p.display_number)).toEqual(numbers);
  });

  it("skips people with no trait response and names them", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await traitRoute(
      req("/api/trait-response", { token: people()[0].token, answers: answersAt(4) }),
    );
    const body = await json(await profilesRoute(req("/api/admin/profiles", { round_id: roundId })));
    expect(body.generated).toBe(1);
    expect((body.missing as string[]).length).toBe(11);
  });
});

describe("rankings", () => {
  async function readyToRank() {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await submitAllTraits();
    await profilesRoute(req("/api/admin/profiles", { round_id: roundId }));
    await setStage(roundId, "ranking_survey");
    return roundId;
  }

  it("stores an ordered shortlist and marks the ranker done", async () => {
    await readyToRank();
    const mentor = people().find((p) => p.role === "mentor")!;
    const mentees = people().filter((p) => p.role === "mentee");
    const res = await rankingsRoute(
      req("/api/rankings", {
        token: mentor.token,
        ranked: mentees.slice(0, 5).map((p) => p.id),
      }),
    );
    expect(res.status).toBe(200);

    const stored = store.tables.rankings.filter((r) => r.ranker_id === mentor.id);
    expect(stored.map((r) => r.rank).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(people().find((p) => p.id === mentor.id)!.ranking_completed_at).toBeTruthy();
  });

  it("replaces a previous submission rather than appending to it", async () => {
    await readyToRank();
    const mentor = people().find((p) => p.role === "mentor")!;
    const mentees = people().filter((p) => p.role === "mentee");
    const body = { token: mentor.token, ranked: mentees.slice(0, 5).map((p) => p.id) };
    await rankingsRoute(req("/api/rankings", body));
    await rankingsRoute(
      req("/api/rankings", {
        token: mentor.token,
        ranked: mentees.slice(1, 6).map((p) => p.id),
      }),
    );
    expect(store.tables.rankings.filter((r) => r.ranker_id === mentor.id)).toHaveLength(5);
  });

  it("rejects a short shortlist, duplicates, and anyone from the ranker's own side", async () => {
    await readyToRank();
    const mentor = people().find((p) => p.role === "mentor")!;
    const mentors = people().filter((p) => p.role === "mentor");
    const mentees = people().filter((p) => p.role === "mentee");

    expect(
      (
        await rankingsRoute(
          req("/api/rankings", {
            token: mentor.token,
            ranked: mentees.slice(0, 3).map((p) => p.id),
          }),
        )
      ).status,
    ).toBe(422);

    expect(
      (
        await rankingsRoute(
          req("/api/rankings", {
            token: mentor.token,
            ranked: [...mentees.slice(0, 4), mentees[0]].map((p) => p.id),
          }),
        )
      ).status,
    ).toBe(422);

    expect(
      (
        await rankingsRoute(
          req("/api/rankings", {
            token: mentor.token,
            ranked: [...mentees.slice(0, 4), mentors[1]].map((p) => p.id),
          }),
        )
      ).status,
    ).toBe(422);
  });
});

describe("matching, override and publishing", () => {
  async function readyToMatch() {
    const roundId = await seedRound();
    await setStage(roundId, "trait_survey");
    await submitAllTraits();
    await profilesRoute(req("/api/admin/profiles", { round_id: roundId }));
    await setStage(roundId, "ranking_survey");

    const mentors = people().filter((p) => p.role === "mentor");
    const mentees = people().filter((p) => p.role === "mentee");
    // Everyone ranks except the last mentor — matching must cope with that.
    for (const [i, mentor] of mentors.slice(0, -1).entries()) {
      await rankingsRoute(
        req("/api/rankings", {
          token: mentor.token,
          ranked: [...mentees.slice(i), ...mentees.slice(0, i)].slice(0, 5).map((p) => p.id),
        }),
      );
    }
    for (const [i, mentee] of mentees.entries()) {
      await rankingsRoute(
        req("/api/rankings", {
          token: mentee.token,
          ranked: [...mentors.slice(i), ...mentors.slice(0, i)].slice(0, 5).map((p) => p.id),
        }),
      );
    }
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
      unmatched_mentors: string[];
      average_score: number;
    };

    expect(result.pairs).toHaveLength(6);
    expect(result.unmatched_mentors).toHaveLength(0);
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
    const firstPair = (before.result as { pairs: { mentor_id: string; mentee_id: string }[] })
      .pairs[0];

    await blockedRoute(
      req("/api/admin/blocked", {
        action: "add",
        round_id: roundId,
        participant_a: firstPair.mentor_id,
        participant_b: firstPair.mentee_id,
      }),
    );

    const after = await json(
      await matchRoute(req("/api/admin/match", { round_id: roundId, persist: false })),
    );
    const pairs = (after.result as { pairs: { mentor_id: string; mentee_id: string; blocked: boolean }[] })
      .pairs;
    expect(
      pairs.some(
        (p) => p.mentor_id === firstPair.mentor_id && p.mentee_id === firstPair.mentee_id,
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

describe("CSV export", () => {
  it("exports links with both survey URLs", async () => {
    const roundId = await seedRound();
    const res = await exportRoute(
      new Request(`http://localhost/api/admin/export?kind=links&round=${roundId}`),
    );
    const text = await res.text();
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(text.split("\r\n")).toHaveLength(13); // header + 12 people
    expect(text).toContain(`http://localhost/s/${people()[0].token}`);
    expect(text).toContain(`http://localhost/r/${people()[0].token}`);
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
    expect(lines[0]).toBe("mentor_name,mentor_email,mentee_name,mentee_email,score");
    expect(lines).toHaveLength(7);
    expect(lines[1]).toMatch(/Mentor,.+@example\.com,.+Mentee,.+@example\.com,0\.\d{4}/);
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
    expect(destinationForStage("ranking_survey")).toBe("/r");
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

  it("hands out the ranking survey once the round moves on", async () => {
    const roundId = await seedRound();
    await setStage(roundId, "ranking_survey");
    const body = await json(await joinRoute(req("/api/join", { participant_id: people()[0].id })));
    expect(body.next).toBe("/r");
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
