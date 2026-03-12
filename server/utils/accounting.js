'use strict';
const { db, originalPrepare } = require('../database');

/**
 * createJournalEntry({ entry_date, reference_type, reference_id, description, lines })
 * lines: [{ account_code, debit, credit }]
 * Rules:
 *   - total debit must equal total credit (tolerance 0.001)
 *   - entry_number auto-incremented as JE-000001, JE-000002 ...
 *   - wrapped in a transaction
 *   - throws on imbalance
 */
function createJournalEntry({ entry_date, reference_type, reference_id, description, lines, company_id, branch_id }) {
  if (!lines || lines.length === 0) throw new Error('Journal entry must have at least one line');

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal imbalance: debit ${totalDebit.toFixed(4)} ≠ credit ${totalCredit.toFixed(4)}`);
  }

  const cid = company_id || 1;

  const doCreate = db.transaction(() => {
    // Auto-increment entry_number from the last existing entry (scoped to company)
    const last = db.prepare(
      "SELECT entry_number FROM journal_entries WHERE company_id = ? ORDER BY id DESC LIMIT 1"
    ).get(cid);
    let nextNum = 1;
    if (last) {
      const m = (last.entry_number || '').match(/JE-(\d+)$/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    const entry_number = `JE-${String(nextNum).padStart(6, '0')}`;

    const entryResult = db.prepare(`
      INSERT INTO journal_entries (entry_number, entry_date, reference_type, reference_id, description, branch_id, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry_number, entry_date, reference_type || null, reference_id || null, description || null, branch_id || null, cid);

    const entryId = entryResult.lastInsertRowid;

    const insertLine = db.prepare(`
      INSERT INTO journal_lines (journal_entry_id, account_code, debit, credit, company_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    lines.forEach(line => {
      insertLine.run(
        entryId,
        line.account_code,
        parseFloat(line.debit)  || 0,
        parseFloat(line.credit) || 0,
        cid
      );
    });

    return { id: entryId, entry_number };
  });

  return doCreate();
}

// ============================================
// ACCOUNTING ENGINE: Idempotent journal posting
// ============================================
/**
 * postJournal() — creates a journal entry only if one does not already exist
 * for the given reference_type + reference_id + company_id.
 * Filters out zero-amount lines automatically.
 * Returns existing entry if duplicate, new entry if created, null if no valid lines.
 */
function postJournal({ entry_date, reference_type, reference_id, description, lines, company_id }) {
  const cid = company_id || 1;
  // Idempotency: skip if entry already exists for this reference
  const existing = originalPrepare(
    'SELECT id, entry_number FROM journal_entries WHERE reference_type = ? AND reference_id = ? AND company_id = ?'
  ).get(reference_type, reference_id, cid);
  if (existing) return existing;

  // Filter out zero-amount lines
  const nonZero = lines.filter(l => (parseFloat(l.debit) || 0) > 0.001 || (parseFloat(l.credit) || 0) > 0.001);
  if (nonZero.length < 2) return null; // Need at least debit + credit sides

  return createJournalEntry({ entry_date, reference_type, reference_id, description, lines: nonZero, company_id: cid });
}

// ============================================
// ERP-v7: JOURNAL ENTRY HELPER — ISOLATION-SAFE
// Extends createJournalEntry with company_id + branch_id in every SQL statement.
// This version satisfies the multi-company isolation guard.
// Use this for all new (v7+) accounting entries.
// ============================================
function createJournalEntryV7({ entry_date, reference_type, reference_id, description, branch_id, company_id, lines }) {
  if (!lines || lines.length === 0) throw new Error('Journal entry must have at least one line');

  const totalDebit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`Journal imbalance: debit ${totalDebit.toFixed(4)} ≠ credit ${totalCredit.toFixed(4)}`);
  }

  const cid = company_id || 1;

  return db.transaction(() => {
    // Company-scoped sequence to avoid collisions between tenants
    const last = db.prepare(
      `SELECT entry_number FROM journal_entries WHERE company_id = ? ORDER BY id DESC LIMIT 1`
    ).get(cid);
    let nextNum = 1;
    if (last && last.entry_number) {
      const m = last.entry_number.match(/JE-(\d+)$/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    const entry_number = `JE-${String(nextNum).padStart(6, '0')}`;

    const entryResult = db.prepare(`
      INSERT INTO journal_entries
        (entry_number, entry_date, reference_type, reference_id, description, branch_id, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry_number,
      entry_date,
      reference_type || null,
      reference_id   || null,
      description    || null,
      branch_id      || null,
      cid
    );
    const entryId = entryResult.lastInsertRowid;

    const insertLine = db.prepare(`
      INSERT INTO journal_lines (journal_entry_id, account_code, debit, credit, company_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const line of lines) {
      insertLine.run(
        entryId,
        line.account_code,
        parseFloat(line.debit)  || 0,
        parseFloat(line.credit) || 0,
        cid
      );
    }

    return { id: entryId, entry_number };
  })();
}

module.exports = { createJournalEntry, postJournal, createJournalEntryV7 };
