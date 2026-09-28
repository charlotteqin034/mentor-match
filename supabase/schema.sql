-- Big–Little Matching Platform — schema
-- Run this in the Supabase SQL editor (or `supabase db push`) before first use.

-- ---------------------------------------------------------------------------
-- Rounds
-- ---------------------------------------------------------------------------
create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stage text not null default 'setup'
    check (stage in ('setup','trait_survey','profiles_generated','ranking_survey','matching','published')),
  published_run_id uuid,            -- set at publish time; points at match_runs.id
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Participants
-- ---------------------------------------------------------------------------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  role text not null check (role in ('big','little')),
  name text not null,
  email text not null,
  token text not null unique,          -- random 32-char, used in magic links
  display_number int,                  -- assigned at profile generation: "Profile #14"
  trait_completed_at timestamptz,
  ranking_completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists participants_round_idx on participants (round_id);
create unique index if not exists participants_round_email_idx on participants (round_id, lower(email));

-- ---------------------------------------------------------------------------
-- Trait survey responses (one row per participant, answers keyed by question id)
-- ---------------------------------------------------------------------------
create table if not exists trait_responses (
  participant_id uuid primary key references participants(id) on delete cascade,
  answers jsonb not null,              -- { "q1": 5, "q26": ["career_clarity","network"], "q27": "..." }
  submitted_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Anonymised profile cards
-- ---------------------------------------------------------------------------
create table if not exists profile_cards (
  participant_id uuid primary key references participants(id) on delete cascade,
  display_number int not null,
  card jsonb not null,
  generated_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Rankings — one row per (ranker, ranked) pair in a submitted ranking
-- ---------------------------------------------------------------------------
create table if not exists rankings (
  id uuid primary key default gen_random_uuid(),
  ranker_id uuid references participants(id) on delete cascade,
  ranked_id uuid references participants(id) on delete cascade,
  rank int not null,                   -- 1 = top choice
  submitted_at timestamptz default now(),
  unique (ranker_id, ranked_id)
);

create index if not exists rankings_ranker_idx on rankings (ranker_id);

-- ---------------------------------------------------------------------------
-- Pairs the organiser never wants matched
-- ---------------------------------------------------------------------------
create table if not exists blocked_pairs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  participant_a uuid references participants(id) on delete cascade,
  participant_b uuid references participants(id) on delete cascade
);

create index if not exists blocked_pairs_round_idx on blocked_pairs (round_id);

-- ---------------------------------------------------------------------------
-- Saved matching runs
-- ---------------------------------------------------------------------------
create table if not exists match_runs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  weights jsonb not null,              -- snapshot of the config used
  results jsonb not null,              -- [{ big_id, little_id, total, components:{...} }]
  total_score numeric,
  created_at timestamptz default now()
);

create index if not exists match_runs_round_idx on match_runs (round_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Cached open-text embeddings (only used when ENABLE_EMBEDDINGS=true)
-- ---------------------------------------------------------------------------
create table if not exists text_embeddings (
  participant_id uuid references participants(id) on delete cascade,
  text_hash text not null,             -- sha256 of the concatenated q27 + q28 text
  embedding jsonb not null,            -- number[]
  created_at timestamptz default now(),
  primary key (participant_id, text_hash)
);

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Nothing is reachable with the anon key. Every read and write in this app goes
-- through a Next.js route handler holding the service role key, which bypasses
-- RLS. Enabling RLS with no permissive policy is what keeps one participant
-- from reading another's answers if the anon key ever leaks into the browser.
-- ---------------------------------------------------------------------------
alter table rounds           enable row level security;
alter table participants     enable row level security;
alter table trait_responses  enable row level security;
alter table profile_cards    enable row level security;
alter table rankings         enable row level security;
alter table blocked_pairs    enable row level security;
alter table match_runs       enable row level security;
alter table text_embeddings  enable row level security;
