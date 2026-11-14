# Regression Matrix

Status reflects what is automated in Prompt 2. “Manual” means the feature exists but no browser runner is configured. “Unsupported” means the current product does not provide the requested workflow as a guaranteed capability.

| Workflow | Current support | Coverage | Test location / verification |
|---|---|---|---|
| Open authenticated workspace | Supported | Manual | `AuthProvider` + `App` route gate; browser smoke still needed |
| Create new file | Desktop-supported | Manual | Electron local-file flow |
| Edit code | Supported | Manual | Monaco editor |
| Select language | Supported | Manual | `HomePage` language presets |
| Execute JavaScript | Supported | Automated | `backend/tests/execution.integration.test.ts` |
| Execute Python/C/C++/Java | Runtime-dependent | Engine verification | `backend/src/scripts/verifyExecutionEngine.ts`; host runtimes required |
| Receive execution trace | Supported | Automated | Backend trace response assertions |
| Highlight current source line | Supported | Domain automated; UI manual | `frontend/tests/visualization.test.ts` |
| Inspect variables | Supported | Domain automated; UI manual | Classroom-frame model test |
| Inspect call stack | Supported | Domain automated; UI manual | Classroom-frame stack assertion |
| Inspect stack memory | Supported | Domain automated; UI manual | Memory model assertion |
| Inspect heap memory | Partial/provider-dependent | Domain automated; UI manual | Heap block assertion; fidelity varies by language |
| Move backward/forward | Supported | Manual | `usePlayback` and playback controls; no React test runner |
| Pause/resume playback | Supported | Manual | `usePlayback`; no React test runner |
| Change playback speed | Supported | Manual | `HomePage`/`PlaybackDock`; no React test runner |
| Save code to Supabase | Supported with configured Supabase | Manual | `snippetService` + RLS; staging DB fixture needed |
| Load previous work/history | Supported with configured Supabase | Manual | `historyService`/snippet services |
| Authenticate | Supported with configured Supabase | Manual | Auth service; no test credentials used |
| Handle invalid execution input | Supported | Automated | Empty code, unsupported language, malformed JSON |
| Handle execution timeout | Supported | Automated | Child-process timeout test |
| Handle backend/network failure | Supported | Manual | `api.ts` timeout/fetch error path; browser network test needed |
| Recover from renderer render crash | Supported | Static/build verified | `ErrorBoundary`; browser interaction test still needed |
| Admin dashboard authorization | Supported with migration/config | Manual | `useAdminAccess`; requires real profile row |
| Public course/learning routes | Not implemented | Unsupported | No current public learning route |

## Explicit unsupported test scenarios

- Native debugger-level trace fidelity for arbitrary C, C++, or Java syntax.
- Full browser E2E coverage without an approved browser test dependency and staging authentication fixture.
- Supabase integration tests against production data.
- Electron OS-level installer/update tests in this local test command.

## Regression rule

Any future feature touching execution, trace types, `HomePage`, Supabase migrations/RLS, Electron IPC, or deployment configuration must update this matrix and add a test at the narrowest appropriate layer before implementation is considered complete.
