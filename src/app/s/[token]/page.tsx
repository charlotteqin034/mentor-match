import { TraitSurveyScreen } from "@/components/TraitSurveyScreen";

export const dynamic = "force-dynamic";

/** Direct per-person link. Still supported alongside the shared name picker. */
export default async function TraitSurveyTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <TraitSurveyScreen token={token} viaCookie={false} />;
}
