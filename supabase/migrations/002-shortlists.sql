-- Adds the shortlists table (stage 3 now ranks a pre-filtered set, not the
-- whole cohort). Run in the Supabase SQL editor; safe to run more than once.

create table if not exists shortlists (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  candidate_id uuid references participants(id) on delete cascade,
  position int not null,
  score numeric not null,
  generated_at timestamptz default now(),
  unique (participant_id, candidate_id)
);

create index if not exists shortlists_participant_idx on shortlists (participant_id, position);
create index if not exists shortlists_round_idx on shortlists (round_id);

alter table shortlists enable row level security;
