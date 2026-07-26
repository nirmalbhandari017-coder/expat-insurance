# Ops Runbook — Expat Lead Tracker

Internal affiliate lead pipeline. Next.js (App Router) + Supabase. This app lives in
`lead-tracker/` and deploys as a **separate Netlify site** from the marketing site.

## Environments & secrets

| Var | Where | Notes |
|-----|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Netlify + local `.env.local` | `https://zuoekghumuphilkygqks.supabase.co` (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Netlify + local | publishable key — safe in the browser (RLS enforces access) |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify **only**, server scope | bypasses RLS; never expose to client. Currently only needed if you add server jobs. |

Supabase project: **Expat Lead Tracker** `zuoekghumuphilkygqks` (region ap-southeast-1 / Singapore).

## First-time setup

1. **Auth:** Supabase → Authentication → Providers → Email. For an internal tool, either
   turn **Confirm email** off, or confirm invitees via the emailed link.
2. **First admin:** the *first* account to sign up becomes **Admin** automatically (DB trigger
   `handle_new_auth_user`). Do this yourself before sharing the URL. Everyone after starts as
   **Read Only** — promote them in **Settings → Team access**.
3. **Team:** invite staff (they sign up), then assign roles + toggle "Is RM" in Settings.

## Deploy (Netlify)

1. New Netlify site from this repo. **Base directory:** `lead-tracker`.
2. Build command `npm run build`, publish `.next` (both preset in `netlify.toml`); the
   `@netlify/plugin-nextjs` runtime handles App Router / server actions.
3. Add the three env vars above. Deploy.
4. In Supabase → Authentication → URL Configuration, add the Netlify site URL to
   **Redirect URLs / Site URL**.

## Database changes

- Migrations live in `supabase/migrations/` (numeric order, each with a `-- DOWN` section).
- Apply via the Supabase MCP `apply_migration`, the Supabase CLI, or paste into the SQL editor.
- After schema changes: regenerate types (`npm run types:gen`) and run `npm run typecheck`.
- Run `supabase/tests/rls_tests.sql` after touching any RLS policy.

## Scheduled jobs (pg_cron, already installed)

| Job | Schedule | What |
|-----|----------|------|
| `scan-notifications` | hourly | `fn_scan_notifications()` — stale-lead + quiet-affiliate alerts, de-duped per stage-visit |
| `refresh-affiliate-stats` | every 15 min | `refresh materialized view concurrently mv_affiliate_stats` (leaderboard/dashboard rollup) |

Check them: `select * from cron.job;` and `select * from cron.job_run_details order by start_time desc limit 20;`.

## Verify a healthy deploy

- `npm run typecheck` — clean.
- `npm run test` — 33 unit tests pass (transitions, conversion, permissions, filters).
- `npm run build` — all routes compile.
- Supabase advisors: `get_advisors(security)` — only the documented, accepted exceptions
  (see `supabase/README.md`).
- Sign in → dashboard shows counts; drag a card on the pipeline; ⌘K search returns results.

## Common issues

- **Can't sign in / stuck on login:** email confirmation is on but unconfirmed — confirm the
  user in Supabase → Authentication → Users, or disable Confirm email.
- **New user sees nothing:** they're Read Only by default (correct). Promote in Settings.
- **RM sees no leads:** RM Staff only see leads *assigned to them* — assign some, or check role.
- **Leaderboard looks stale:** it reads `mv_affiliate_stats`, refreshed every 15 min. The
  "as of" is inherent; force with `refresh materialized view concurrently mv_affiliate_stats;`.
- **Commission blank for a user:** by design — only Admin/BD see `commission_pct`.
