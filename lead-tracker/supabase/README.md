# Database — Expat Lead Tracker

Supabase project **`zuoekghumuphilkygqks`** ("Expat Lead Tracker"), region `ap-southeast-1` (Singapore).
Separate from the Commission CRM project by design (different RLS models, cross-border PII).

## Apply order

Run migrations in numeric order, then the production seed:

| # | File | What it does |
|---|------|--------------|
| 01 | `migrations/01_extensions_enums.sql` | `pg_trgm`, `citext`, `pg_cron`; all enum types |
| 02 | `migrations/02_core_tables.sql` | users, permission matrix, lookups, affiliates, imports, **leads** |
| 03 | `migrations/03_support_tables.sql` | history, audit, activity, comments, documents, tags, filters, pins, notifications |
| 04 | `migrations/04_functions_triggers.sql` | authz helpers, transition matrix, append-only history, audit diff, notify, anonymise |
| 05 | `migrations/05_rls_policies.sql` | RLS on every table (RM = own leads), soft-delete guard |
| 06 | `migrations/06_views_cron_storage.sql` | commission hiding, analytics views, matview, `pg_cron`, Storage bucket |
| 09 | `migrations/09_security_hardening.sql` | advisor fixes (see below) |
| — | `seed.sql` | permission matrix, insurance types, notification rules, tags (idempotent) |
| — | `seed_dev.sql` | **dev only** demo affiliates + leads |

> Migrations 07/08 were the seed and a hot-fix applied during development and are folded into
> `seed.sql` and `04_functions_triggers.sql` respectively; the numeric gap is intentional.

Migrations were applied to the remote project via the Supabase MCP `apply_migration`. Each file
carries a commented `-- DOWN` section for reversibility.

## Design decisions enforced in the DB (not just the app)

- **RM Staff see only their own assigned leads** — `perm_scope('leads','read') = 'own'` in
  `role_permissions`, enforced by the `leads_select` RLS policy and `owns_lead()` for history/audit.
- **Permission matrix is the source of truth** — RLS reads `role_permissions` via `has_perm()`/
  `perm_scope()`. Changing a permission is an `UPDATE`, not a migration.
- **Transition matrix + milestone dates** live in `leads_before_update()`; illegal moves raise,
  backward corrections are Admin/BD-only + reason-required and clear the undone stage's date.
- **History and audit are immutable** — `REVOKE UPDATE/DELETE`; only `SECURITY DEFINER` triggers write.
- **`lost_reason` is mandatory on Lost** — DB `CHECK` constraints, not just form validation.
- **Commission % is hidden** from RM/Read-Only — column revoked from `authenticated`, re-exposed to
  Admin/BD through the guarded `v_affiliate_commission` view.

## Accepted advisor exceptions (reviewed, intentional)

- `security_definer_view` on **`v_affiliate_commission`** — this *is* the commission-hiding
  mechanism; it reads the revoked column and gates it with `has_perm('affiliates','update')`.
- `extension_in_public` for **`citext` / `pg_trgm`** — `citext` backs live columns; relocating
  post-hoc risks breaking column types for no real security gain.
- `materialized_view_in_api` on **`mv_affiliate_stats`** — the leaderboard rollup; aggregate only,
  no PII, readable by `authenticated` on purpose (anon access was revoked).
- `*_security_definer_function_executable` on the authz helpers — they only reveal the *caller's own*
  role/permissions; `anonymize_lead` is admin-guarded internally. `anon` execute was revoked.

## Cron jobs

- `scan-notifications` — hourly `fn_scan_notifications()` (stale-lead + quiet-affiliate alerts,
  de-duplicated per stage-visit).
- `refresh-affiliate-stats` — `refresh materialized view concurrently mv_affiliate_stats` every 15 min.
