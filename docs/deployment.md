# CodeSight Deployment Guide

## Architecture

CodeSight is deployed as four production surfaces:

1. Vercel serves the React/Vite frontend over HTTPS.
2. Render hosts the public Node.js API.
3. A private Docker host runs the execution service and language runner containers.
4. Supabase provides authentication and PostgreSQL persistence.

Recommended production flow:

```text
Browser / Electron
        |
        v
Vercel frontend / Desktop renderer
        |
        v
Render API (/execute, health, CORS, rate limiting)
        |
        v
Private executor service (/internal/execute + shared secret)
        |
        v
Ephemeral Docker runner containers (JS, Python, C/C++, Java)
```

## Deployment Files

- [vercel.json](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/vercel.json): SPA rewrites, cache headers, security headers
- [render.yaml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/render.yaml): Render web service blueprint
- [docker/Dockerfile.api](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.api): API production image
- [docker/Dockerfile.executor](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker/Dockerfile.executor): executor production image with Docker CLI
- [docker-compose.production.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker-compose.production.yml): self-hosted API/executor/proxy stack
- [deploy/Caddyfile](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/deploy/Caddyfile): HTTPS reverse proxy for the executor host
- [supabase/migrations/20260509_initial_schema.sql](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/supabase/migrations/20260509_initial_schema.sql): production SQL schema and RLS policies
- [.github/workflows/frontend-deploy.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/frontend-deploy.yml)
- [.github/workflows/backend-deploy.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/backend-deploy.yml)
- [.github/workflows/electron-release.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/electron-release.yml)

## Folder Structure

```text
backend/
  src/
    app.ts
    executorApp.ts
    services/
    executors/
docker/
  Dockerfile.api
  Dockerfile.executor
  Dockerfile.node
  Dockerfile.python
  Dockerfile.cpp
  Dockerfile.java
deploy/
  Caddyfile
  production.env.example
docs/
  deployment.md
frontend/
  src/
  vite.config.ts
supabase/
  migrations/
```

## Frontend on Vercel

Project settings:

- Framework preset: `Other`
- Root directory: repository root
- Build command: `npm run build --prefix frontend`
- Output directory: `frontend/dist`

Required Vercel env vars:

```env
VITE_SUPABASE_URL=https://gtchouaqbcwawonomqgt.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_PeVJKSu36aYGyy0Pvp1cow_LZTh0F6Q
VITE_API_BASE_URL=https://api.codesight.app
```

Notes:

- `vercel.json` rewrites every route to `index.html` so client-side routing works after refresh.
- Immutable cache headers are applied to Vite assets under `/assets`.
- HTTPS is handled by Vercel automatically.

## Backend API on Render

Recommended service:

- Type: Web Service
- Runtime: Docker
- Blueprint file: [render.yaml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/render.yaml)
- Health check: `/health`

Required Render env vars:

```env
NODE_ENV=production
FRONTEND_URL=https://codesight.app
TRUST_PROXY=true
EXECUTOR_MODE=remote
REMOTE_EXECUTOR_URL=https://executor.codesight.app/internal/execute
REMOTE_EXECUTOR_TIMEOUT_MS=20000
EXECUTOR_SHARED_SECRET=<long-random-secret>
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
LOG_LEVEL=info
```

Production middleware already enabled in the API:

- `helmet`
- `compression`
- `express-rate-limit`
- `pino-http`
- strict CORS allowlist

## Docker Execution Host

Use a small VM with Docker Engine installed. The executor container needs access to `/var/run/docker.sock` so it can create short-lived runner containers safely.

Steps:

1. Copy [deploy/production.env.example](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/deploy/production.env.example) to `.env` on the Docker host.
2. Set `EXECUTOR_DOMAIN` and `EXECUTOR_SHARED_SECRET`.
3. Log into GHCR on the host if your images are private.
4. Run:

```bash
docker compose -f docker-compose.production.yml pull
docker compose -f docker-compose.production.yml up -d executor executor-proxy
```

Security controls already enforced by the executor and runner flow:

