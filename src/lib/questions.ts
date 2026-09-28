/**
 * The question bank — single source of truth.
 *
 * Rendering (survey UI), validation (route handlers) and scoring (lib/scoring)
 * all read from this array. Nothing about a question is hardcoded in JSX.
 */

export type Role = "big" | "little";

export type SectionId = "about" | "how" | "looking" | "project";

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
  {
    id: "project",
    title: "The project",
    blurb:
      "Last one. You'll be paired with someone whose choices line up with yours, so rank all three honestly.",
  },
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
export type ScoringMode =
  | "similarity"
  | "cross_pref"
  | "gap"
  | "jaccard"
  | "text"
  | "preference"
  | "project"
  | "display";

type Base = {
  id: string;
  section: SectionId;
  text: string;
  mode: ScoringMode;
  /** Relative weight inside its own component. Default 1. */
  weight?: number;
  /**
   * Restricts the question to one side of the pairing. Absent means everyone
   * answers it. A question only one side answers can't produce a similarity
   * score — there's nothing to compare against — so it feeds the profile card
   * rather than the match.
   */
  audience?: Role;
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

/**
 * Names picked from the other side of the round.
 *
 * The only question whose options aren't in this file — they're the people in
 * the round, so they're injected at render time. Optional by design: "no
 * preference" is the common and perfectly good answer.
 */
export type PeopleQuestion = Base & {
  kind: "people";
  mode: "preference";
  placeholder: string;
  hint: string;
  max: number;
};

/**
 * All of a handful of richly described options, put in preference order.
 * Stored as an array of every option id, best first.
 */
export type RankedChoiceQuestion = Base & {
  kind: "ranked_choice";
  mode: "project";
  options: {
    id: string;
    label: string;
    /** Who's running it. */
    meta: string;
    mission: string;
    product: string;
  }[];
};

export type Question =
  | ScaleQuestion
  | MultiQuestion
  | TextQuestion
  | PeopleQuestion
  | RankedChoiceQuestion;

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
  scale("q6", "about", "I enjoy edgy or unconventional comedy", "no", "yes", {
    low: "Prefers mainstream comedy",
    high: "Enjoys edgy comedy",
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
    "I'd rather have a big/little who…",
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
  scale(
    "q16",
    "about",
    "I prefer to give and get feedback that is…",
    "gentle/encouraging",
    "blunt/direct",
    { low: "Gentle with feedback", high: "Blunt with feedback" },
  ),
  scale("q17", "about", "I'd rather spend a weekend…", "relaxing at home", "doing something new", {
    low: "Homebody weekends",
    high: "Always up for something new",
  }),
  scale("q31", "about", "On a free day, I'd rather be…", "out in nature", "out in the city", {
    low: "Drawn to nature",
    high: "Drawn to the city",
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

  // Deliberately last in this section, despite the ids. Opening a bigship
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
    "I want a big/little relationship that is…",
    "light-touch, occasional",
    "close and frequent",
    { low: "Wants light-touch bigship", high: "Wants close, frequent bigship" },
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
    audience: "little",
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
    hint: "One or two sentences. The organiser reads this when they're sanity-checking the pairings.",
    mode: "text",
    placeholder: "Anything at all — a project, a band, a rabbit hole you fell down…",
    maxLength: 400,
  },
  {
    kind: "text",
    id: "q28",
    section: "looking",
    text: "In one sentence, describe your ideal big/little relationship.",
    hint: "One sentence.",
    mode: "text",
    placeholder: "e.g. Someone I can text a half-formed question at 11pm.",
    maxLength: 280,
  },

  {
    kind: "people",
    id: "q32",
    section: "looking",
    text: "Anyone in particular you'd like to be paired with?",
    hint: "Totally optional, and not a guarantee — the organiser sees it and weighs it up. Start typing a name.",
    mode: "preference",
    placeholder: "Start typing a name…",
    max: 5,
  },

  // ---- Section E: the project ---------------------------------------------
  {
    kind: "ranked_choice",
    id: "q33",
    section: "project",
    text: "Put these in order — your first choice at the top.",
    mode: "project",
    options: [
      {
        id: "casa_la",
        label: "CASA of LA",
        meta: "PM: Jamie · TL: Michelle",
        mission:
          "Advocate for children in Los Angeles County's child welfare system.",
        product:
          "An internal tool that maps youth addresses to congressional districts with heat map visualizations.",
      },
      {
        id: "united_colors_of_cancer",
        label: "United Colors of Cancer",
        meta: "PM: Yirui · TL: Sophie",
        mission:
          "Advance cancer equity for BIPOC and underserved patients, survivors, caregivers, and families.",
        product:
          "A platform for children undergoing cancer treatment to safely socialize during periods of isolation through video chat and multiplayer games.",
      },
      {
        id: "food_access_la",
        label: "Food Access LA",
        meta: "PM: Julia · TL: Gavin",
        mission:
          "Support farmers, feed Los Angeles, and be a supporting partner in equitable food systems.",
        product:
          "A centralized database and mapping platform for farmer and farmer's market data.",
      },
    ],
  },
];

export const QUESTIONS_BY_ID: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q]),
);

export const SCALE_QUESTIONS = QUESTIONS.filter(
  (q): q is ScaleQuestion => q.kind === "scale",
);

/** Everyone sees an unrestricted question; a restricted one only its audience. */
export const appliesTo = (question: Question, role?: Role): boolean =>
  !question.audience || !role || question.audience === role;

/** The questions one person actually answers. No role = the whole bank. */
export const questionsFor = (role?: Role): Question[] =>
  QUESTIONS.filter((q) => appliesTo(q, role));

export const questionsInSection = (section: SectionId, role?: Role) =>
  questionsFor(role).filter((q) => q.section === section);
