/**
 * Regency → Drive, with a daily report
 * ------------------------------------
 * Saves every Regency document to Drive and emails a short daily summary of
 * which policies activated, so nothing reaches the CRM late.
 *
 * This exists because one did: Sharifah Scarth's policy activated on 31 Jul and
 * was only noticed by chance. The catch-up run had already happened, and no
 * trigger was installed, so nothing was watching.
 *
 * INSTALL (the trigger is the part that matters — without it nothing runs)
 *   1. script.google.com → New project, paste this in, save
 *   2. Run `backfillAll` once, approve the permission prompt
 *   3. Triggers (clock icon) → Add Trigger:
 *        function: dailyCheck
 *        event source: Time-driven
 *        type: Day timer, 7am–8am
 *   4. Optional second trigger on `saveRegencyAttachments`, Hour timer, if you
 *      want documents in Drive within the hour rather than by morning.
 *
 * Re-running is always safe: a Gmail label marks each processed thread, and
 * files are matched by name before saving.
 */

const FOLDER_NAME = 'Regency CRM Documents';
const DONE_LABEL = 'crm/saved-to-drive';
const REPORT_TO = Session.getActiveUser().getEmail();

const SEARCH = 'from:regencyforexpats.com has:attachment -label:' + DONE_LABEL;
const ACTIVATION_SUBJECT = 'Health Plan Has Been Activated';

/* ------------------------------------------------------------------ *
 * Daily entry point: save anything new, sync it to the CRM, then report.
 * ------------------------------------------------------------------ */
function dailyCheck() {
  const result = saveRegencyAttachments();
  const synced = syncActivationsToCrm(60);
  const activations = findRecentActivations(1);
  sendReport_(result, activations, synced);
}

/** Policies activated in the last `days` days, newest first. */
function findRecentActivations(days) {
  const threads = GmailApp.search(
    'from:regencyforexpats.com subject:"' + ACTIVATION_SUBJECT + '" newer_than:' + days + 'd',
    0, 50);

  const out = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      if (msg.getSubject().indexOf(ACTIVATION_SUBJECT) === -1) return;
      out.push({
        policy: extractPolicyNumber_(msg.getSubject()) || '(no policy number)',
        client: extractClientName_(msg.getPlainBody()) || '(name not found)',
        date: msg.getDate(),
      });
    });
  });
  return out;
}

