# AlgoLoom / CodeSight Repository Audit

**Audit date:** 2026-11-14  
**Branch:** `feature/platform-transformation`  
**Scope:** discovery only; no application refactoring or redesign was performed.

## Executive summary

CodeSight is an npm-workspaces monorepo containing:

- a React 19 + TypeScript + Vite browser renderer;
- an Express 5 + TypeScript execution API;
- an Electron 41 desktop shell with a preload IPC bridge;
- Supabase Auth, Postgres, Row Level Security, and Realtime integrations;
- local process-based execution for JavaScript, Python, C, C++, and Java;
- Vercel frontend deployment, Render/container-oriented backend deployment, and GitHub Actions automation.

The main product surface is an authenticated single-page workbench. There is no separate public marketing route: the root route either renders authentication or the authenticated workbench. SEO metadata and a static HTML shell exist, but public educational content is not currently a first-class route.

The repository currently builds successfully from the root. Automated unit, integration, and browser end-to-end test suites are not configured. The backend has an executable-engine verification script, which is the strongest existing regression check.

## Repository map

```text
codeSight/
├── frontend/                 React/Vite renderer and browser deployment
│   ├── src/App.tsx           HashRouter, auth gate, admin routes
│   ├── src/pages/HomePage.tsx Main authenticated workbench
│   ├── src/components/       editor, visualizer, memory, playback, admin UI
│   ├── src/services/         Supabase persistence and telemetry services
│   ├── src/engine/            client-side execution/domain types and interpreter
│   └── public/                robots.txt, sitemap.xml, first-party assets
├── backend/                  Express API and execution engine
│   └── src/
│       ├── app.ts             middleware, health, runtime, execute route
│       ├── controllers/      request validation and trace response handling
│       ├── executors/         queue, runtime discovery, process execution
│       └── services/execution language trace providers
├── electron/                 desktop main process and preload bridge
├── supabase/migrations/      schema, triggers, RLS, admin/telemetry tables
├── deploy/                   Caddy and production environment examples
├── .github/workflows/        frontend, backend, and desktop release workflows
├── docker/                   container-related repository assets
└── docs/                     deployment, security, SEO, and architecture notes
```

## Actual entry points and package boundaries

| Boundary | Entry point | Build/runtime responsibility |
|---|---|---|
| Root workspace | `package.json` | Orchestrates backend, frontend, Electron development/builds and packaging |
| Browser renderer | `frontend/src/main.tsx` | Mounts `HashRouter` and `AuthProvider`; Vite serves/builds it |
| React application | `frontend/src/App.tsx` | Auth gate, workspace route, admin route tree, SEO component |
| Workbench | `frontend/src/pages/HomePage.tsx` | Monaco editor, execution orchestration, persistence, playback, visualizer |
| HTTP API | `backend/src/index.ts` → `backend/src/app.ts` | Starts Express API and exposes health/runtime/execute endpoints |
| Execution API | `backend/src/routes/executionRoutes.ts` | `POST /execute` dispatches to controller |
| Executor process | `backend/src/executorIndex.ts` | Separate executor entry point exists for deployment architecture |
| Desktop main | `electron/main.ts` | Creates windows, starts embedded backend, owns IPC and local files |
| Desktop renderer bridge | `electron/preload.ts` | Exposes narrowly typed `window.electronAPI` APIs |
| Database | Supabase migrations | Auth-linked profiles, workspaces, snippets, history, telemetry and admin data |

## Environment and deployment surfaces

- Browser frontend: Vite build, intended for Vercel (`frontend/vercel.json` and root `vercel.json`).
- Backend: standalone Node/Express process with Render/container configuration (`render.yaml`, GitHub backend workflow, Docker assets).
- Desktop: Electron Builder targets Windows NSIS, macOS DMG/ZIP, and Linux AppImage.
- Desktop development: Vite on `5180`, API on `4000`, Electron launches after both are healthy.
- Desktop production: Electron starts an embedded backend on loopback and loads the packaged frontend.
- Supabase is external infrastructure; migrations must be applied to the selected project.

## Audit conclusion

The project is a functional CodeSight workbench rather than an unimplemented prototype. Its strongest implemented area is the execution/visualization loop. The largest product and architecture gaps for AlgoLoom are public educational information architecture, test coverage, and a more formally separated domain/API layer before adding broad platform features.

