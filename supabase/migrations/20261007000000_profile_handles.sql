-- Member handles for GitHub, LeetCode and LinkedIn.
--
-- Stored as bare usernames, never URLs: the app builds the link for display.
-- That keeps an arbitrary link out of a column that is later rendered as an
-- anchor, so the charset checks below are the whole of the trust boundary.
-- The Go API enforces the same shapes; these constraints are the backstop.

alter table csc.profiles
  add column github_username text,
  add column leetcode_username text,
  add column linkedin_username text;

-- GitHub: alphanumeric and single hyphens, not leading or trailing, max 39.
alter table csc.profiles
  add constraint profiles_github_username_shape
  check (
    github_username is null
    or github_username ~ '^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$'
  );

-- LeetCode: letters, digits, underscore, dot and hyphen, max 39.
alter table csc.profiles
  add constraint profiles_leetcode_username_shape
  check (
    leetcode_username is null
    or leetcode_username ~ '^[A-Za-z0-9._-]{1,39}$'
  );

-- LinkedIn public profile id (the /in/<id> segment): 3-100, letters, digits,
-- hyphens.
alter table csc.profiles
  add constraint profiles_linkedin_username_shape
  check (
    linkedin_username is null
    or linkedin_username ~ '^[A-Za-z0-9-]{3,100}$'
  );
