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

  if (round.stage === "trait_survey") {
    const participants = await getParticipants(round.id);
    const people: PickerPerson[] = participants
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        done: Boolean(p.trait_completed_at),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return (
      <Shell eyebrow={round.name} title="Let's find out who you are.">
        <p className="mb-5 text-sm text-muted">
          {QUESTIONS.length} quick questions, about ten minutes. Your answers are used to pair
          you with someone — only the organiser ever sees them.
        </p>
        <NamePicker people={people} actionLabel="Start the survey" returning={returning} />
      </Shell>
    );
  }

  if (round.stage === "setup") {
    return (
      <Shell eyebrow={round.name} title="Not open just yet.">
        <p className="text-sm text-muted">
          The survey hasn&apos;t opened. Keep this link — it&apos;s the only one you&apos;ll
          need.
        </p>
      </Shell>
    );
  }

  return (
    <Shell eyebrow={round.name} title="That's everything from you.">
      <p className="text-sm text-muted">
        The survey is closed and matching is underway. The organiser will be in touch about who
        you&apos;ve been paired with.
      </p>
    </Shell>
  );
}
