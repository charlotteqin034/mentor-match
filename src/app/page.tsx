import Link from "next/link";
import { destinationForStage } from "@/app/api/join/route";
import { NamePicker, type PickerPerson } from "@/components/NamePicker";
import { QUESTIONS } from "@/lib/questions";
import { getCurrentRound, getParticipantByToken, getParticipants } from "@/lib/data";
import { supabaseConfigured } from "@/lib/env";
import { getParticipantToken } from "@/lib/participant-session";

export const dynamic = "force-dynamic";

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5">{children}</div>
      <p className="mt-10 text-xs text-faint">
        <Link href="/admin" className="hover:text-muted">
          Organiser console
        </Link>
      </p>
    </main>
  );
}

export default async function Home() {
  if (!supabaseConfigured()) {
    return (
      <Shell eyebrow="Not configured" title="This isn't connected to a database yet.">
        <p className="text-sm text-muted">
          Set the Supabase environment variables and run the schema migration first.
        </p>
      </Shell>
    );
  }

  const round = await getCurrentRound();
  if (!round) {
    return (
      <Shell eyebrow="Nothing running" title="There's no round open right now.">
        <p className="text-sm text-muted">Check back when the organiser sets one up.</p>
      </Shell>
    );
  }

  // Someone who has already picked a name gets offered it back rather than
  // hunting through the list again.
  const token = await getParticipantToken();
  const existing = token ? await getParticipantByToken(token) : null;
  const returning =
    existing && existing.round.id === round.id
      ? { name: existing.participant.name, next: destinationForStage(round.stage) }
      : null;

  if (round.stage === "trait_survey" || round.stage === "ranking_survey") {
    const isTrait = round.stage === "trait_survey";
    const participants = await getParticipants(round.id);
    const people: PickerPerson[] = participants
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        done: Boolean(isTrait ? p.trait_completed_at : p.ranking_completed_at),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return (
      <Shell
        eyebrow={round.name}
        title={isTrait ? "Let's find out who you are." : "Time to pick your people."}
      >
        <p className="mb-5 text-sm text-muted">
          {isTrait
            ? `${QUESTIONS.length} quick questions, about ten minutes. Your answers are used to pair you with someone — only the organiser ever sees them.`
            : "You'll see anonymous profiles of the other side and put your favourites in order. No names, deliberately."}
        </p>
        <NamePicker
          people={people}
          actionLabel={isTrait ? "Start the survey" : "Open the ranking round"}
          returning={returning}
        />
      </Shell>
    );
  }

  if (round.stage === "setup" || round.stage === "profiles_generated") {
    return (
      <Shell eyebrow={round.name} title="Not open just yet.">
        <p className="text-sm text-muted">
          {round.stage === "setup"
            ? "The survey hasn't opened. Keep this link — it's the only one you'll need."
            : "The trait survey has closed and the ranking round hasn't started. Keep this link; it'll take you straight in when it opens."}
        </p>
      </Shell>
    );
  }

  return (
    <Shell eyebrow={round.name} title="That's everything from you.">
      <p className="text-sm text-muted">
        Both surveys are closed and matching is underway. The organiser will be in touch about
        who you&apos;ve been paired with.
      </p>
    </Shell>
  );
}