function sendReport_(result, activations, synced) {
  // Stay quiet on days when nothing happened — a report that always arrives
  // stops being read. A failure is never a quiet day.
  const failures = result.failures || [];
  if (!activations.length && !result.saved && !failures.length) return;

  let body = 'Regency daily check\n\n';

  if (activations.length) {
    body += activations.length + ' policy activation(s) in the last 24 hours:\n\n';
    activations.forEach(function (a) {
      body += '  • ' + a.client + '\n';
      body += '    ' + a.policy + '\n';
      body += '    activated ' + Utilities.formatDate(a.date, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') + '\n\n';
    });
    body += 'These are waiting in the CRM dashboard under "From Regency".\n';
    body += 'Check the figures against the certificate, then press Import.\n';
    body += 'The email date is NOT the policy start date.\n\n';
  } else {
    body += 'No new activations.\n\n';
  }

  body += 'Documents saved to Drive this run: ' + result.saved + '\n';
  body += 'Already present, skipped: ' + result.skipped + '\n';
  body += 'Folder: ' + FOLDER_NAME + '\n';

  if (synced) {
    body += '\nSynced to the CRM: ' + synced.pushed + ' certificate(s) parsed';
    body += ', ' + synced.unreadable + ' unreadable.\n';
    if (synced.problems.length) {
      synced.problems.forEach(function (p) { body += '  ! ' + p + '\n'; });
    }
  }

  if (failures.length) {
    body += '\n' + failures.length + ' FILE(S) FAILED TO SAVE:\n';
    failures.forEach(function (f) { body += '  • ' + f + '\n'; });
    body += '\nThese threads were left unlabelled and will be retried on the\n';
    body += 'next run. If they keep failing, check Drive storage quota.\n';
  }

  MailApp.sendEmail({
    to: REPORT_TO,
    subject: failures.length
      ? 'Regency: ' + failures.length + ' document(s) FAILED to save'
      : activations.length
        ? 'Regency: ' + activations.length + ' new policy activation(s)'
        : 'Regency daily check',
    body: body,
  });
}

/* ------------------------------------------------------------------ *
 * Saving attachments
 * ------------------------------------------------------------------ */
function saveRegencyAttachments() {
  const folder = getOrCreateFolder_(FOLDER_NAME);
  const label = getOrCreateLabel_(DONE_LABEL);

  // Capped per run so a backlog can't hit the execution time limit; the
  // trigger works through the remainder next time.
  const threads = GmailApp.search(SEARCH, 0, 50);
  let saved = 0;
  let skipped = 0;
  const failures = [];

  threads.forEach(function (thread) {
    // The label is what stops a thread being looked at again, so it is only
    // safe to apply once every attachment is genuinely on disk. Labelling
    // first meant one transient Drive error retired the thread for good:
    // John Clayton (18 Aug) and Anthony Priestly (19 Aug) were both marked
    // saved with nothing in the folder, and nothing ever retried them.
    let threadOk = true;

    thread.getMessages().forEach(function (message) {
      message.getAttachments().forEach(function (attachment) {
        const name = attachment.getName();
        if (!isWorthSaving_(name, attachment.getContentType())) return;

        // Prefix with the policy number so files sort sensibly and can be
        // matched back to a client later.
        const policy = extractPolicyNumber_(message.getSubject());
        const filename = policy ? policy.replace(/\//g, '-') + ' - ' + name : name;

        if (folder.getFilesByName(filename).hasNext()) {
          skipped++;
          return;
        }

        try {
          folder.createFile(attachment.copyBlob()).setName(filename);
          // Trust the folder, not the return value — confirm it is really there.
          if (!folder.getFilesByName(filename).hasNext()) {
            throw new Error('file not found in folder after write');
          }
          saved++;
        } catch (e) {
          threadOk = false;
          failures.push(filename + ' — ' + e.message);
          Logger.log('FAILED %s: %s', filename, e.message);
        }
      });
    });

    if (threadOk) thread.addLabel(label);
  });

  Logger.log('Saved %s file(s), skipped %s, failed %s, across %s thread(s).',
    saved, skipped, failures.length, threads.length);
  return { saved: saved, skipped: skipped, failures: failures, threads: threads.length };
}

/**
 * Keep real documents; drop signature images and the generic brochure.
 *
 * The extension decides, not the MIME type. Somewhere between 13 and 18 Aug
 * 2026 Regency's mail system started labelling its PDFs
 * application/octet-stream, and a strict `!== 'application/pdf'` test threw
 * away three certificates without recording anything — the run still reported
 * a clean "saved 0, failed 0". A sender's Content-Type header is a hint, so
 * accept either signal.
 */
function isWorthSaving_(name, mimeType) {
  const n = (name || '').toLowerCase();
  if (n.slice(-4) !== '.pdf' && mimeType !== 'application/pdf') return false;
  if (n.indexOf('brochure') !== -1) return false;
  if (/^image\d+\./.test(n)) return false;
  return true;
}

/** "…Activated! RIH/2026/ES/34141145" → the policy number. */
function extractPolicyNumber_(subject) {
  const m = (subject || '').match(/RIH\/\d{4}\/[A-Z0-9]+\/\d+/);
  return m ? m[0] : null;
}

/** "Dear Donald Doherty," → "Donald Doherty". */
function extractClientName_(body) {
  const m = (body || '').match(/Dear\s+([^,\n]+),/);
  return m ? m[1].trim() : null;
}

function getOrCreateFolder_(name) {
  const existing = DriveApp.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : DriveApp.createFolder(name);
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/**
 * One-off catch-up across the whole history. Run manually once; the triggers
 * handle everything after that.
 */
function backfillAll() {
  const label = getOrCreateLabel_(DONE_LABEL);
  const threads = GmailApp.search('from:regencyforexpats.com has:attachment', 0, 200);
  Logger.log('Backfilling %s thread(s)…', threads.length);
  threads.forEach(function (t) { t.removeLabel(label); });
  saveRegencyAttachments();
}

/**
 * Un-retire recent threads so the next run picks them up again. Use this when
 * a thread was labelled as saved but its documents are not in the folder —
 * lighter than backfillAll, which re-checks the entire history.
 */
function retryRecent(days) {
  const label = getOrCreateLabel_(DONE_LABEL);
  const threads = GmailApp.search(
    'from:regencyforexpats.com has:attachment newer_than:' + (days || 30) + 'd', 0, 100);
  threads.forEach(function (t) { t.removeLabel(label); });
  Logger.log('Cleared the label on %s thread(s); re-saving now…', threads.length);
  const result = saveRegencyAttachments();
  Logger.log('Saved %s, skipped %s, failed %s.',
    result.saved, result.skipped, (result.failures || []).length);
  return result;
}

/* ------------------------------------------------------------------ *
 * Sync to the CRM
 *
 * Reads each Certificate of Insurance and pushes what it says into the
 * inbound_activations table, where a person reviews it before importing.
 * Nothing here creates a client — Regency's figures have needed correcting
 * before, so the parse is always shown before it becomes money.
 *
 * SETUP (once):
 *   1. Services (+) → Drive API → Add. Needed to read text out of a PDF;
 *      Apps Script cannot do it without the advanced service.
 *   2. Project Settings → Script Properties, add:
 *        SUPABASE_URL          https://ywhlsbwmwvddzxvixusf.supabase.co
 *        SUPABASE_SERVICE_KEY  (Supabase → Settings → API → service_role)
 *      The service key bypasses row-level security, so it belongs in Script
 *      Properties and nowhere else — never in this file, never in the repo.
 * ------------------------------------------------------------------ */

/** @return {{pushed:number, unreadable:number, problems:string[]}} */
function syncActivationsToCrm(days) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!url || !key) {
    Logger.log('SUPABASE_URL / SUPABASE_SERVICE_KEY not set — skipping CRM sync.');
    return { pushed: 0, unreadable: 0, problems: ['Supabase credentials not configured'] };
  }

  const folder = getOrCreateFolder_(FOLDER_NAME);
  const threads = GmailApp.search(
    'from:regencyforexpats.com subject:"' + ACTIVATION_SUBJECT + '" newer_than:' + (days || 60) + 'd',
    0, 50);

  const rows = [];
  const problems = [];
  let unreadable = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const policy = extractPolicyNumber_(msg.getSubject());
      if (!policy) return;

      // The certificate was filed under "<policy with dashes> - Certificate…".
      const prefix = policy.replace(/\//g, '-') + ' - Certificate';
      let file = null;
      const it = folder.getFiles();
      while (it.hasNext()) {
        const f = it.next();
        if (f.getName().indexOf(prefix) === 0) { file = f; break; }
      }
      if (!file) {
        unreadable++;
        problems.push(policy + ': certificate not in Drive yet');
        return;
      }

      let text;
      try {
        text = pdfToText_(file);
      } catch (e) {
        unreadable++;
        problems.push(policy + ': could not read the PDF (' + e.message + ')');
        return;
      }

      const parsed = parseCertificate_(text);
      if (parsed.warnings.length) {
        problems.push(policy + ': ' + parsed.warnings.join('; '));
      }

      rows.push({
        policy_number: policy,
        client_name: parsed.client || extractClientName_(msg.getPlainBody()),
        plan_name: parsed.plan,
        commencement_date: parsed.commencement,
        premium: parsed.premium,
        currency: 'USD',
        frequency: parsed.frequency,
        // The activation email is the evidence the premium was paid.
        email_date: Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
        source_file_id: file.getId(),
        raw_text: text.slice(0, 8000),
        parse_warnings: parsed.warnings,
      });
    });
  });

  if (!rows.length) {
    Logger.log('Nothing to sync.');
    return { pushed: 0, unreadable: unreadable, problems: problems };
  }

  // merge-duplicates upserts on the policy_number unique key, so re-running is
  // safe. ignore_duplicates would leave a corrected parse unapplied.
  const res = UrlFetchApp.fetch(url + '/rest/v1/inbound_activations?on_conflict=policy_number', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code >= 300) {
    // A row already imported must never be dragged back to 'new', so the
    // upsert deliberately does not send `status`. A failure here is loud.
    throw new Error('Supabase rejected the sync (' + code + '): ' + res.getContentText());
  }

  Logger.log('Synced %s certificate(s) to the CRM; %s unreadable.', rows.length, unreadable);
  return { pushed: rows.length, unreadable: unreadable, problems: problems };
}

