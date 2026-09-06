import type { ProfileCard } from "./profile-cards";
import type { Components, WeightKey, Weights } from "./scoring";
import type { Answers } from "./scoring";

export const STAGES = [
  "setup",
  "trait_survey",
  "profiles_generated",
  "ranking_survey",
  "matching",
  "published",
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  setup: "Setup",
  trait_survey: "Trait survey open",
  profiles_generated: "Profiles generated",
  ranking_survey: "Ranking survey open",
  matching: "Matching",
  published: "Published",
};

export const STAGE_BLURBS: Record<Stage, string> = {
  setup: "Add participants and hand out links. No survey is reachable yet.",
  trait_survey: "Participants can fill in and edit the 30-question trait survey.",
  profiles_generated: "Trait survey is closed. Cards are built; ranking hasn't opened.",
  ranking_survey: "Participants can rank the other cohort's anonymous cards.",
  matching: "Both surveys closed. Tune weights and run the match.",
  published: "Pairings are final. Export the CSV and send it out.",
};

export type Round = {
  id: string;
  name: string;
  stage: Stage;
  published_run_id: string | null;
  created_at: string;
};

export type Participant = {
  id: string;
  round_id: string;
  role: "mentor" | "mentee";
  name: string;
  email: string;
  token: string;
  display_number: number | null;
  trait_completed_at: string | null;
  ranking_completed_at: string | null;
  created_at: string;
};

export type TraitResponse = {
  participant_id: string;
  answers: Answers;
  submitted_at: string;
};

export type ProfileCardRow = {
  participant_id: string;
  display_number: number;
  card: ProfileCard;
  generated_at: string;
};

export type RankingRow = {
  id: string;
  ranker_id: string;
  ranked_id: string;
  rank: number;
  submitted_at: string;
};

export type BlockedPair = {
  id: string;
  round_id: string;
  participant_a: string;
  participant_b: string;
};

export type MatchRunResultRow = {
  mentor_id: string;
  mentee_id: string;
  total: number;
  components: Components;
  applied: Record<WeightKey, number>;
  blocked: boolean;
  mentor_rank_of_mentee: number;
  mentee_rank_of_mentor: number;
};

export type MatchRun = {
  id: string;
  round_id: string;
  weights: Weights;
  results: MatchRunResultRow[];
  total_score: number | null;
  created_at: string;
};
