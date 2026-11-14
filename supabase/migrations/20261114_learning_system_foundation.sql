-- AlgoLoom learning system foundation.
--
-- This migration is additive. It does not alter or delete existing CodeSight
-- tables. Lessons are public only when published; all user-owned learning
-- records are protected by auth.uid() ownership policies.

create table if not exists public.lesson_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lesson_categories_name_not_blank check (length(trim(name)) > 0),
  constraint lesson_categories_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text not null,
  content jsonb not null default '{}'::jsonb,
  category_id uuid references public.lesson_categories (id) on delete restrict,
  difficulty text not null default 'beginner',
  estimated_duration integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lessons_title_not_blank check (length(trim(title)) > 0),
  constraint lessons_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint lessons_content_is_object check (jsonb_typeof(content) = 'object'),
  constraint lessons_difficulty_check check (difficulty in ('beginner', 'intermediate', 'advanced')),
  constraint lessons_estimated_duration_check check (estimated_duration >= 0)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status text not null default 'not_started',
  progress_percentage integer not null default 0,
  last_position integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint lesson_progress_user_lesson_unique unique (user_id, lesson_id),
  constraint lesson_progress_status_check check (status in ('not_started', 'in_progress', 'completed')),
  constraint lesson_progress_percentage_check check (progress_percentage between 0 and 100),
  constraint lesson_progress_position_check check (last_position >= 0),
  constraint lesson_progress_completed_consistency check (
    (status = 'completed' and progress_percentage = 100 and completed_at is not null)
    or status <> 'completed'
  )
);

create table if not exists public.lesson_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint lesson_bookmarks_user_lesson_unique unique (user_id, lesson_id)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  score integer not null,
  total_questions integer not null,
  answers jsonb not null default '[]'::jsonb,
  completed_at timestamptz not null default timezone('utc', now()),
  constraint quiz_attempts_total_questions_check check (total_questions > 0),
  constraint quiz_attempts_score_check check (score between 0 and total_questions),
  constraint quiz_attempts_answers_check check (jsonb_typeof(answers) in ('array', 'object'))
);

create index if not exists lesson_categories_slug_idx
  on public.lesson_categories (slug);

create index if not exists lessons_published_category_idx
  on public.lessons (published, category_id, updated_at desc);

create index if not exists lessons_published_difficulty_idx
  on public.lessons (published, difficulty, updated_at desc);

create index if not exists lesson_progress_user_updated_idx
  on public.lesson_progress (user_id, updated_at desc);

create index if not exists lesson_progress_lesson_idx
  on public.lesson_progress (lesson_id);

create index if not exists lesson_bookmarks_user_created_idx
  on public.lesson_bookmarks (user_id, created_at desc);

create index if not exists quiz_attempts_user_completed_idx
  on public.quiz_attempts (user_id, completed_at desc);

create index if not exists quiz_attempts_user_lesson_completed_idx
  on public.quiz_attempts (user_id, lesson_id, completed_at desc);

-- Reuse the existing timestamp function from the production architecture
-- migration instead of creating a duplicate trigger function.
drop trigger if exists lesson_categories_set_updated_at on public.lesson_categories;
create trigger lesson_categories_set_updated_at
before update on public.lesson_categories
for each row
execute function public.set_updated_at();

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row
execute function public.set_updated_at();

drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row
execute function public.set_updated_at();

alter table public.lesson_categories enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_bookmarks enable row level security;
alter table public.quiz_attempts enable row level security;

-- Published content is intentionally readable without authentication. The
-- category policy only exposes categories used by published lessons.
grant select on public.lesson_categories to anon, authenticated;
grant select on public.lessons to anon, authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select, insert, delete on public.lesson_bookmarks to authenticated;
grant select, insert on public.quiz_attempts to authenticated;
grant all on public.lesson_categories to service_role;
grant all on public.lessons to service_role;
grant all on public.lesson_progress to service_role;
grant all on public.lesson_bookmarks to service_role;
grant all on public.quiz_attempts to service_role;

drop policy if exists "lesson_categories_select_published_or_admin" on public.lesson_categories;
create policy "lesson_categories_select_published_or_admin"
on public.lesson_categories
for select
to anon, authenticated
using (
  public.is_admin_user(auth.uid())
  or exists (
    select 1
    from public.lessons
    where lessons.category_id = lesson_categories.id
      and lessons.published = true
  )
);

drop policy if exists "lesson_categories_insert_admin" on public.lesson_categories;
create policy "lesson_categories_insert_admin"
on public.lesson_categories
for insert
to authenticated
with check (public.is_admin_user(auth.uid()));

drop policy if exists "lesson_categories_update_admin" on public.lesson_categories;
create policy "lesson_categories_update_admin"
on public.lesson_categories
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "lesson_categories_delete_admin" on public.lesson_categories;
create policy "lesson_categories_delete_admin"
on public.lesson_categories
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "lessons_select_published_or_admin" on public.lessons;
create policy "lessons_select_published_or_admin"
on public.lessons
for select
to anon, authenticated
using (published = true or public.is_admin_user(auth.uid()));

drop policy if exists "lessons_insert_admin" on public.lessons;
create policy "lessons_insert_admin"
on public.lessons
for insert
to authenticated
with check (public.is_admin_user(auth.uid()));

drop policy if exists "lessons_update_admin" on public.lessons;
create policy "lessons_update_admin"
on public.lessons
for update
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

drop policy if exists "lessons_delete_admin" on public.lessons;
create policy "lessons_delete_admin"
on public.lessons
for delete
to authenticated
using (public.is_admin_user(auth.uid()));

drop policy if exists "lesson_progress_select_own" on public.lesson_progress;
create policy "lesson_progress_select_own"
on public.lesson_progress
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "lesson_progress_insert_own" on public.lesson_progress;
create policy "lesson_progress_insert_own"
on public.lesson_progress
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "lesson_progress_update_own" on public.lesson_progress;
create policy "lesson_progress_update_own"
on public.lesson_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "lesson_progress_delete_own" on public.lesson_progress;
create policy "lesson_progress_delete_own"
on public.lesson_progress
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "lesson_bookmarks_select_own" on public.lesson_bookmarks;
create policy "lesson_bookmarks_select_own"
on public.lesson_bookmarks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "lesson_bookmarks_insert_own" on public.lesson_bookmarks;
create policy "lesson_bookmarks_insert_own"
on public.lesson_bookmarks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "lesson_bookmarks_delete_own" on public.lesson_bookmarks;
create policy "lesson_bookmarks_delete_own"
on public.lesson_bookmarks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own"
on public.quiz_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own"
on public.quiz_attempts
for insert
to authenticated
with check (auth.uid() = user_id);
