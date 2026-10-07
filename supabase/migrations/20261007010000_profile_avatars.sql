-- Re-enable profile pictures, deferred in "scope: defer profile pictures and
-- retain resume uploads" (34d5386). The original profiles migration has
-- already run, so this widens its constraints rather than editing it.
--
-- Avatars stay optional: nothing here feeds the profile-completeness check.
-- The API decodes and re-encodes every upload, so the media types below are
-- what it produces, not what a client claimed.

alter table csc.profiles add column avatar_asset_id uuid;

-- Allow the 'avatar' kind alongside 'resume'.
alter table csc.profile_assets drop constraint profile_assets_kind_check;
alter table csc.profile_assets
  add constraint profile_assets_kind_check
  check (kind in ('avatar', 'resume'));

-- Per-kind media type and size limits: 10 MB PDF, 5 MB image.
alter table csc.profile_assets drop constraint profile_assets_check;
alter table csc.profile_assets
  add constraint profile_assets_check
  check (
    (kind = 'resume' and media_type = 'application/pdf'
      and octet_length(bytes) between 1 and 10485760)
    or
    (kind = 'avatar' and media_type in ('image/jpeg', 'image/png', 'image/webp')
      and octet_length(bytes) between 1 and 5242880)
  );

-- An avatar may only point at an asset the same member owns.
alter table csc.profiles
  add constraint profiles_avatar_owner_fk
  foreign key (avatar_asset_id, auth_user_id)
  references csc.profile_assets(id, auth_user_id);
