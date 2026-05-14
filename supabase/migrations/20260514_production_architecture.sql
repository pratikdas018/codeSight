create extension if not exists "pgcrypto";

do $$
begin
  create type public.code_language as enum ('javascript', 'python', 'c', 'cpp', 'java');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.execution_status as enum ('completed', 'error', 'timeout');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  editor_font_size integer not null default 14 check (editor_font_size between 10 and 24),
  auto_save boolean not null default true,
  telemetry_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  title text not null,
  description text,
  language public.code_language not null,
  code text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_opened_at timestamptz
);

create table if not exists public.execution_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  snippet_id uuid references public.snippets (id) on delete set null,
  snippet_title text,
  snippet_language public.code_language,
  snippet_code text,
  output text,
  execution_time integer not null default 0 check (execution_time >= 0),
  runtime_status public.execution_status not null default 'completed',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists last_seen_at timestamptz not null default timezone('utc', now());

alter table public.snippets
  add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade,
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists last_opened_at timestamptz;

alter table public.execution_history
  add column if not exists workspace_id uuid references public.workspaces (id) on delete set null,
  add column if not exists snippet_title text,
  add column if not exists snippet_language public.code_language,
  add column if not exists snippet_code text,
  add column if not exists runtime_status public.execution_status not null default 'completed';

alter table public.snippets
  drop constraint if exists snippets_language_check;

alter table public.snippets
  alter column language type public.code_language
  using language::public.code_language;

alter table public.execution_history
  alter column snippet_id drop not null;

alter table public.execution_history
  drop constraint if exists execution_history_snippet_id_fkey;

alter table public.execution_history
  add constraint execution_history_snippet_id_fkey
  foreign key (snippet_id)
  references public.snippets (id)
  on delete set null;

insert into public.profiles (id, email, created_at, updated_at, last_seen_at, display_name, avatar_url)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(users.created_at, timezone('utc', now())),
  timezone('utc', now()),
  timezone('utc', now()),
  nullif(
    trim(
      coalesce(
        users.raw_user_meta_data ->> 'display_name',
        users.raw_user_meta_data ->> 'full_name',
        split_part(coalesce(users.email, ''), '@', 1)
      )
    ),
    ''
  ),
  nullif(users.raw_user_meta_data ->> 'avatar_url', '')
from auth.users as users
on conflict (id) do update
set
  email = excluded.email,
  display_name = coalesce(excluded.display_name, public.profiles.display_name),
  avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
  updated_at = timezone('utc', now()),
  last_seen_at = timezone('utc', now());

insert into public.user_settings (user_id)
select users.id
from auth.users as users
on conflict (user_id) do nothing;

insert into public.workspaces (user_id, name, description, is_default)
select
  users.id,
  'My workspace',
  'Default CodeSight workspace',
  true
from auth.users as users
where not exists (
  select 1
  from public.workspaces as workspaces
  where workspaces.user_id = users.id
    and workspaces.is_default = true
);

update public.snippets as snippets
set workspace_id = workspaces.id
from public.workspaces as workspaces
where snippets.workspace_id is null
  and workspaces.user_id = snippets.user_id
  and workspaces.is_default = true;

update public.execution_history as history
set
  workspace_id = coalesce(
    history.workspace_id,
    (
      select snippets.workspace_id
      from public.snippets as snippets
      where snippets.id = history.snippet_id
    ),
    (
      select workspaces.id
      from public.workspaces as workspaces
      where workspaces.user_id = history.user_id
        and workspaces.is_default = true
      order by workspaces.created_at asc
      limit 1
    )
  ),
  snippet_title = coalesce(
    history.snippet_title,
    (
      select snippets.title
      from public.snippets as snippets
      where snippets.id = history.snippet_id
    ),
    'Deleted snippet'
  ),
  snippet_language = coalesce(
    history.snippet_language,
    (
      select snippets.language
      from public.snippets as snippets
      where snippets.id = history.snippet_id
    ),
    'javascript'::public.code_language
  ),
  snippet_code = coalesce(
    history.snippet_code,
    (
      select snippets.code
      from public.snippets as snippets
      where snippets.id = history.snippet_id
    ),
    ''
  );

