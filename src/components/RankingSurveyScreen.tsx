import Link from "next/link";
import { Gate } from "@/components/Gate";
import { IdentityBar } from "@/components/IdentityBar";
import { RankingSurvey } from "@/components/RankingSurvey";
import {
  getParticipantByToken,
  getParticipants,
  getProfileCards,
  getRankings,
} from "@/lib/data";
import { supabaseConfigured } from "@/lib/env";

const MIN_RANKS = 5;

/** Stage 3, reached either by name pick (cookie) or a direct /r/<token> link. */
export async function RankingSurveyScreen({
  token,
  viaCookie,
}: {
  token: string | null;
  viaCookie: boolean;
}) {
  if (!supabaseConfigured()) {
    return (
      <Gate eyebrow="Not configured" title="This app hasn't been connected to a database yet.">
        <p>Set the Supabase environment variables and run the schema migration first.</p>
      </Gate>
    );
  }

  if (!token) {
    return (
      <Gate eyebrow="Who are you?" title="Pick your name first.">
        <p>
          <Link href="/" className="text-accent underline">
            Head back to the start
          </Link>{" "}
          and choose your name from the list.
        </p>
      </Gate>
    );
  }

  const found = await getParticipantByToken(token);
  if (!found) {
    return (
      <Gate eyebrow="Not recognised" title="We don't recognise you.">
        <p>
          <Link href="/" className="text-accent underline">
            Start again
          </Link>{" "}
          and pick your name from the list.
        </p>
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
            : "Nothing to rank yet. Come back to this same link when the ranking round starts."}
        </p>
        {round.stage === "trait_survey" && (
          <p>
            The trait survey is still open in the meantime —{" "}
            <Link href="/s" className="text-accent underline">
              fill that in first
            </Link>
            .
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
    <>
      {viaCookie && <IdentityBar name={participant.name} />}
      <RankingSurvey
        token={participant.token}
        name={participant.name}
        role={participant.role}
        cards={cardRows.map((r) => ({ participant_id: r.participant_id, card: r.card }))}
        required={Math.min(MIN_RANKS, cardRows.length)}
        initialRanking={existing.sort((a, b) => a.rank - b.rank).map((r) => r.ranked_id)}
        alreadyDone={Boolean(participant.ranking_completed_at)}
      />
    </>
  );
}
