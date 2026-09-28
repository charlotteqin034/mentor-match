/**
 * The question bank — single source of truth.
 *
 * Rendering (survey UI), validation (route handlers) and scoring (lib/scoring)
 * all read from this array. Nothing about a question is hardcoded in JSX.
 */

export type SectionId = "about" | "how" | "looking";

export const SECTIONS: { id: SectionId; title: string; blurb?: string }[] = [
  {
    id: "about",
    title: "A few things about you",
    blurb: "There are no right answers here — we're looking for people who line up, not people who look good.",
  },
  {
    id: "how",
    title: "How you want this to work",
    blurb: "These three matter a lot. Be honest about the amount of contact you actually want.",
  },
  { id: "looking", title: "What you're looking for" },
];

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
/** The denominator in every gap formula. */
export const SCALE_RANGE = SCALE_MAX - SCALE_MIN;
/** Every selectable point, so no component hardcodes how many there are. */
export const SCALE_POINTS = Array.from(
  { length: SCALE_MAX - SCALE_MIN + 1 },
  (_, i) => SCALE_MIN + i,
);
/** Exact centre of the scale — what "no strong feeling" looks like. */
export const SCALE_MIDPOINT = (SCALE_MIN + SCALE_MAX) / 2;

/** Printed verbatim above the first block of scale questions. */
export const SCALE_INSTRUCTION =
  `These questions are on a 1–${SCALE_MAX} scale. 1 generally means "less" and ${SCALE_MAX} means "more" — e.g. 1 = no, ${SCALE_MAX} = yes; 1 = major introversion, ${SCALE_MAX} = major extroversion. The specific anchors are labeled on each question.`;

/**
 * How a question feeds the score.
 *  - similarity  : both sides should answer alike            (§8a)
 *  - cross_pref  : "what I want in them" vs their own answer (§8b)
 *  - gap         : logistics agreement, heavily weighted     (§8c)
 *  - jaccard     : set overlap                               (§8d)
 *  - text        : embeddings when enabled, else display only(§8e)
 */
export type ScoringMode = "similarity" | "cross_pref" | "gap" | "jaccard" | "text";

type Base = {
  id: string;
  section: SectionId;
  text: string;
  mode: ScoringMode;
  /** Relative weight inside its own component. Default 1. */
  weight?: number;
};

export type ScaleQuestion = Base & {
  kind: "scale";
  mode: "similarity" | "cross_pref" | "gap";
  /** Anchor label shown at 1. */
  low: string;
  /** Anchor label shown at 7. */
  high: string;
  /** For cross_pref: the id of the question on the *other* person this compares against. */
  crossTarget?: string;
  /** Human-readable phrases used to build standout traits on a profile card. */
  phrases: { low: string; high: string };
};

export type MultiQuestion = Base & {
  kind: "multi";
  mode: "jaccard";
  options: { id: string; label: string }[];
  min: number;
  max: number;
  allowOther: true;
};

export type TextQuestion = Base & {
  kind: "text";
  mode: "text";
  placeholder: string;
  hint?: string;
  maxLength: number;
};

export type Question = ScaleQuestion | MultiQuestion | TextQuestion;

const scale = (
  id: string,
  section: SectionId,
  text: string,
  low: string,
  high: string,
  phrases: { low: string; high: string },
  extra: Partial<ScaleQuestion> = {},
): ScaleQuestion => ({
  kind: "scale",
  id,
  section,
  text,
  low,
  high,
  phrases,
  mode: "similarity",
  ...extra,
});

