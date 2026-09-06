import { TraitSurvey } from "@/components/TraitSurvey";
import { Gate } from "@/components/Gate";
import { getParticipantByToken, getTraitResponse } from "@/lib/data";
import { supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function TraitSurveyPage({
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
        <p>
          Check you copied the whole thing — they&apos;re long on purpose. If it still
          doesn&apos;t work, ask the organiser to resend it.
        </p>
      </Gate>
    );
  }

  const { participant, round } = found;

  if (round.stage === "setup") {
    return (
      <Gate eyebrow="Not open yet" title="The survey hasn't opened.">
        <p>
          Your link works — there&apos;s just nothing to fill in yet. Hang onto it; the same
          link will take you straight to the survey once {round.name} opens.
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
          The ranking round comes next, and it uses a different link:{" "}
          <span className="font-mono text-xs">/r/…</span>
        </p>
      </Gate>
    );
  }

  const response = await getTraitResponse(participant.id);

  return (
    <TraitSurvey
      token={token}
      name={participant.name}
      role={participant.role}
      alreadyDone={Boolean(participant.trait_completed_at)}
      serverAnswers={response?.answers ?? null}
    />
  );
}
