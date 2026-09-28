import Link from "next/link";
import { ConfigError } from "@/components/admin/ConfigError";
import { MatchingConsole } from "@/components/admin/MatchingConsole";
import { getSelectedRound } from "@/lib/admin";
import { getParticipants } from "@/lib/data";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function MatchingPage() {
  let round;
  try {
    round = await getSelectedRound();
  } catch (err) {
    return <ConfigError message={err instanceof Error ? err.message : String(err)} />;
  }
  if (!round) return <p className="text-sm text-muted">Create a round on the overview first.</p>;

  const participants = await getParticipants(round.id);
  const withoutTraits = participants.filter((p) => !p.trait_completed_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Matching</h1>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Every cell of the big × little matrix is scored from six components, then solved as
          a linear assignment problem — so this is the arrangement with the highest total score,
          not a greedy pass. Sort by the weakest pairs and look at those first.
        </p>
      </div>

      {round.stage !== "matching" && round.stage !== "published" && (
        <div className="card border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          This round is still at &ldquo;{round.stage.replace(/_/g, " ")}&rdquo;. You can run
          matching to preview it, but people may still be changing their answers. Move the round
          to <strong>Matching</strong> on the{" "}
          <Link href="/admin" className="underline">
            overview
          </Link>{" "}
          when you&apos;re ready to freeze it.
        </div>
      )}

      {withoutTraits.length > 0 && (
        <div className="card border-warn/40 bg-warn-soft p-4 text-sm text-warn">
          {withoutTraits.length} {withoutTraits.length === 1 ? "person hasn't" : "people haven't"}{" "}
          filled in the trait survey ({withoutTraits.map((p) => p.name).join(", ")}). They&apos;ll
          still be matched, but with almost nothing to go on.
        </div>
      )}


      <MatchingConsole
        roundId={round.id}
        embeddingsDefault={env.embeddingsEnabled}
        hasEmbeddingKey={Boolean(env.huggingFaceKey)}
        publishedRunId={round.published_run_id}
      />
    </div>
  );
}
