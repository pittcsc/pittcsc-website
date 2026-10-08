-- Attendance is written only by the Go API after an explicit authenticated POST.
create table csc.attendance (
  event_id uuid not null references csc.events(id),
  auth_user_id uuid not null references csc.profiles(auth_user_id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (event_id, auth_user_id)
);

create index attendance_roster_idx on csc.attendance (event_id, checked_in_at desc, auth_user_id);
revoke all on csc.attendance from public, anon, authenticated;
alter table csc.attendance enable row level security;
