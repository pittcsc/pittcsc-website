alter table csc.profiles
  add column points_leaderboard_shared boolean not null default false;

-- Leave summaries absent for claims submitted before this migration.
alter table csc.point_claims
  add column summary text check (char_length(summary) between 100 and 250);
