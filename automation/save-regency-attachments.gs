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
 * Daily entry point: save anything new, then report what activated.
 * ------------------------------------------------------------------ */
function dailyCheck() {
  const result = saveRegencyAttachments();
  const activations = findRecentActivations(1);
  sendReport_(result, activations);
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

function sendReport_(result, activations) {
  // Stay quiet on days when nothing happened — a report that always arrives
  // stops being read.
  if (!activations.length && !result.saved) return;

  let body = 'Regency daily check\n\n';

  if (activations.length) {
    body += activations.length + ' policy activation(s) in the last 24 hours:\n\n';
    activations.forEach(function (a) {
      body += '  • ' + a.client + '\n';
      body += '    ' + a.policy + '\n';
      body += '    activated ' + Utilities.formatDate(a.date, Session.getScriptTimeZone(), 'dd MMM yyyy HH:mm') + '\n\n';
    });
    body += 'ACTION: add these to the CRM, then take the premium, payment\n';
    body += 'frequency and commencement date from the Certificate of Insurance.\n';
    body += 'The email date is NOT the policy start date.\n\n';
  } else {
    body += 'No new activations.\n\n';
  }

  body += 'Documents saved to Drive this run: ' + result.saved + '\n';
  body += 'Already present, skipped: ' + result.skipped + '\n';
  body += 'Folder: ' + FOLDER_NAME + '\n';

  MailApp.sendEmail({
    to: REPORT_TO,
    subject: activations.length
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

  threads.forEach(function (thread) {
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
        folder.createFile(attachment.copyBlob()).setName(filename);
        saved++;
      });
    });
    thread.addLabel(label);
  });

  Logger.log('Saved %s file(s), skipped %s, across %s thread(s).', saved, skipped, threads.length);
  return { saved: saved, skipped: skipped, threads: threads.length };
}

/** Keep real documents; drop signature images and the generic brochure. */
function isWorthSaving_(name, mimeType) {
  if (mimeType !== 'application/pdf') return false;
  const n = name.toLowerCase();
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