/**
 * Text out of a PDF, via a throwaway Google Doc conversion — the only way
 * Apps Script can read one. Requires the Drive advanced service.
 */
function pdfToText_(file) {
  const doc = Drive.Files.insert(
    { title: 'tmp-parse-' + file.getId(), mimeType: 'application/vnd.google-apps.document' },
    file.getBlob(),
    { convert: true });
  try {
    return DocumentApp.openById(doc.id).getBody().getText();
  } finally {
    Drive.Files.remove(doc.id);   // never leave scratch files in Drive
  }
}

/** Pull the fields the CRM needs out of a Certificate of Insurance. */
function parseCertificate_(text) {
  const warnings = [];
  const t = String(text || '').replace(/ /g, ' ');

  function grab(re, label) {
    const m = t.match(re);
    if (!m) { warnings.push('no ' + label); return null; }
    return m[1].trim();
  }

  const plan = grab(/Plan Name:\s*(.+)/, 'plan name');
  const client = grab(/(.+?)\s*\(Main Point of Contact\)/, 'policyholder name');
  const rawDate = grab(/Commencement Date:\s*(\d{1,2}\s+\w{3,}\s+\d{4})/, 'commencement date');
  const rawFreq = grab(/Payment Frequency:\s*([A-Za-z-]+)/, 'payment frequency');
  const rawPrem = grab(/TOTAL PREMIUM:\s*US\$?\s*([\d,]+\.\d{2})/, 'total premium');

  return {
    plan: plan,
    client: client,
    commencement: rawDate ? isoDate_(rawDate) : null,
    frequency: rawFreq ? frequencyCode_(rawFreq) : null,
    premium: rawPrem ? Number(rawPrem.replace(/,/g, '')) : null,
    warnings: warnings,
  };
}

