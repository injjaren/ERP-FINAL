'use strict';
const { db } = require('../database');

// Audit logging
function logAudit(table, recordId, action, oldValues, newValues, user, reason = '') {
  try {
    db.prepare(`
      INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, user, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(table, recordId, action, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, user || 'system', reason);
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// Treasury ledger entry (append-only)
function addTreasuryEntry(date, type, description, amount, account, refType, refId, user, company_id = 1, branch_id = 1) {
  try {
    db.prepare(`
      INSERT INTO treasury_ledger (date, type, description, amount, account, reference_type, reference_id, created_by, company_id, branch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(date, type, description, amount, account, refType, refId, user || 'system', company_id, branch_id);
  } catch (err) {
    console.error('Treasury entry error:', err);
    throw err;
  }
}

module.exports = { logAudit, addTreasuryEntry };
