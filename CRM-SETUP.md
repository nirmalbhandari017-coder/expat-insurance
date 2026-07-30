# Commission CRM — Setup Guide

The CRM lives at **expatprotecthub.com/crm** once deployed. Source is in `expatprotecthub-crm/`,
the database schema is in `supabase/schema.sql`, and Netlify builds it automatically
on every deploy.

## One-time setup (about 10 minutes)

### 1. Create the Supabase project
1. Go to [supabase.com](https://supabase.com) → sign up (free tier is plenty for this scale).
2. Create a new project (any name, e.g. `expatprotecthub-crm`). Pick the Singapore region for Thailand latency.
3. Wait ~2 minutes for the project to provision.

### 2. Install the database
1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.
   - This creates all tables, the role-based security rules, the payout trigger, and the
     commission auto-generation logic. Safe to re-run if needed.

### 3. Connect the app
1. In Supabase: **Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In **Netlify** (site settings → Environment variables), add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon key
3. For local development, copy `expatprotecthub-crm/.env.example` to `expatprotecthub-crm/.env` and fill in the same two values.
4. Trigger a new Netlify deploy (or push any commit).

> The anon key is designed to be public — every data-access rule is enforced inside the
> database by row-level security, so a consultant hitting the API directly still only
> sees their own records.

### 4. Create your admin account
1. Open `expatprotecthub.com/crm` and click **Sign up**.
2. **The first account to sign up automatically becomes the admin** — so do this yourself
   before sharing the link.
3. Every later signup starts as an unlinked consultant with **zero access** until you
   assign a role in **Settings → Team access**.

## Daily use

| Who | What they do |
|---|---|
| **Admin** | Add clients (with commission % and payment frequency), add consultants, set tax rates, everything below |
| **Bookkeeper** | Mark commissions received, mark payouts paid, log expenses |
| **Consultant** | Sees only their own deals, share %, and payout history at the same URL |

- **Commission records generate themselves** from each client's start date + frequency
  (60 days ahead), and flip to *overdue* automatically when the due date passes.
- **Marking a commission received** auto-creates the consultant payout(s) — gross,
  withholding tax, and net — and snapshots the company tax reserve.
- **Recurring expenses** create a draft each month that you confirm or edit.
- **Reports** show P&L (income − payouts − tax reserve − expenses) and a 90-day cash-flow
  forecast, per currency (USD and THB are tracked separately, no FX conversion).

## Adding team members later
Send them to `/crm`, have them sign up, then in **Settings → Team access** set their role.
For consultants, also link their login to their consultant record — that link is what
scopes their view to their own numbers.
