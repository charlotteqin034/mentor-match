import { RankingSurveyScreen } from "@/components/RankingSurveyScreen";

export const dynamic = "force-dynamic";

/** Direct per-person link. Still supported alongside the shared name picker. */
export default async function RankingTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <RankingSurveyScreen token={token} viaCookie={false} />;
}