export const QUESTIONS: Question[] = [
  // ---- Section A: the 22 "about you" scales (rendered in array order) ------
  scale("q3", "about", "I am the definition of the life of the party", "no", "yes", {
    low: "Not a party person",
    high: "Life of the party",
  }),
  scale("q4", "about", "When someone vents to me, I first offer…", "emotions", "advice", {
    low: "Leads with empathy",
    high: "Leads with advice",
  }),
  scale("q5", "about", "Being active is an important part of my lifestyle", "no", "yes", {
    low: "Not especially active",
    high: "Very active lifestyle",
  }),
  scale("q6", "about", "I find politically incorrect humor funny", "no", "yes", {
    low: "Prefers humor that stays clean",
    high: "Finds edgy humor funny",
  }),
  scale("q7", "about", "I go to great lengths to minimize my harm to the planet", "no", "yes", {
    low: "Not focused on sustainability",
    high: "Deeply eco-conscious",
  }),
  scale("q8", "about", "I usually find it harder to…", "chill out", "get hyped up", {
    low: "Finds it hard to wind down",
    high: "Finds it hard to get hyped up",
  }),
  scale(
    "q10",
    "about",
    "I'd rather have a mentor/mentee who…",
    "meticulously plans",
    "goes with the flow",
    { low: "Wants a partner who plans", high: "Wants a partner who improvises" },
    { mode: "cross_pref", crossTarget: "q15" },
  ),
  scale("q11", "about", "The world needs…", "more realism", "more imagination", {
    low: "Grounded realist",
    high: "Runs on imagination",
  }),
  scale("q12", "about", "I would rather fail than cheat on an exam", "no", "yes", {
    low: "Flexible about the rules",
    high: "Strict about integrity",
  }),
  scale("q13", "about", "After a long week, I'd rather be…", "alone", "around people", {
    low: "Recharges alone",
    high: "Recharges around people",
  }),
  scale("q14", "about", "When I disagree with someone, I…", "let it go", "address it head-on", {
    low: "Lets disagreements go",
    high: "Addresses conflict head-on",
  }),
  scale("q15", "about", "I plan my days…", "loosely", "with a strict schedule", {
    low: "Goes with the flow",
    high: "Meticulous planner",
  }),
  scale("q16", "about", "I prefer feedback that is…", "gentle/encouraging", "blunt/direct", {
    low: "Wants gentle feedback",
    high: "Wants blunt feedback",
  }),
  scale("q17", "about", "I'd rather spend a weekend…", "relaxing at home", "doing something new", {
    low: "Homebody weekends",
    high: "Always up for something new",
  }),
  scale("q31", "about", "On a free day, I'd rather be…", "indoors at home", "out and about", {
    low: "Happiest indoors",
    high: "Happiest out and about",
  }),
  scale("q18", "about", "I care more about…", "the journey", "the destination", {
    low: "In it for the journey",
    high: "Focused on the destination",
  }),
  scale("q19", "about", "I trust…", "my gut", "data and research", {
    low: "Trusts their gut",
    high: "Trusts data and research",
  }),
  scale("q20", "about", "I'm more motivated by…", "avoiding failure", "chasing success", {
    low: "Motivated by avoiding failure",
    high: "Motivated by chasing success",
  }),
  scale("q21", "about", "I open up to new people…", "slowly", "easily and quickly", {
    low: "Opens up slowly",
    high: "Opens up quickly",
  }),
  scale("q22", "about", "I think rules are…", "meant to guide you", "meant to be questioned", {
    low: "Takes rules as guidance",
    high: "Questions the rules",
  }),

  // Deliberately last in this section, despite the ids. Opening a mentorship
  // survey by asking about drinking and smoking sets the wrong tone, and these
  // read far better once someone is warmed up. The ids stay put because they
  // key stored answers — array order is what the survey renders by.
  scale("q1", "about", "I enjoy drinking", "no", "yes", {
    low: "Doesn't drink",
    high: "Enjoys drinking",
  }),
  scale("q2", "about", "I enjoy smoking", "no", "yes", {
    low: "Doesn't smoke",
    high: "Enjoys smoking",
  }),

  // ---- Section B: logistics, heavily weighted (§8c) ------------------------
  scale(
    "q23",
    "how",
    "I want a mentor/mentee relationship that is…",
    "light-touch, occasional",
    "close and frequent",
    { low: "Wants light-touch mentorship", high: "Wants close, frequent mentorship" },
    { mode: "gap", weight: 2 }, // double q24/q25 within the closeness component
  ),
  scale(
    "q24",
    "how",
    "I prefer communicating…",
    "async (text/email)",
    "live (call/in person)",
    { low: "Prefers async messages", high: "Prefers live conversation" },
    { mode: "gap" },
  ),
  scale(
    "q25",
    "how",
    "I'd rather meet…",
    "spontaneously, as needed",
    "on a fixed recurring schedule",
    { low: "Meets spontaneously", high: "Wants a standing schedule" },
    { mode: "gap" },
  ),

  // ---- Section C: values + open text --------------------------------------
  {
    kind: "multi",
    id: "q26",
    section: "looking",
    text: "What are you hoping to get out of this? Pick 2–3.",
    mode: "jaccard",
    min: 2,
    max: 3,
    allowOther: true,
    options: [
      { id: "career_clarity", label: "Career clarity" },
      { id: "technical_depth", label: "Technical / skill depth" },
      { id: "network", label: "Expanding my network" },
      { id: "direction", label: "Finding direction" },
      { id: "social", label: "Hanging out socially" },
    ],
  },
  {
    kind: "text",
    id: "q27",
    section: "looking",
    text: "What's something you're genuinely excited about right now — in or outside your field?",
    hint: "One or two sentences. This one shows up on your profile card word for word.",
    mode: "text",
    placeholder: "Anything at all — a project, a band, a rabbit hole you fell down…",
    maxLength: 400,
  },
  {
    kind: "text",
    id: "q28",
    section: "looking",
    text: "In one sentence, describe your ideal mentor/mentee relationship.",
    hint: "One sentence. Also shown on your profile card verbatim.",
    mode: "text",
    placeholder: "e.g. Someone I can text a half-formed question at 11pm.",
    maxLength: 280,
  },

];

export const QUESTIONS_BY_ID: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
);

export const SCALE_QUESTIONS = QUESTIONS.filter(
  (q): q is ScaleQuestion => q.kind === "scale",
);

export const questionsInSection = (section: SectionId) =>
  QUESTIONS.filter((q) => q.section === section);
