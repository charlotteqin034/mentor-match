import Link from "next/link";
import { Gate } from "@/components/Gate";
import { IdentityBar } from "@/components/IdentityBar";
import { TraitSurvey } from "@/components/TraitSurvey";
import { getParticipantByToken, getTraitResponse } from "@/lib/data";
import { supabaseConfigured } from "@/lib/env";

/**
 * Stage 1, however the person got here — by picking their name (token in a
 * cookie) or by opening a direct /s/<token> link.
 */
export async function TraitSurveyScreen({
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
          and choose your name from the list, then you&apos;ll go straight into the survey.
        </p>
      </Gate>
    );
  }

  const found = await getParticipantByToken(token);
  if (!found) {
    return (
      <Gate eyebrow="Not recognised" title="We don't recognise you.">
        <p>
          You may have been removed from this round, or the organiser reset your access.{" "}
          <Link href="/" className="text-accent underline">
            Start again
          </Link>{" "}
          and pick your name — if it isn&apos;t there, let the organiser know.
        </p>
      </Gate>
    );
  }

  const { participant, round } = found;

  if (round.stage === "setup") {
    return (
      <Gate eyebrow="Not open yet" title="The survey hasn't opened.">
        <p>
          You&apos;re on the list — there&apos;s just nothing to fill in yet. Come back to this
          same link once {round.name} opens.
        </p>
      </Gate>
    );
  }

  if (round.stage !== "trait_survey") {
    return (
      <Gate eyebrow="Closed" title="The trait survey has closed.">
        <p>
          {participant.trait_completed_at
            ? "Your answers are safely in — thanks for getting them done."
            : "It looks like this one closed before your answers came in. Let the organiser know."}
        </p>
        <p>
          The ranking round comes next, and it opens from{" "}
          <Link href="/" className="text-accent underline">
            the same starting page
          </Link>
          .
        </p>
      </Gate>
    );
  }

  const response = await getTraitResponse(participant.id);

  return (
    <>
      {viaCookie && <IdentityBar name={participant.name} />}
      <TraitSurvey
        token={participant.token}
        name={participant.name}
        role={participant.role}
        alreadyDone={Boolean(participant.trait_completed_at)}
        serverAnswers={response?.answers ?? null}
      />
    </>
  );
}