alter table public.snippets
  alter column workspace_id set not null;

alter table public.execution_history
  alter column snippet_title set not null,
  alter column snippet_language set not null,
  alter column snippet_code set not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.user_owns_workspace(target_user_id uuid, target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces
    where id = target_workspace_id
      and user_id = target_user_id
  );
$$;

create or replace function public.user_owns_snippet(target_user_id uuid, target_snippet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.snippets
    where id = target_snippet_id
      and user_id = target_user_id
  );
$$;

create or replace function public.prepare_snippet_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is null then
    raise exception 'A user_id is required to save a snippet.';
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'Snippet ownership cannot be reassigned.';
  end if;

  if new.workspace_id is null then
    select workspaces.id
    into new.workspace_id
    from public.workspaces as workspaces
    where workspaces.user_id = new.user_id
      and workspaces.is_default = true
    order by workspaces.created_at asc
    limit 1;
  end if;

  if new.workspace_id is null or not public.user_owns_workspace(new.user_id, new.workspace_id) then
    raise exception 'Snippets must belong to a workspace owned by the same user.';
  end if;

  new.title := nullif(trim(new.title), '');

  if new.title is null then
    raise exception 'Snippet title is required.';
  end if;

  if tg_op = 'UPDATE' then
    new.last_opened_at := coalesce(new.last_opened_at, old.last_opened_at);
  end if;

  return new;
end;
$$;

create or replace function public.prepare_execution_history_record()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  resolved_snippet public.snippets%rowtype;
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is null then
    raise exception 'A user_id is required to save execution history.';
  end if;

  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    raise exception 'Execution history ownership cannot be reassigned.';
  end if;

  if new.snippet_id is not null then
    select *
    into resolved_snippet
    from public.snippets
    where id = new.snippet_id;

    if not found then
      raise exception 'Execution history must reference a valid snippet.';
    end if;

    if resolved_snippet.user_id <> new.user_id then
      raise exception 'Execution history can only reference snippets owned by the same user.';
    end if;

    new.workspace_id := coalesce(new.workspace_id, resolved_snippet.workspace_id);
    new.snippet_title := coalesce(nullif(trim(new.snippet_title), ''), resolved_snippet.title);
    new.snippet_language := coalesce(new.snippet_language, resolved_snippet.language);
    new.snippet_code := coalesce(new.snippet_code, resolved_snippet.code);
  end if;

  if new.workspace_id is null then
    select workspaces.id
    into new.workspace_id
    from public.workspaces as workspaces
    where workspaces.user_id = new.user_id
      and workspaces.is_default = true
    order by workspaces.created_at asc
    limit 1;
  end if;

  if new.workspace_id is not null and not public.user_owns_workspace(new.user_id, new.workspace_id) then
    raise exception 'Execution history must belong to a workspace owned by the same user.';
  end if;

  new.snippet_title := nullif(trim(new.snippet_title), '');

  if new.snippet_title is null then
    raise exception 'Execution history requires a snippet title snapshot.';
  end if;

  if new.snippet_language is null then
    raise exception 'Execution history requires a snippet language snapshot.';
  end if;

  if new.snippet_code is null then
    raise exception 'Execution history requires a snippet code snapshot.';
  end if;

  return new;
