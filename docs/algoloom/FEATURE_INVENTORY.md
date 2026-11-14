# Feature Inventory

Status is based on source inspection and available local verification, not on product claims alone.

| Area | Evidence | Status | Notes |
|---|---|---|---|
| Email signup/login/logout | `AuthProvider`, `authService`, Supabase Auth | Working | Email confirmation and resend paths exist. |
| Session restoration | `restoreVerifiedSession` | Working | Restored sessions are verified with `getUser()`. |
| Monaco code editor | `CodeEditorPane`, `HomePage` | Working | Shared browser/Electron renderer. |
| JavaScript execution | `javascriptTraceService`, local executor | Working | Full tracing is limited to eligible programs; other programs can run without tracing. |
| Python execution/tracing | `pythonTraceService` | Working | Uses a generated `sys.settrace` runner with step caps. |
| C/C++/Java execution | `localExecutor`, runtime catalog | Working | Requires installed compilers/runtimes; availability is runtime-dependent. |
| C/C++/Java educational trace | `compiledTraceService` | Partially working | Source heuristic walkthrough, not a native debugger; supported syntax is narrower than the languages. |
| Runtime detection | `runtimeManagerService`, Runtime Manager UI | Working | Cached probes expose installed/missing runtime state. |
| Execution queue/rate/size limits | backend middleware and executor queue | Working | In-memory and instance-local; not a distributed quota system. |
| Execution diagnostics | typed trace diagnostics and visualizer | Working | Compile/run/trace failures are represented in trace responses. |
| Line-by-line timeline | `traceFrames`, `TimelineScrubber` | Working | Uses returned frames and marker metadata. |
| Previous/next/first/last/restart | `PlaybackDock`, HomePage handlers | Working | Frame navigation is implemented. |
| Playback and speed controls | `usePlayback`, playback components | Working | RequestAnimationFrame playback with selectable rates. |
| Variable inspection | classroom frame + visualizer | Working | Snapshot/diff-based, subject to trace quality. |
| Stack/call-frame inspection | execution models + Stack tab | Working | Fidelity varies by execution provider. |
| Heap/memory visualization | memory model + Heap tab | Partially working | Strongest for represented arrays/objects; not a full native heap debugger. |
| Pointer/array visualizations | pointer resolver, array/linked-list components | Partially working | Components exist, but coverage depends on trace shape and language. |
| Code explanation panel | `executionClassroom.ts` | Working | Rule-based explanations; not AI-generated. |
| stdin/program input | HomePage + backend request | Working | Execution supported; JavaScript tracing is skipped for stdin programs. |
| Snippet save/update/delete | `snippetService`, Supabase schema/RLS | Working | Requires applied migrations and valid Supabase config. |
| Workspace management | `workspaceService`, database triggers | Partially working | Default workspace is provisioned; broader workspace creation UI is limited. |
| Execution history | `historyService`, History UI | Working | Stores output/time and snippet snapshot relationships. |
| Local desktop snippets/files | Electron IPC and local-snippet store | Working | Desktop-only path with file restrictions. |
| Code export | desktop save/local snippet flow | Partially working | Local export is implemented; broad trace/export formats are not evident. |
| Theme/settings | HomePage local storage and settings service | Partially working | Theme works locally; durable settings coverage is narrower. |
| Auto-update | Electron update service and modal | Working | Release configuration and GitHub provider are present; publishing is operationally external. |
| Admin dashboard | admin route/pages/services/migrations | Working | Requires exact Supabase `profiles.is_admin` state and applied admin migration. |
| Admin realtime/analytics | Supabase Realtime + admin service | Partially working | Implemented, but depends on database policies/data and has client-side aggregation. |
| Feedback/crash reporting | analytics/feedback services | Working | Failures are intentionally swallowed in safe telemetry wrappers. |
| Technical SEO | static shell, `seo.tsx`, robots/sitemap/schema | Working | Root is indexable; authenticated/admin routes are noindex. |
| Public marketing/education site | route inventory | Unimplemented | No public landing/course/documentation route separate from auth/workspace. |
| CI deployment workflows | `.github/workflows` | Unknown | Workflow definitions exist; successful production runs were not verifiable from the local checkout. |
| Automated unit tests | repository inspection | Unimplemented | No configured Jest/Vitest test suite found. |
| Browser E2E tests | repository inspection | Unimplemented | No Playwright/Cypress suite found. |

## Important qualification

“Working” means a coherent implementation exists and TypeScript/build or engine verification supports it where available. It does not mean every runtime, operating system, compiler, database project, or production deployment has been tested in this audit.