/** "25 Aug 2026" → "2026-08-25". */
function isoDate_(s) {
  const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                   jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const m = s.match(/(\d{1,2})\s+(\w{3})\w*\s+(\d{4})/);
  if (!m) return null;
  const mi = months[m[2].toLowerCase()];
  if (mi === undefined) return null;
  return Utilities.formatDate(new Date(Number(m[3]), mi, Number(m[1])),
    Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** "Annually" → "annual", matching the pay_frequency enum. */
function frequencyCode_(s) {
  const n = s.toLowerCase();
  if (n.indexOf('month') === 0) return 'monthly';
  if (n.indexOf('quarter') === 0) return 'quarterly';
  if (n.indexOf('semi') === 0) return 'semi_annual';
  if (n.indexOf('annual') === 0 || n.indexOf('year') === 0) return 'annual';
  return null;
}

/** Sync on demand, further back than the daily run looks. */
function syncNow() {
  const r = syncActivationsToCrm(180);
  Logger.log('Pushed %s, unreadable %s.', r.pushed, r.unreadable);
  r.problems.forEach(function (p) { Logger.log('  ! %s', p); });
  return r;
}

/**
 * Diagnostic: show exactly what Gmail reports for each recent activation.
 *
 * On 27 Aug a run logged "saved 0, skipped 6, failed 0" while three
 * certificates were plainly missing. Zero failures means those attachments
 * never reached the save step, so the filter dropped them — most likely on
 * content type. This prints the raw name, type and size so the filter can be
 * matched to reality instead of guessed at.
 */
function debugAttachments() {
  const threads = GmailApp.search(
    'from:regencyforexpats.com subject:"' + ACTIVATION_SUBJECT + '" newer_than:20d', 0, 10);
  Logger.log('Found %s thread(s)', threads.length);

  threads.forEach(function (t) {
    t.getMessages().forEach(function (m) {
      const atts = m.getAttachments();
      Logger.log('--- %s | %s attachment(s)', m.getSubject(), atts.length);
      atts.forEach(function (a) {
        Logger.log('    "%s" | type=%s | %s bytes | worthSaving=%s',
          a.getName(), a.getContentType(), a.getSize(),
          isWorthSaving_(a.getName(), a.getContentType()));
      });
    });
  });
}

/** Check the last 30 days and report — useful to confirm nothing was missed. */
function reportLast30Days() {
  const activations = findRecentActivations(30);
  Logger.log('%s activation(s) in the last 30 days:', activations.length);
  activations.forEach(function (a) {
    Logger.log('  %s — %s (%s)', a.client, a.policy,
      Utilities.formatDate(a.date, Session.getScriptTimeZone(), 'dd MMM yyyy'));
  });
  return activations;
}
