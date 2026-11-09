# Security operations guide

The canonical security assessment and deployment checklist is in the repository root [SECURITY.md](../SECURITY.md). This file is kept under `docs/` for deployment documentation navigation.

Before a public deployment, configure the values in `deploy/production.env.example`, keep `FRONTEND_URL` explicit, use a bounded trusted-proxy setting, and run the executor only in an isolated worker environment. The local Electron executor is intended for the local user's own code, not hostile multi-tenant workloads.
