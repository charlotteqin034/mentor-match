import "server-only";
import { db } from "./supabase";
import { loadEmbeddings } from "./embeddings";
import type { MatchParticipant } from "./matching";
import type {
  BlockedPair,
  MatchRun,
  Participant,
  Round,
  TraitResponse,
} from "./types";

export async function listRounds(): Promise<Round[]> {
  const { data, error } = await db()
    .from("rounds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Round[];
}

export async function getRound(id: string): Promise<Round | null> {
  const { data } = await db().from("rounds").select("*").eq("id", id).maybeSingle();
  return (data as Round) ?? null;
}

/** The round the admin console operates on by default: the most recent one. */
export async function getCurrentRound(): Promise<Round | null> {
  const rounds = await listRounds();
  return rounds[0] ?? null;
}

export async function getParticipants(roundId: string): Promise<Participant[]> {
  const { data, error } = await db()
    .from("participants")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Participant[];
}

export async function getParticipantByToken(
  token: string,
): Promise<{ participant: Participant; round: Round } | null> {
  const { data } = await db().from("participants").select("*").eq("token", token).maybeSingle();
  if (!data) return null;
  const participant = data as Participant;
  const round = await getRound(participant.round_id);
  if (!round) return null;
  return { participant, round };
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  const { data } = await db().from("participants").select("*").eq("id", id).maybeSingle();
  return (data as Participant) ?? null;
}

export async function getTraitResponses(participantIds: string[]): Promise<TraitResponse[]> {
  if (participantIds.length === 0) return [];
  const { data, error } = await db()
    .from("trait_responses")
    .select("*")
    .in("participant_id", participantIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as TraitResponse[];
}

export async function getTraitResponse(participantId: string): Promise<TraitResponse | null> {
  const { data } = await db()
    .from("trait_responses")
    .select("*")
    .eq("participant_id", participantId)
    .maybeSingle();
  return (data as TraitResponse) ?? null;
}

export async function getBlockedPairs(roundId: string): Promise<BlockedPair[]> {
  const { data, error } = await db().from("blocked_pairs").select("*").eq("round_id", roundId);
  if (error) throw new Error(error.message);
  return (data ?? []) as BlockedPair[];
}

export async function getMatchRuns(roundId: string): Promise<MatchRun[]> {
  const { data, error } = await db()
    .from("match_runs")
    .select("*")
    .eq("round_id", roundId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MatchRun[];
}

export async function getMatchRun(id: string): Promise<MatchRun | null> {
  const { data } = await db().from("match_runs").select("*").eq("id", id).maybeSingle();
  return (data as MatchRun) ?? null;
}

/**
 * Everything the matcher needs for one round, assembled into the shape
 * lib/matching expects. Embeddings are looked up only when the flag is on.
 */
export async function loadMatchInput(
  roundId: string,
  embeddingsEnabled?: boolean,
): Promise<{
  bigs: MatchParticipant[];
  littles: MatchParticipant[];
  blocked: BlockedPair[];
  participants: Participant[];
}> {
  const participants = await getParticipants(roundId);
  const ids = participants.map((p) => p.id);
  const [responses, blocked] = await Promise.all([
    getTraitResponses(ids),
    getBlockedPairs(roundId),
  ]);

  const answersById = new Map(responses.map((r) => [r.participant_id, r.answers]));

  const embeddings = await loadEmbeddings(
    participants.map((p) => ({ id: p.id, answers: answersById.get(p.id) ?? null })),
    embeddingsEnabled,
  );

  const toMatchParticipant = (p: Participant): MatchParticipant => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role,
    answers: answersById.get(p.id) ?? null,
    embedding: embeddings.get(p.id) ?? null,
  });

  return {
    bigs: participants.filter((p) => p.role === "big").map(toMatchParticipant),
    littles: participants.filter((p) => p.role === "little").map(toMatchParticipant),
    blocked,
    participants,
  };
}
