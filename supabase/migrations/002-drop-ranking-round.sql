-- Removes the profile-ranking round.
--
-- Participants now fill in one survey and that's it; the pairing comes from the
-- answers plus an optional "anyone you'd like?" preference stored inside those
-- answers. Run in the Supabase SQL editor.
--
-- The drops are destructive. If you might want the old rankings back, export
-- them first — otherwise this is safe to run as-is.

begin;

drop table if exists shortlists;
drop table if exists rankings;
drop table if exists profile_cards;

alter table participants drop column if exists display_number;
alter table participants drop column if exists ranking_completed_at;

-- Stage names collapsed from six to four. Anything mid-flight lands on the
-- nearest surviving stage.
update rounds set stage = 'trait_survey' where stage in ('profiles_generated', 'ranking_survey');

alter table rounds drop constraint if exists rounds_stage_check;
alter table rounds
  add constraint rounds_stage_check
  check (stage in ('setup', 'trait_survey', 'matching', 'published'));

commit;
