# Roadmap — Expat Lead Tracker

What's built, and what the schema was deliberately shaped to accept without destructive migration.

## Shipped (Phases 1–5)

- **Schema & security:** 11 migrations, 7-stage pipeline enforced by a transition-matrix trigger,
  immutable status history + audit, RLS on every table reading the `role_permissions` matrix,
  materialized affiliate rollup, `pg_cron` notifications, Storage for documents, GDPR anonymise.
- **Backend:** Supabase auth + first-admin bootstrap, server actions (leads CRUD, atomic status
  changes, bulk ops, assignment, CSV import validate/commit, CSV/Excel export with PII gating,
  comments, documents, filters, notifications, admin). Shared Zod schemas + pure domain logic.
- **UI:** pipeline (Kanban + dense table + URL filters + bulk + new-lead + status flows), lead
  detail (timeline, comments, documents, edit), affiliates list + per-affiliate dashboard,
  analytics (funnel, monthly trend, leaderboards), reports + exports, import wizard, ⌘K search,
  notifications, settings (team roles + notification thresholds), dark/light.
- **Tests:** 33 unit tests (transitions, conversion, permissions, filters); live RLS integration
  test (`supabase/tests/rls_tests.sql`); Playwright smoke + authed E2E scaffolding (`e2e/`).

## Near-term polish

- Keyset pagination on the table view (current cap 500 rows/filter; kanban caps 50/column).
- Saved filters + pinned affiliates surfaced in the pipeline UI (backend + tables already exist).
- Bulk backward-correction is intentionally disabled; revisit if needed.
- Email/WhatsApp delivery of notifications (Edge Function + Resend) — `notifications` table is
  already channel-agnostic.

## Future — schema is ready (no destructive migration required)

| Capability | Hook already in place |
|---|---|
| Revenue & commission tracking | `affiliates.commission_pct`; add `commission_events(lead_id, affiliate_id, amount, currency)` |
| Insurance **product catalogue** | `insurance_types` table (leads already FK it) → add `products` referencing it |
| Renewals | add `policies(lead_id, renews_at, …)`; `payment_date`/`policy_number` already captured |
| Tasks / reminders | new `tasks(lead_id, assignee, due_at)`; activity feed already generalised |
| Public **API / webhooks** intake | `leads.source_channel` enum includes `api`; `import_jobs` generalises to any ingest |
| Automation rules | `notification_rules` is condition/threshold/channel-driven — extend into a rules engine |
| Affiliate self-service portal | `affiliates.external_ref` placeholder for portal linking |
| Multi-tenant | all UUID PKs; RLS funnels through `current_app_user_id()` / `has_perm()` — adding a
  `tenant_id` column + composite policy touches ~2 helper functions, not 40 policies |

## Expensive-to-reverse decisions (locked intentionally)

- Pipeline as a fixed **enum + transition matrix** (a product invariant), not a config table.
- Append-only `lead_status_history` as the analytics source of truth.
- Permission matrix **in the database** as the single authz source (UI mirrors it).
