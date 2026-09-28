-- Renames the two roles from mentor/mentee to big/little.
--
-- Run this in the Supabase SQL editor BEFORE deploying the code that expects
-- the new values. Until it runs, existing rows still say 'mentor'/'mentee' and
-- the old CHECK constraint rejects the new ones, so the app can't write.
--
-- Safe to run more than once, and trivially reversible: swap the values in the
-- two UPDATE statements and re-run.

begin;

-- The inline `check (role in (...))` on participants.role is auto-named
-- participants_role_check. Drop it before rewriting the values it guards.
alter table participants drop constraint if exists participants_role_check;

update participants set role = 'big'    where role = 'mentor';
update participants set role = 'little' where role = 'mentee';

alter table participants
  add constraint participants_role_check check (role in ('big', 'little'));

commit;

-- Note: match_runs.results stores pairs keyed mentor_id/mentee_id in older
-- rows. Saved runs are disposable — re-run the match rather than migrating
-- them. If you have a published run you need to keep, do this first:
--
--   update match_runs
--   set results = (
--     select jsonb_agg(
--       (pair - 'mentor_id' - 'mentee_id')
--       || jsonb_build_object('big_id', pair->'mentor_id',
--                             'little_id', pair->'mentee_id')
--     )
--     from jsonb_array_elements(results) as pair
--   )
--   where results::text like '%mentor_id%';