end;
$$;

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, last_seen_at)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'display_name',
          new.raw_user_meta_data ->> 'full_name',
          split_part(coalesce(new.email, ''), '@', 1)
        )
      ),
      ''
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    timezone('utc', now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc', now()),
    last_seen_at = timezone('utc', now());

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.workspaces (user_id, name, description, is_default)
  select
    new.id,
    'My workspace',
    'Default CodeSight workspace',
    true
  where not exists (
    select 1
    from public.workspaces
    where user_id = new.id
      and is_default = true
  );

  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();

drop trigger if exists snippets_set_updated_at on public.snippets;
create trigger snippets_set_updated_at
before update on public.snippets
for each row
execute function public.set_updated_at();

drop trigger if exists snippets_prepare_record on public.snippets;
create trigger snippets_prepare_record
before insert or update on public.snippets
for each row
execute function public.prepare_snippet_record();

drop trigger if exists execution_history_prepare_record on public.execution_history;
create trigger execution_history_prepare_record
before insert or update on public.execution_history
for each row
execute function public.prepare_execution_history_record();

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_synced on auth.users;

create trigger on_auth_user_synced
after insert or update of email, raw_user_meta_data on auth.users
for each row
execute function public.handle_auth_user();

create unique index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));

create unique index if not exists workspaces_default_per_user_idx
  on public.workspaces (user_id)
  where is_default = true;

create index if not exists workspaces_user_id_created_at_idx
  on public.workspaces (user_id, created_at desc);

create index if not exists snippets_user_id_workspace_id_created_at_idx
  on public.snippets (user_id, workspace_id, created_at desc);

create index if not exists snippets_workspace_id_updated_at_idx
  on public.snippets (workspace_id, updated_at desc);

create index if not exists execution_history_user_id_workspace_id_created_at_idx
  on public.execution_history (user_id, workspace_id, created_at desc);

create index if not exists execution_history_snippet_id_created_at_idx
  on public.execution_history (snippet_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.snippets enable row level security;
alter table public.execution_history enable row level security;
alter table public.workspaces enable row level security;
alter table public.user_settings enable row level security;

revoke all on public.profiles from anon, public;
revoke all on public.workspaces from anon, public;
revoke all on public.snippets from anon, public;
revoke all on public.execution_history from anon, public;
revoke all on public.user_settings from anon, public;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.snippets to authenticated;
grant select, insert, delete on public.execution_history to authenticated;
grant select, insert, update on public.user_settings to authenticated;

grant all on public.profiles to service_role;
grant all on public.workspaces to service_role;
grant all on public.snippets to service_role;
grant all on public.execution_history to service_role;
grant all on public.user_settings to service_role;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own"
on public.workspaces
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own"
on public.workspaces
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own"
on public.workspaces
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own"
on public.workspaces
for delete
to authenticated
using (auth.uid() = user_id and is_default = false);

drop policy if exists "snippets_select_own" on public.snippets;
create policy "snippets_select_own"
on public.snippets
for select
to authenticated
using (
  auth.uid() = user_id
  and public.user_owns_workspace(user_id, workspace_id)
);

drop policy if exists "snippets_insert_own" on public.snippets;
create policy "snippets_insert_own"
on public.snippets
for insert
to authenticated
with check (
  auth.uid() = user_id
  and public.user_owns_workspace(user_id, workspace_id)
);

drop policy if exists "snippets_update_own" on public.snippets;
create policy "snippets_update_own"
on public.snippets
for update
to authenticated
using (
  auth.uid() = user_id
  and public.user_owns_workspace(user_id, workspace_id)
)
with check (
  auth.uid() = user_id
  and public.user_owns_workspace(user_id, workspace_id)
);

drop policy if exists "snippets_delete_own" on public.snippets;
create policy "snippets_delete_own"
on public.snippets
for delete
to authenticated
using (
  auth.uid() = user_id
  and public.user_owns_workspace(user_id, workspace_id)
);

drop policy if exists "execution_history_select_own" on public.execution_history;
create policy "execution_history_select_own"
on public.execution_history
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "execution_history_insert_own" on public.execution_history;
create policy "execution_history_insert_own"
on public.execution_history
for insert
to authenticated
with check (
  auth.uid() = user_id
  and (workspace_id is null or public.user_owns_workspace(user_id, workspace_id))
  and (snippet_id is null or public.user_owns_snippet(user_id, snippet_id))
);

drop policy if exists "execution_history_delete_own" on public.execution_history;
create policy "execution_history_delete_own"
on public.execution_history
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
