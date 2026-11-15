# AlgoLoom LMS Implementation Matrix

Audit date: 2026-11-15

| Capability | Current implementation | Database/API state | Status |
| --- | --- | --- | --- |
| Public lesson library | `/learn` now loads published lessons through `learningService` with search, difficulty filtering, pagination, loading and empty states | Uses `lessons` RLS policy | Implemented |
| Starter curriculum | Existing three reviewed local lessons remain available only when the remote published catalog is empty | Not synchronized to Supabase | Preview fallback |
| Lesson detail | Query-string lesson detail view with structured text rendering, code blocks, objectives, examples and completion action | Remote lesson content is read through Supabase | Implemented |
| Categories | Category filter is loaded from `lesson_categories` | Public category policy applies | Implemented |
| Progress | Authenticated progress is hydrated from Supabase; local state is retained for preview/offline use | `lesson_progress` upsert and ownership RLS | Implemented, needs live-data verification |
| Reading checkpoints | Detail view records local progress and debounces remote checkpoint writes | Uses `updateLessonProgress` | Implemented |
| Bookmarks | Cards and detail view support add/remove; authenticated actions use Supabase | `lesson_bookmarks` ownership RLS | Implemented, needs live-data verification |
| Dashboard statistics | Started, completed, completion, bookmarks and quiz-attempt counters are displayed | Uses `getLearningAnalytics` for authenticated users | Implemented |
| Quiz scoring | Existing local starter quiz remains client-side only | Current schema accepts client-provided score | Not production-secure |
| Secure quiz scoring | No trusted RPC or backend endpoint exists yet | Requires reviewed migration and trusted scoring path | Blocked for Stage E |
| Seeded remote content | No published rows currently exist remotely | Migration history is empty because foundation was manually executed | Pending content migration/review |
| Admin lesson management | Existing admin shell exists, but no LMS content editor | Existing admin policies can be reused | Pending |
| Learning history UI | Data-access function exists; dashboard visualization is not complete | Uses `quiz_attempts` and progress tables | Partial |

## Verification notes

- Remote inspection confirmed all five learning tables exist and have RLS enabled.
- Remote learning tables currently contain zero rows.
- Supabase migration history currently returns no records because the foundation was executed manually in SQL Editor.
- No production migration was applied by this stage.
- Existing CodeSight execution, authentication, workspace and desktop functionality was not replaced.
