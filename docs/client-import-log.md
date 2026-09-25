# Client import log — Regency activation emails

## 2026-09-24 — the sync runs, and eight clients arrive at once

The automation built on 27 Aug had never actually run: the Supabase credentials
were never added to Script Properties, and `syncActivationsToCrm` returned
quietly when they were missing, which looked exactly like a quiet day. Eight
activations reached Drive over four weeks and none reached the CRM.

Now fixed and verified end to end — Gmail → Drive → parsed → CRM. Imported:
Jared Legere, Agim Isufaj, Kylie Sharp, Alfred Weisser, Allan Ju, Charlie
Lambe, David Segal and Preeti Singh. Every premium, commencement date and
frequency was checked against the certificate text stored in `raw_text`;
all eight matched exactly. **20 clients total.**

### Three bugs, all found by the setup check rather than in production

1. **Enabling the Drive advanced service was a silent single point of failure.**
   `pdfToText_` now calls the Drive REST API with the token DriveApp already
   holds, so there is no editor switch to forget.
2. **A dead sync looked like a quiet day.** The digest now leads with a banner
   and the subject reads `THE CRM SYNC IS NOT RUNNING`.
3. **The policyholder name parsed as the literal string "Policyholder:".**
   Converting the PDF through Google Docs does not preserve the certificate's
   layout, so the text before "(Main Point of Contact)" was sometimes the label
   rather than the name. Running the sync would have created eight clients all
   called `Policyholder:`. The name now comes from `Dear <name>,` in the
   activation email, which survives the conversion; the certificate is the
   fallback. Caught by `checkSetup` before any data was written.

### Sep-2026 statement (Jay Woodard) — two more rate corrections

Regency renamed the broker account again: Jul was *Expat Protect Hub*, Aug
*Leadlyfe Marketing*, Sep *Jay Woodard*. Confirmed by the user as an account
rename, not separate entities.

| Client | Statement | CRM had | Corrected to |
|---|---|---|---|
| Ali Gueler | 32.5% → $2,155.29 | 37.5% → $2,486.87 | **32.5%** |
| Agim Isufaj | 29.5% → $1,175.24 | 37.5% → $1,493.96 | **29.5%** |

All five clients on the statement now reconcile to the cent, totalling
$4,664.49. That is **four clients** whose real rate was not 37.5% (with
Sharifah Scarth 25.5% and Andrea Stapley 28.5%), so the default is wrong more
often than it is right — every newly imported client should be treated as
provisional until a statement covers it.

### John Clayton — removed, not a client for now

He paid on 18 Aug, and the other five August payments are all on the Sep-2026
statement. His $631.37 was not. On the user's instruction he was removed rather
than chased: **cancelled, not deleted**, so the record survives if Regency
settles him later.

- `clients.status` → cancelled
- both `premium_payments` → cancelled
- the commission row **deleted** — `commission_status` has no cancelled value,
  and deleting it cascade-deleted his two unpaid payouts along with it
- his `inbound_activations` row → `ignored`, which keeps him out of the import
  panel. **Flip that row back to `new` to reinstate him**, rather than
  re-importing from Gmail: the sync upserts on policy number and deliberately
  never sends `status`, so a synced row will not resurrect itself.

Nothing had settled — no commission received, no payout paid — so no money
moved. Six `financial_audit` rows record the change.

19 active clients.

### 2026-09-25 — reconciled field by field against the Sep-2026 statement

Every column compared, not just the rates: policy number, frequency, rate,
premium received, payment date and commission amount. Two payment dates were
a day out — **Ali Gueler 13 → 12 Aug** and **Alain Roland Pons 27 → 26 Aug** —
because the CRM had been using the activation email date as a proxy for when
the premium was paid. The statement shows the real date, and the email is
consistently the day *after*.

Both corrected, with the payout due dates moved with them. Neither shifts the
commission due month (both stay August → 15 Sep), so no knock-on. Updates were
scoped to `installment_no = 1`, per the lesson at the foot of this file.

**All five rows now match the statement on every field, totalling $4,664.49.**

Note the parser cannot do better than the email date on its own — the real
payment date is only ever known once a statement arrives. Treat an imported
payment date as approximate until reconciled.

All five commissions currently read **overdue** (due 15 Sep, unpaid in the
CRM). If Regency has settled this statement they should be marked received;
that has not been done, because marking a commission received generates the
payouts and it was wrong once before (Andrea Stapley, reverted on instruction).

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
37.5% respectively.

**Corrected on the user's instruction, 27 Aug 2026.** Both rates now match the
statement; expected commission fell $989.71 and the owner splits were
regenerated on the smaller pots (no payout had been marked paid, so nothing
already settled was rewritten). Two `financial_audit` rows per client record
the rate change and the restated commission amount.

All seven clients on the Aug-2026 statement now reconcile to the cent against
the CRM, totalling $5,579.46.

**Rates are per client, not per plan, and the CRM has no way to know one until
a statement arrives.** New clients are entered at 37.5% by default, so Ali
Gueler, John Clayton, Anthony Priestly and Alain Roland Pons all need checking
against the Sep-2026 statement.

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