- `--network none`
- CPU limits
- memory limits
- PID limits
- container timeout cleanup
- read-only root filesystem
- dropped Linux capabilities
- `no-new-privileges`

If you keep GHCR packages private, leave `DOCKER_CONFIG_PATH` pointed at the host Docker config so the executor container can pass registry credentials through the mounted Docker socket.

## Supabase Production Setup

Run the SQL in [supabase/migrations/20260509_initial_schema.sql](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/supabase/migrations/20260509_initial_schema.sql).

That migration creates:

- `profiles`
- `snippets`
- `execution_history`
- RLS policies for per-user isolation
- `handle_new_user()` trigger for profile creation

Required Supabase settings:

- Enable Email auth
- Decide whether email confirmation is required
- Keep only the anon key in the frontend
- Never use the service role key in the renderer or Electron preload

## Electron Packaging

Electron Builder is configured in [package.json](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/package.json) with:

- Windows `nsis`
- macOS `dmg`
- Linux `AppImage`
- GitHub publish metadata for release assets

Build commands:

```bash
npm run electron:start
npm run build
npm run electron:build
```

Notes:

- `npm run electron:start` is the local self-contained smoke test. It uses the built frontend and the embedded backend, so it should still open even when the separate dev API is not running.
- `npm run electron:dev` is only for development with the Vite and backend dev servers already running.
- Desktop releases currently prefer the embedded backend by default via [electron/desktop.config.json](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/electron/desktop.config.json). If you want a packaged app to call a hosted API instead, set `preferHostedApiInProduction` back to `true`.

For release automation:

- push a tag like `v1.0.0`
- GitHub Actions builds all three desktop targets
- artifacts are uploaded and can be published to GitHub Releases

Optional signing secrets you can add later:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

## CI/CD

### Frontend

Workflow: [frontend-deploy.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/frontend-deploy.yml)

Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Backend

Workflow: [backend-deploy.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/backend-deploy.yml)

This workflow:

- validates the backend build
- builds and pushes API/executor/runner images to GHCR
- triggers the Render API deploy hook

Required GitHub secrets:

- `RENDER_DEPLOY_HOOK_API`

### Electron

Workflow: [electron-release.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/.github/workflows/electron-release.yml)

This workflow:

- runs on version tags
- builds native artifacts on Windows, macOS, and Linux
- uploads installers and update metadata

## Production Commands

Build everything locally:

```bash
npm run build
```

Build all Docker images locally:

```bash
npm run docker:build
```

Bring up the self-hosted production stack:

```bash
docker compose -f docker-compose.production.yml up -d
```

## Troubleshooting

### Vercel frontend loads but API calls fail

- Check `VITE_API_BASE_URL`
- Confirm Render `FRONTEND_URL` matches the Vercel domain exactly
- Verify CORS errors in Render logs

### Render API returns 503 from `/execute`

- Confirm `EXECUTOR_MODE=remote`
- Confirm `REMOTE_EXECUTOR_URL` points to `/internal/execute`
- Confirm `EXECUTOR_SHARED_SECRET` matches on both services
- Check that the executor host is reachable over HTTPS

### Executor service is healthy but code execution fails

- Confirm `/var/run/docker.sock` is mounted into the executor container
- Confirm the runner images exist in GHCR and the host can pull them
- Confirm Docker Engine is running on the VM
- Review executor logs for timeout or image pull failures

### Runner containers time out too often

- Increase `EXECUTION_TIMEOUT_MS`
- Increase `EXECUTION_MEMORY_LIMIT` for heavy compiled workloads
- Check host CPU saturation and Docker daemon pressure

### Supabase auth works locally but fails in production

- Check the site URL and redirect settings in Supabase Auth
- Make sure only the anon key is exposed to Vercel
- Confirm RLS policies were applied from the migration SQL

### Electron builds but auto-publish does not happen

- Ensure the workflow runs on a Git tag like `v1.2.3`
- Confirm the repository has `contents: write` permission in Actions
- Check that the GitHub release draft was created successfully
