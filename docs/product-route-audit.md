# AlgoLoom product route audit

This inventory is based on the current React Router configuration in `frontend/src/App.tsx`. It separates the public acquisition surface from the authenticated workspace without replacing existing routes.

| Route | Access | Current purpose | Target experience |
| --- | --- | --- | --- |
| `/` | Public | Product entry point (previously the authenticated workbench) | Public AlgoLoom landing page with real route CTAs and SEO metadata |
| `/playground` | Authenticated | Full Monaco execution and visualization workspace | Existing workspace preserved inside the shared app shell |
| `/home` | Authenticated | Platform home module | Shared platform shell with dashboard-style content |
| `/algorithms` | Public | Algorithm explorer and sorting/algorithm visualizers | Indexable learning surface inside the shared shell |
| `/data-structures` | Authenticated | Interactive data-structure explorer | Learning template with structure-specific controls preserved |
| `/compiler` | Authenticated | Compiler module | Shared shell with compiler-specific workspace content |
| `/sql-lab` | Authenticated | SQL learning module | Shared shell with SQL-specific workspace content |
| `/tools` | Authenticated | Developer productivity utilities | Shared shell with tool-specific controls preserved |
| `/resources` | Authenticated | Resource and learning module | Shared shell with listing/resource content |
| `/admin/*` | Authenticated + admin role | Overview, analytics, users, executions, errors, feedback | Existing protected admin shell preserved |
| `/auth/confirm` | Public callback | Supabase confirmation handling | Existing auth confirmation flow preserved |

## Findings

- The original root route rendered the full execution workspace or authentication screen, so new visitors did not receive a product explanation.
- `/playground` already represents the intended authenticated execution workspace and is the safest canonical destination for the existing `HomePage`.
- `PlatformShell` and `PlatformSidebar` already provide a reusable internal navigation foundation, including responsive drawer behavior.
- Algorithms is intentionally public/indexable; the remaining platform modules are protected and use `noindex` metadata.
- No separate blog, examples, settings, profile, or public detail routes are currently registered; the landing page therefore links only to registered destinations.
- The repository has no configured browser screenshot/Playwright suite at the time of this audit. TypeScript, unit tests, and the production Vite build are the available automated checks.

## Initial implementation boundary

The first product-structure increment adds the public landing page at `/` and preserves the Electron root workspace plus the authenticated `/playground` route. Route-specific visualizer and workspace improvements remain incremental work on the existing pages rather than being replaced with mock pages.
