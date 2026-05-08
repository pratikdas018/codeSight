# CodeSight

CodeSight is a production-ready code visualization platform built with React, Vite, Electron, a Node.js API, a hardened Docker-based execution service, and Supabase.

## Production Surfaces

- Web frontend on Vercel
- Public API on Render
- Private execution engine on a Docker host
- Supabase for auth and PostgreSQL data
- Electron desktop releases for Windows, macOS, and Linux

## Key Files

- Web deploy config: [vercel.json](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/vercel.json)
- Render blueprint: [render.yaml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/render.yaml)
- Production Docker stack: [docker-compose.production.yml](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docker-compose.production.yml)
- Executor reverse proxy: [deploy/Caddyfile](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/deploy/Caddyfile)
- Supabase schema: [supabase/migrations/20260509_initial_schema.sql](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/supabase/migrations/20260509_initial_schema.sql)
- Deployment guide: [docs/deployment.md](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/docs/deployment.md)

## Local Commands

```bash
npm install
npm run docker:build:runners
npm run dev
```

## Production Build Commands

```bash
npm run build
npm run docker:build
npm run electron:build
```

## Environment Templates

- API/local backend: [backend/.env.example](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/backend/.env.example)
- Private executor host: [backend/.env.executor.example](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/backend/.env.executor.example)
- Frontend/Vercel: [frontend/.env.example](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/frontend/.env.example)
- Self-hosted compose stack: [deploy/production.env.example](/c:/Users/lenovo/OneDrive/Desktop/projects/codeSight/deploy/production.env.example)
