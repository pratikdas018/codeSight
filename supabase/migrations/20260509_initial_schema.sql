create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  language text not null check (language in ('javascript', 'python', 'c', 'cpp', 'java')),
  code text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.execution_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  snippet_id uuid not null references public.snippets (id) on delete cascade,
  output text,
  execution_time integer not null default 0 check (execution_time >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists snippets_user_id_created_at_idx
  on public.snippets (user_id, created_at desc);

create index if not exists execution_history_user_id_created_at_idx
  on public.execution_history (user_id, created_at desc);

create index if not exists execution_history_snippet_id_idx
  on public.execution_history (snippet_id);

alter table public.profiles enable row level security;
alter table public.snippets enable row level security;
alter table public.execution_history enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

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

drop policy if exists "snippets_select_own" on public.snippets;
create policy "snippets_select_own"
on public.snippets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "snippets_insert_own" on public.snippets;
create policy "snippets_insert_own"
on public.snippets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "snippets_update_own" on public.snippets;
create policy "snippets_update_own"
on public.snippets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "snippets_delete_own" on public.snippets;
create policy "snippets_delete_own"
on public.snippets
for delete
to authenticated
using (auth.uid() = user_id);

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
with check (auth.uid() = user_id);

drop policy if exists "execution_history_delete_own" on public.execution_history;
create policy "execution_history_delete_own"
on public.execution_history
for delete
to authenticated
using (auth.uid() = user_id);
