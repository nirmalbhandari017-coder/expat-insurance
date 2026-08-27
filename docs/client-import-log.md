# Client import log — Regency activation emails

## 2026-08-27 — Ali Gueler, and three activations still missing

Four activations arrived between 13 and 27 Aug; none had been entered,
because the Apps Script only files documents and emails a digest — it never
writes to the CRM. That last step is manual and had not been run since 3 Aug.

- **Entered:** Ali Gueler, RIH/2026/FC/87386545, Fully Comprehensive.
  Commencement 15 Aug 2026, premium US$6,631.66, Annually (family of three:
  Ali, partner Dora Bereczky, child Dilara). Activation email 13 Aug, so
  received_date 13 Aug; commission $2,486.87 due 15 Sep 2026. Owner split
  $1,243.44 / $1,243.43 — balances to the cent.
- **Also entered, once the filter bug below was fixed:**
  - **John Clayton**, RIH/2026/ES20/20188966, Essential with 20% Co-insurance.
    Commencement **01 Nov 2026** — two and a half months after the 18 Aug
    activation email, the widest gap seen so far. Premium US$1,683.64,
    Annually. Commission $631.37 due 15 Sep 2026.
  - **Anthony Priestly**, RIH/2026/MM/60859403, Major Medical. Commencement
    20 Aug 2026, premium US$4,562.00 **Quarterly** — the first quarterly
    client. Only instalment 1 ($1,140.50) is paid; commission $427.69 per
    quarter, first due 15 Sep 2026.
  - **Alain Roland Pons**, RIH/2026/ES/85706695, Essential. Commencement
    25 Aug 2026, premium US$1,504.41, Annually. Commission $564.15 due
    15 Sep 2026.

  All commission rates were set to the standard 37.5%. See the rate query
  below — this needs confirming against the next statement.

### Commission rates are not uniform

The Aug-2026 statement (addressed to **Leadlyfe Marketing**, where Jul-2026
was addressed to **Expat Protect Hub**) pays two clients at rates the CRM does
not hold:

| Client | Statement | CRM | Statement pays | CRM expects |
|---|---|---|---|---|
| Sharifah Scarth | 25.5% | 37.5% | $514.29 | $756.31 |
| Andrea Stapley | 28.5% | 37.5% | $2,367.69 | $3,115.38 |

The other five match to the cent at 37.5%. Plan type does not explain it —
Sharifah and Julie Raxworthy both hold ES20 policies and are paid 25.5% and
37.5% respectively. Left unchanged pending confirmation from Regency; if the
statement is right, the CRM overstates expected commission by $989.71 and the
owner splits for those two clients are correspondingly overstated.

### Two bugs found

**1. The script labels a thread before confirming the save.**
`thread.addLabel(label)` ran unconditionally after the attachment loop, and
`SEARCH` excludes `-label:crm/saved-to-drive`. So a thread that failed to save
was still retired permanently. Clayton and Priestly both carry the label with
nothing in the folder — a silent, unrecoverable miss. Fixed: the label is now
applied only when every attachment is confirmed present in the folder, failures
are reported in the daily email, and `retryRecent(days)` clears the label so a
failed thread gets another go.

**2. `record_premium_payment` cannot pay owners before the commission exists.**
`distributable_profit` reads the commission row via `premium_payment_id`. When a
brand-new client is created, the premium is recorded *before*
`generate_due_commissions` has run, so the pot is 0 and
`generate_owner_payouts` returns without writing anything — silently.

**Order for a new client:** insert → `generate_premium_schedule` →
`record_premium_payment` → `generate_due_commissions` →
**`generate_owner_payouts` again**. Skipping that last call leaves the client
with a commission and no payouts, which looks correct on the Commissions page
and wrong on the Payouts page.

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
