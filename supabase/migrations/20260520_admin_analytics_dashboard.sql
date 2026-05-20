create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  permission text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (role, permission)
);

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists role text not null default 'user';

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  language public.code_language,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.execution_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  language public.code_language not null,
  code_length integer not null default 0 check (code_length >= 0),
  execution_time integer not null default 0 check (execution_time >= 0),
  compile_time integer not null default 0 check (compile_time >= 0),
  trace_time integer not null default 0 check (trace_time >= 0),
  success boolean not null default false,
  error_message text,
  error_type text,
  runtime_status text not null default 'completed',
  code_preview text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.visualization_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  total_steps integer not null default 0 check (total_steps >= 0),
  playback_duration integer not null default 0 check (playback_duration >= 0),
  language public.code_language not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  type text not null,
  status text not null default 'open',
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.crash_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  language public.code_language,
  stack_trace text,
  error_message text not null,
  severity text not null default 'error',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.roles (name, label, description)
values
  ('user', 'User', 'Default product user'),
  ('admin', 'Admin', 'Full analytics and moderation access')
on conflict (name) do update
set
  label = excluded.label,
  description = excluded.description;

insert into public.admin_permissions (role, permission, description)
values
  ('admin', 'dashboard.read', 'View overview metrics'),
  ('admin', 'analytics.read', 'View analytics trends and exports'),
  ('admin', 'users.read', 'Inspect users directory'),
  ('admin', 'executions.read', 'Inspect execution telemetry'),
  ('admin', 'errors.read', 'Inspect crash and failure reports'),
  ('admin', 'feedback.manage', 'Resolve feedback and add admin notes')
on conflict (role, permission) do update
set description = excluded.description;

create or replace function public.is_admin_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = target_user_id
      and is_admin = true
  );
$$;

create or replace function public.touch_profile_last_seen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.profiles
    set
      last_seen_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
    where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_reports_set_updated_at on public.feedback_reports;
create trigger feedback_reports_set_updated_at
before update on public.feedback_reports
for each row
execute function public.set_updated_at();

drop trigger if exists user_activity_touch_profile_last_seen on public.user_activity;
create trigger user_activity_touch_profile_last_seen
after insert on public.user_activity
for each row
execute function public.touch_profile_last_seen();

drop trigger if exists execution_logs_touch_profile_last_seen on public.execution_logs;
create trigger execution_logs_touch_profile_last_seen
after insert on public.execution_logs
for each row
execute function public.touch_profile_last_seen();

drop trigger if exists visualization_sessions_touch_profile_last_seen on public.visualization_sessions;
create trigger visualization_sessions_touch_profile_last_seen
after insert on public.visualization_sessions
for each row
execute function public.touch_profile_last_seen();

drop trigger if exists feedback_reports_touch_profile_last_seen on public.feedback_reports;
create trigger feedback_reports_touch_profile_last_seen
after insert on public.feedback_reports
for each row
execute function public.touch_profile_last_seen();

drop trigger if exists crash_reports_touch_profile_last_seen on public.crash_reports;
create trigger crash_reports_touch_profile_last_seen
after insert on public.crash_reports
for each row
execute function public.touch_profile_last_seen();

create index if not exists profiles_is_admin_role_idx
  on public.profiles (is_admin, role);

create index if not exists user_activity_user_id_created_at_idx
  on public.user_activity (user_id, created_at desc);

create index if not exists user_activity_action_created_at_idx
  on public.user_activity (action, created_at desc);

create index if not exists execution_logs_user_id_created_at_idx
  on public.execution_logs (user_id, created_at desc);

create index if not exists execution_logs_language_created_at_idx
  on public.execution_logs (language, created_at desc);

create index if not exists execution_logs_success_created_at_idx
  on public.execution_logs (success, created_at desc);

create index if not exists visualization_sessions_user_id_created_at_idx
  on public.visualization_sessions (user_id, created_at desc);

create index if not exists feedback_reports_status_created_at_idx
  on public.feedback_reports (status, created_at desc);

create index if not exists crash_reports_severity_created_at_idx
  on public.crash_reports (severity, created_at desc);

alter table public.roles enable row level security;
alter table public.admin_permissions enable row level security;
alter table public.user_activity enable row level security;
alter table public.execution_logs enable row level security;
alter table public.visualization_sessions enable row level security;
alter table public.feedback_reports enable row level security;
alter table public.crash_reports enable row level security;

grant select on public.roles to authenticated;
grant select on public.admin_permissions to authenticated;
grant select, insert on public.user_activity to authenticated;
grant select, insert on public.execution_logs to authenticated;
grant select, insert on public.visualization_sessions to authenticated;
grant select, insert, update on public.feedback_reports to authenticated;
grant select, insert on public.crash_reports to authenticated;

grant all on public.roles to service_role;
grant all on public.admin_permissions to service_role;
grant all on public.user_activity to service_role;
grant all on public.execution_logs to service_role;
grant all on public.visualization_sessions to service_role;
grant all on public.feedback_reports to service_role;
grant all on public.crash_reports to service_role;

drop policy if exists "roles_read_admin_or_self" on public.roles;
create policy "roles_read_admin_or_self"
on public.roles
for select
to authenticated
using (public.is_admin_user(auth.uid()) or name = 'user');

drop policy if exists "admin_permissions_read_admin" on public.admin_permissions;
create policy "admin_permissions_read_admin"
on public.admin_permissions
for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "user_activity_select_own_or_admin" on public.user_activity;
create policy "user_activity_select_own_or_admin"
on public.user_activity
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "user_activity_insert_own" on public.user_activity;
create policy "user_activity_insert_own"
on public.user_activity
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "execution_logs_select_own_or_admin" on public.execution_logs;
create policy "execution_logs_select_own_or_admin"
on public.execution_logs
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "execution_logs_insert_own" on public.execution_logs;
create policy "execution_logs_insert_own"
on public.execution_logs
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "visualization_sessions_select_own_or_admin" on public.visualization_sessions;
create policy "visualization_sessions_select_own_or_admin"
on public.visualization_sessions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "visualization_sessions_insert_own" on public.visualization_sessions;
create policy "visualization_sessions_insert_own"
on public.visualization_sessions
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "feedback_reports_select_own_or_admin" on public.feedback_reports;
create policy "feedback_reports_select_own_or_admin"
on public.feedback_reports
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "feedback_reports_insert_own" on public.feedback_reports;
create policy "feedback_reports_insert_own"
on public.feedback_reports
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);

drop policy if exists "feedback_reports_update_admin" on public.feedback_reports;
create policy "feedback_reports_update_admin"
on public.feedback_reports
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "crash_reports_select_own_or_admin" on public.crash_reports;
create policy "crash_reports_select_own_or_admin"
on public.crash_reports
for select
to authenticated
using (auth.uid() = user_id or public.is_admin_user(auth.uid()));

drop policy if exists "crash_reports_insert_own" on public.crash_reports;
create policy "crash_reports_insert_own"
on public.crash_reports
for insert
to authenticated
with check (user_id is null or auth.uid() = user_id);
