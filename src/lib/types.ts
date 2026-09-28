import type { Components, WeightKey, Weights } from "./scoring";
import type { Answers } from "./scoring";

export const STAGES = ["setup", "trait_survey", "matching", "published"] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  setup: "Setup",
  trait_survey: "Survey open",
  matching: "Matching",
  published: "Published",
};

export const STAGE_BLURBS: Record<Stage, string> = {
  setup: "Add participants and hand out the link. The survey isn't reachable yet.",
  trait_survey: "Participants can fill in and edit their answers.",
  matching: "Survey closed. Tune weights and run the match.",
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
  role: "big" | "little";
  name: string;
  email: string;
  token: string;
  trait_completed_at: string | null;
  created_at: string;
};

export type TraitResponse = {
  participant_id: string;
  answers: Answers;
  submitted_at: string;
};

export type BlockedPair = {
  id: string;
  round_id: string;
  participant_a: string;
  participant_b: string;
};

export type MatchRunResultRow = {
  big_id: string;
  little_id: string;
  total: number;
  components: Components;
  applied: Record<WeightKey, number>;
  blocked: boolean;
  big_rank_of_little: number;
  little_rank_of_big: number;
};

export type MatchRun = {
  id: string;
  round_id: string;
  weights: Weights;
  results: MatchRunResultRow[];
  total_score: number | null;
  created_at: string;
};
