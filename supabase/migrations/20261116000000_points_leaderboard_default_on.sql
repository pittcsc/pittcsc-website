-- New profiles start with sharing enabled. Preserve every existing choice.
alter table csc.profiles
  alter column points_leaderboard_shared set default true;
