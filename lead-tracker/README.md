# Expat Lead Tracker

Internal **affiliate lead pipeline & performance tracker** for the insurance brokerage. Every lead
from every affiliate partner, tracked through a fixed 7-stage lifecycle, with all reporting
sliceable by affiliate. Not a sales CRM.

> **"CRM" = Client Relationship Manager (a person).** In this app that entity is the **RM** —
> never CRM software.

## Stack

Next.js 15 (App Router, TS strict) · Tailwind + shadcn-style UI · TanStack Query · React Hook Form
+ Zod · Recharts · dnd-kit · Supabase (Postgres, RLS, Auth, Storage, pg_cron).

## Quick start

```bash
cp .env.example .env.local     # fill in Supabase URL + publishable key
npm install
npm run dev                    # http://localhost:3000
```

First signup becomes **Admin**. See [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for setup, deploy, and ops.

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests (transitions, conversion, permissions, filters) |
| `npm run e2e` | Playwright (`npx playwright install` first; set `TEST_EMAIL`/`TEST_PASSWORD` for authed flows) |
| `npm run types:gen` | regenerate `types/database.ts` from Supabase |

## Layout

```
app/(app)/         dashboard · pipeline · leads/[code] · affiliates · analytics · reports · import · settings
app/(auth)/login   auth
components/         ui/ (primitives) · pipeline/ · leads/ · affiliates/ · analytics/ · settings/ · …
lib/               actions/ (server actions) · domain/ (pure logic) · schemas/ (Zod) · queries/ · supabase/
supabase/          migrations/ · seed.sql · tests/rls_tests.sql · README.md
docs/              RUNBOOK.md · ROADMAP.md
```

Design & data decisions are documented in the migration headers and `supabase/README.md`.
