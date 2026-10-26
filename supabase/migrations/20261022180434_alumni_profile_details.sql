-- Optional details are visible only through the authenticated Go directory.
alter table csc.profiles
  add column current_company text,
  add column job_title text,
  add column location text,
  add column bio text,
  add column personal_website text,
  add column offers_coffee boolean not null default false,
  add column offers_mentorship boolean not null default false,
  add column offers_referrals boolean not null default false,
  add column offers_resume_review boolean not null default false,
  add constraint profiles_current_company_check check (current_company is null or char_length(current_company) between 1 and 160),
  add constraint profiles_job_title_check check (job_title is null or char_length(job_title) between 1 and 160),
  add constraint profiles_location_check check (location is null or char_length(location) between 1 and 160),
  add constraint profiles_bio_check check (bio is null or char_length(bio) between 1 and 2000),
  add constraint profiles_personal_website_check check (personal_website is null or char_length(personal_website) between 1 and 500);
