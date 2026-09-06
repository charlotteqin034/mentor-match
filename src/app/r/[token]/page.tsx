import { Gate } from "@/components/Gate";
import { RankingSurvey } from "@/components/RankingSurvey";
import {
  getParticipantByToken,
  getParticipants,
  getProfileCards,
  getRankings,
} from "@/lib/data";
import { supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

const MIN_RANKS = 5;

export default async function RankingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!supabaseConfigured()) {
    return (
      <Gate eyebrow="Not configured" title="This app hasn't been connected to a database yet.">
        <p>Set the Supabase environment variables and run the schema migration first.</p>
      </Gate>
    );
  }

  const found = await getParticipantByToken(token);
  if (!found) {
    return (
      <Gate eyebrow="Link not recognised" title="We can't find that link.">
        <p>Check you copied the whole thing, then ask the organiser to resend it.</p>
      </Gate>
    );
  }

  const { participant, round } = found;

  // Stage 3 can't open before stage 1 closes — the cards don't exist yet.
  if (round.stage !== "ranking_survey") {
    const done = round.stage === "published" || round.stage === "matching";
    return (
      <Gate
        eyebrow={done ? "Closed" : "Not open yet"}
        title={done ? "The ranking round has closed." : "The ranking round hasn't opened."}
      >
        <p>
          {done
            ? "Matching is underway. The organiser will let you know who you've been paired with."
            : "Your link works — it just isn't live yet. Keep it; this same link opens the ranking round when it starts."}
        </p>
        {round.stage === "trait_survey" && (
          <p>
            The trait survey is still open in the meantime, at{" "}
            <span className="font-mono text-xs">/s/{token.slice(0, 6)}…</span>
          </p>
        )}
      </Gate>
    );
  }

  const everyone = await getParticipants(round.id);
  const otherSide = everyone.filter((p) => p.role !== participant.role);
  const cardRows = await getProfileCards(otherSide.map((p) => p.id));

  if (cardRows.length === 0) {
    return (
      <Gate eyebrow="Nothing to rank" title="No profiles have been generated yet.">
        <p>Let the organiser know — the cards for the other side aren&apos;t built.</p>
      </Gate>
    );
  }

  const existing = await getRankings([participant.id]);

  return (
    <RankingSurvey
      token={token}
      name={participant.name}
      role={participant.role}
      cards={cardRows.map((r) => ({ participant_id: r.participant_id, card: r.card }))}
      required={Math.min(MIN_RANKS, cardRows.length)}
      initialRanking={existing.sort((a, b) => a.rank - b.rank).map((r) => r.ranked_id)}
      alreadyDone={Boolean(participant.ranking_completed_at)}
    />
  );
}
