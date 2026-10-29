-- Display metadata for the role catalog. Which roles exist and how they read
-- lives here; who may change each role is enforced by the Go policy.
alter table csc.roles
  add column label text,
  add column description text;

update csc.roles set label = 'Member', description = 'Default role for every CSC account.' where name = 'member';
update csc.roles set label = 'Foundry', description = 'Participant in the Foundry program.' where name = 'foundry';
update csc.roles set label = 'Staff', description = 'Can access the staff dashboard and manage member roles.' where name = 'staff';
update csc.roles set label = 'Alumni', description = 'Graduated CSC member.' where name = 'alumni';

alter table csc.roles
  alter column label set not null,
  alter column description set not null,
  add constraint roles_label_check check (char_length(btrim(label)) between 1 and 50),
  add constraint roles_description_check check (char_length(description) <= 200);

-- Dashboard changes record the authenticated staff actor; operator commands keep
-- a supplied label. Neither references a profile, so history survives deletion.
alter table csc.role_audit
  add column actor_user_id uuid,
  alter column operator drop not null,
  add constraint role_audit_actor_check check ((actor_user_id is null) <> (operator is null));

create index user_roles_role_idx on csc.user_roles (role);
create index role_audit_target_idx on csc.role_audit (target_user_id, created_at);
