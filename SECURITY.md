# CodeSight security and resilience

## Scope and architecture

CodeSight has a Vite/React renderer, an Electron main process with a narrow preload bridge, an Express API, a local execution queue, optional remote executor deployment, and Supabase-backed application data. The browser API is deployed separately from the Vercel frontend; the desktop app starts the backend on loopback and uses the same renderer through IPC.

## Protections implemented

- Express disables `x-powered-by`, uses Helmet, compression, CORS allow-listing, structured request logging, request IDs, JSON body limits, and execution rate limiting.
- Rate-limit responses return HTTP 429 with `Retry-After`. Queue saturation also returns HTTP 429 instead of a misleading successful trace.
- Code and stdin have independent byte limits. Execution has bounded concurrency, queue depth, phase timeouts, process-tree termination, and output limits.
- Child runtimes receive a minimal environment allow-list instead of backend secrets and deployment credentials.
- Liveness (`/live`), dependency/runtime readiness (`/ready`), and detailed runtime health (`/health`) endpoints are available.
- Electron windows use context isolation, sandboxing, disabled Node integration, restricted navigation, trusted IPC sender checks, and production DevTools disabled by default.
- Renderer API requests have a timeout and duplicate execution starts are ignored while a run is active.
- The backend drains HTTP connections on SIGTERM/SIGINT.

## Configuration

See `deploy/production.env.example` for safe defaults. Important values include `TRUST_PROXY`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `MAX_CODE_BYTES`, `MAX_STDIN_BYTES`, `EXECUTION_QUEUE_CONCURRENCY`, `EXECUTION_QUEUE_DEPTH_LIMIT`, `EXECUTION_MAX_OUTPUT_BYTES`, and `EXECUTION_MEMORY_LIMIT_MB`.

Set `TRUST_PROXY` only to the number of trusted reverse-proxy hops or a narrowly scoped Express trust-proxy configuration. Do not use `true` on an internet-facing service unless every proxy hop is controlled.

## Execution isolation limitations

Timeouts and process-tree cleanup reduce risk but are not a complete sandbox. Local desktop execution still runs user code under the logged-in OS account and can potentially access files, network resources, and operating-system capabilities available to that account. The current cross-platform desktop build does not mandate a container, restricted OS user, job object, seccomp profile, or network namespace.

For public multi-tenant execution, use the existing remote-executor path behind dedicated containers or VMs with a non-privileged user, read-only image, no application secrets, restricted network egress, cgroups, process limits, and an external queue/rate-limit store. Do not expose the local executor directly to untrusted internet traffic.

## Scaling and load balancing

The API is stateless for request handling, but the execution queue and in-memory rate limiter are instance-local. A single Render instance is currently the appropriate default because local execution depends on installed runtimes and local process capacity. Before scaling horizontally, move execution to isolated workers and use a shared Redis-backed limiter/queue; otherwise requests can bypass limits between instances and runtime availability will differ.

The `/live` endpoint is suitable for load-balancer liveness. `/ready` checks runtime-manager readiness and should be used for readiness-aware routing when the deployment platform supports it.

## Remaining risks

High: local execution is not a security sandbox. Medium: browser execution is publicly callable and currently uses IP-based rate limiting rather than verified per-user quotas. Medium: in-memory queues and rate limits do not coordinate across instances. Low: runtime discovery and `/health` are intentionally lightweight but still depend on local runtime state.

## Production checklist

1. Configure an explicit frontend origin and `TRUST_PROXY=1` (or the exact trusted hop count).
2. Keep executor shared secrets out of frontend and renderer environment variables.
3. Run public execution only through isolated remote workers.
4. Configure process supervision and restart policy at Render/container level.
5. Submit controlled load tests against staging, not production.
6. Review `npm audit`, lockfile changes, logs, and resource usage before each release.
