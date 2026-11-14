# AlgoLoom / CodeSight Current Architecture

## System context

```mermaid
flowchart LR
  User[User] --> Browser[Browser React renderer]
  User --> Desktop[Electron desktop shell]
  Browser --> Supabase[Supabase Auth + Postgres + Realtime]
  Desktop --> Main[Electron main process]
  Main --> Renderer[Packaged or Vite renderer]
  Main --> API[Embedded Express API]
  Browser --> HostedAPI[Standalone Express API]
  HostedAPI --> LocalRuntime[Local process runtimes]
  API --> LocalRuntime
  HostedAPI -. optional remote mode .-> Remote[Remote executor service]
```

The browser and desktop applications share the React renderer. Electron adds a main process and preload bridge; it does not replace the frontend architecture.

## Frontend execution workflow

```mermaid
sequenceDiagram
  actor U as User
  participant H as HomePage
  participant A as api.ts
  participant X as Express /execute
  participant Q as ExecutionQueue
  participant E as Local/remote executor
  participant V as Classroom + Visualizer
  participant DB as Supabase

  U->>H: Edit code, select language, press Run
  H->>A: executeCodeRequest(code, language, stdin)
  alt Electron
    A->>Main: window.electronAPI.runCode(payload)
    Main->>X: loopback POST /execute
  else Browser
    A->>X: HTTP POST /execute
  end
  X->>X: Validate code, stdin, language, limits
  X->>Q: enqueue execution
  Q->>E: executeLocally or executeRemotely
  E-->>Q: ExecutionTrace
  Q-->>X: ExecutionTrace
  X-->>A: JSON trace
  A-->>H: normalized trace
  H->>V: select active frame and derive classroom model
  V-->>U: line highlight, explanation, variables, stack, heap, timeline
  H->>DB: persist snippet/history/telemetry when applicable
```

### Backend execution details

1. `executionController` converts request fields to strings and rejects empty code, oversized code/stdin, and unsupported languages.
2. `executeService` selects `remote` mode when configured; otherwise it uses an in-memory `ExecutionQueue` and `executeLocally`.
3. `localExecutor` creates a temporary workspace, runs compile/run phases for C, C++, and Java, and runs interpreter processes for JavaScript/Python.
4. JavaScript uses an Acorn-backed educational interpreter for eligible small programs. Complex, async, module, or stdin-driven JavaScript is executed safely but may skip tracing.
5. Python creates a temporary tracing runner using `sys.settrace`, serializing line steps, scope values, stack frames, output, and errors.
6. C/C++/Java use normal local compilation/execution and then a source-oriented `compiledTraceService` walkthrough. This is not a native debugger trace; it is a bounded heuristic interpreter over supported source constructs.
7. `traceFrameService` materializes trace frames and `runtimeTrace` adds phase status, diagnostics, limits, logs, and metrics.
8. The frontend normalizes legacy `steps` and current `traceFrames`, then `createExecutionClassroomFrame` derives explanations and memory models.

## Frontend state and visualization

`HomePage` is currently the main orchestration boundary. It owns code, language, title, stdin, trace, current frame, snippets, history, runtime health, theme, desktop-file state, and notices.

- Monaco is mounted by `CodeEditorPane` and synchronized with the active execution line.
- `usePlayback` advances frame indices with `requestAnimationFrame`.
- `PlaybackDock`, `TimelineScrubber`, and related controls update the current frame.
- `executionClassroom.ts` creates line explanations, runtime summaries, variable changes, stack entries, and trace-quality labels.
- `visualization/model.ts` and memory utilities derive arrays, pointers, heap nodes, and diffs.
- `ExecutionVisualizer` renders explanation, variables, stack, and heap tabs.

## Authentication and Supabase workflow

```mermaid
sequenceDiagram
  participant R as React AuthProvider
  participant S as Supabase Auth
  participant P as public.profiles
  participant W as workspaces/snippets/history

  R->>S: getSession()
  R->>S: getUser() to verify restored session
  S-->>R: authenticated session
  R->>P: load profile by auth user id
  P-->>R: display/admin/profile fields
  R->>W: user-scoped reads/writes
  Note over W: RLS requires auth.uid() to own rows
```

Supabase Auth is the identity source. Database triggers provision/update `profiles`, `user_settings`, and a default workspace. Frontend services call Supabase directly and use `requireSessionUserId` to verify the active session before user-data operations. Admin pages query telemetry tables after `useAdminAccess` confirms `profiles.is_admin = true`.

## Persistence workflows

- Workspace list/default workspace: `workspaceService` → `workspaces`.
- Snippet create/list/load/update/delete: `snippetService` → `snippets`, scoped by user and workspace.
- Execution history: `historyService` validates snippet ownership, then writes immutable execution history records.
- Preferences: `userSettingsService` → `user_settings`.
- Product telemetry: `analyticsService` writes `user_activity`, `execution_logs`, `visualization_sessions`, crash reports, and feedback.
- Admin: `adminService` reads telemetry and profiles, subscribes to Supabase Realtime changes, and exports CSV/JSON client-side.

## Desktop workflow

```mermaid
flowchart TD
  Start[Electron startup] --> Lock[Single-instance lock]
  Lock --> Splash[Splash window file://]
  Splash --> Backend[Start embedded backend on loopback]
  Backend --> Main[Create main BrowserWindow]
  Main --> Preload[Preload exposes typed IPC]
  Preload --> React[Shared React renderer]
  React --> IPC[Run code / local files / updates / window controls]
  IPC --> Main
```

The main process validates trusted IPC senders, restricts navigation, disables Node integration, uses context isolation/sandboxing, stores local snippets under Electron user data, and manages auto-update state. The renderer can use HTTP directly in a browser or the IPC `runCode` path in Electron.

## API surface found

| Method | Path | Purpose | Auth model |
|---|---|---|---|
| GET | `/live` | Process liveness | None |
| GET | `/ready` | Runtime readiness | None |
| GET | `/health` | API and runtime-manager health | None |
| GET | `/runtimes` | Runtime detection, optional refresh | None |
| POST | `/execute` | Code execution and trace generation | No Supabase auth; rate/size/queue limits |

The application data API is Supabase REST/Realtime accessed by the frontend; there is no separate Express CRUD API for users, snippets, workspaces, or analytics.

