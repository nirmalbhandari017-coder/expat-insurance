/**
 * Save Regency attachments to Drive
 * ---------------------------------
 * Gmail has no built-in "save attachments to Drive" filter action, so this
 * runs inside the Workspace account on a timer and does it.
 *
 * It is deliberately the first half of the CRM sync: once the certificates are
 * in Drive they can be parsed for premium, payment frequency and policy start
 * date. Getting the files somewhere readable is the only hard prerequisite.
 *
 * INSTALL
 *   1. script.google.com -> New project, paste this in
 *   2. Run `saveRegencyAttachments` once and approve the permission prompt
 *      (it is your own account, so no Cloud project or verification needed)
 *   3. Triggers (clock icon) -> Add Trigger -> saveRegencyAttachments,
 *      Time-driven, Hour timer, every hour
 *
 * The label is what makes it safe to re-run: a thread is only ever processed
 * once, so a second run costs nothing and cannot duplicate anything.
 */

const FOLDER_NAME = 'Regency CRM Documents';
const DONE_LABEL = 'crm/saved-to-drive';

// Only mail that actually carries client documents. Adjust if Regency add
// another sender or subject line.
const SEARCH = 'from:regencyforexpats.com has:attachment -label:' + DONE_LABEL;

function saveRegencyAttachments() {
  const folder = getOrCreateFolder_(FOLDER_NAME);
  const label = getOrCreateLabel_(DONE_LABEL);

  // Cap per run so a large backlog can't hit the execution time limit; the
  // hourly trigger simply works through the rest.
  const threads = GmailApp.search(SEARCH, 0, 50);
  if (!threads.length) {
    Logger.log('Nothing new to save.');
    return;
  }

  let saved = 0;
  let skipped = 0;

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (message) {
      message.getAttachments().forEach(function (attachment) {
        const name = attachment.getName();

        // Signature logos and the generic brochure are not documents worth keeping.
        if (!isWorthSaving_(name, attachment.getContentType())) return;

        // Prefix with the policy number where we can find one, so the files
        // sort sensibly and can be matched back to a client later.
        const policy = extractPolicyNumber_(message.getSubject());
        const filename = policy
          ? policy.replace(/\//g, '-') + ' — ' + name
          : name;

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

  Logger.log('Saved %s file(s), skipped %s already present, across %s thread(s).',
             saved, skipped, threads.length);
}

/** Keep real documents; drop embedded signature images and marketing PDFs. */
function isWorthSaving_(name, mimeType) {
  if (mimeType !== 'application/pdf') return false;
  const n = name.toLowerCase();
  if (n.indexOf('brochure') !== -1) return false;   // generic marketing
  if (/^image\d+\./.test(n)) return false;          // signature images
  return true;
}

/** "Your Health Plan Has Been Activated! RIH/2026/ES/34141145" -> policy number. */
function extractPolicyNumber_(subject) {
  const m = (subject || '').match(/RIH\/\d{4}\/[A-Z0-9]+\/\d+/);
  return m ? m[0] : null;
}

function getOrCreateFolder_(name) {
  const existing = DriveApp.getFoldersByName(name);
  return existing.hasNext() ? existing.next() : DriveApp.createFolder(name);
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/**
 * One-off: process the whole history rather than only new mail. Run this once
 * manually to catch up, then let the hourly trigger handle everything after.
 */
function backfillAll() {
  const label = getOrCreateLabel_(DONE_LABEL);
  const threads = GmailApp.search('from:regencyforexpats.com has:attachment', 0, 200);
  Logger.log('Backfilling %s thread(s)…', threads.length);
  threads.forEach(function (t) { t.removeLabel(label); });
  saveRegencyAttachments();
}
