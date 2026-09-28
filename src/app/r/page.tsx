import { RankingSurveyScreen } from "@/components/RankingSurveyScreen";
import { getParticipantToken } from "@/lib/participant-session";

export const dynamic = "force-dynamic";

export default async function RankingPage() {
  return <RankingSurveyScreen token={await getParticipantToken()} viaCookie />;
}
