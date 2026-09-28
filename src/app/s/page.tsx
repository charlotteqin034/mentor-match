import { TraitSurveyScreen } from "@/components/TraitSurveyScreen";
import { getParticipantToken } from "@/lib/participant-session";

export const dynamic = "force-dynamic";

export default async function TraitSurveyPage() {
  return <TraitSurveyScreen token={await getParticipantToken()} viaCookie />;
}
