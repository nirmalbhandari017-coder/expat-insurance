# Client import log — Regency activation emails

Running log of clients imported from Regency activation emails / certificates,
so the source of every figure is traceable later.

## 2026-08-03 — Sharifah Scarth

- **Trigger:** first activation caught automatically by the `dailyCheck` Apps
  Script (see `automation/save-regency-attachments.gs`), after the daily
  trigger was installed. Previous 7 clients were found by manual search after
  one activation (Sharifah, initially) was missed — the backfill had already
  run and no trigger existed yet.
- **Policy:** RIH/2026/ES20/96694542, Essential with 20% Co-insurance.
- **From Certificate of Insurance:** commencement 01 Aug 2026, premium
  US$2,016.83, Annually. (Activation email was dated 31 Jul — one day before
  the real commencement date, consistent with every other client so far: the
  email date is never the policy start date.)
- Schedule generated, commission due 15 Sep 2026: $756.31.

### Bug found and fixed while adding this client

Generating Sharifah's commissions collided with Brett Wilson's existing row on
`(client_id, due_date)`. Root cause: an earlier correction
(`UPDATE premium_payments SET received_date = ... WHERE client_id = ...`,
30 Jul) matched **every** instalment belonging to Brett Wilson, not only the
one instalment that was actually paid. That silently marked his 2027 renewal
(instalment 2) as received on 30 Jun 2026 as well, which produced two
commission rows resolving to the same due date.

Fixed: instalment 2's `received_date`/`amount_received` reset to null/0, with
the change recorded in `financial_audit`. Swept every other client for the
same status/received_date mismatch — none found.

**Lesson for future corrections:** always scope premium_payment updates to a
specific `installment_no`, never just `client_id`, when a client can have more
than one instalment.
