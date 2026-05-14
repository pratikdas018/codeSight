# CodeSight Supabase Architecture

CodeSight now expects the Supabase backend defined by these migrations:

- `supabase/migrations/20260509_initial_schema.sql`
- `supabase/migrations/20260514_production_architecture.sql`

## Data model

- `public.profiles`
  - One row per `auth.users` record.
  - Stores `email`, `display_name`, `avatar_url`, `created_at`, `updated_at`, and `last_seen_at`.
- `public.workspaces`
  - One-to-many from user to workspace.
  - Every user gets a default workspace automatically.
- `public.snippets`
  - Owned by a user and attached to a workspace.
  - Uses the `public.code_language` enum.
- `public.execution_history`
  - Owned by a user, optionally linked to a live snippet, and stores immutable snippet snapshots so history survives snippet deletion.
- `public.user_settings`
  - One row per user for desktop/editor preferences.

## Auth and provisioning

- Supabase Auth is the source of truth.
- `public.handle_auth_user()` runs after inserts and email/profile metadata updates on `auth.users`.
- The trigger automatically:
  - upserts `public.profiles`
  - creates `public.user_settings`
  - creates a default `public.workspaces` row

## Security

- RLS is enabled on every user-facing table.
- `anon` has no table access.
- `authenticated` can only access rows where `auth.uid()` matches the owner.
- Workspace ownership is enforced in RLS and in insert/update triggers for snippets and execution history.

## Desktop auth expectations

- The Electron renderer persists the Supabase session in the secure IPC-backed auth store.
- Session restore now validates the restored session with `supabase.auth.getUser()` before unlocking the workspace.
- The frontend never unlocks the app unless an authenticated session is present.

## Apply to Supabase

Run the migrations against the linked Supabase project:

```bash
supabase db push
```

If you are applying SQL manually in the Supabase SQL editor, run both migration files in timestamp order.

## Why the 404s happened

Supabase REST endpoints such as `/rest/v1/profiles`, `/rest/v1/snippets`, and `/rest/v1/execution_history` only exist when the underlying relations exist in the exposed schema. Those 404s mean the project database did not actually have the required tables yet. Once the migrations are applied, those endpoints will resolve normally.
