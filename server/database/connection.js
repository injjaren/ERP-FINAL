'use strict';
const Database = require('better-sqlite3');
const fs       = require('fs');

const DB_PATH = './database/accounting.db';

['database', 'logs', 'backups'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ============================================
// HARD MULTI-COMPANY ISOLATION GUARD v4
// Defined immediately after db init.
// _isolationActive = false during migrations/seeding.
// Activated to true just before middleware so every
// API handler's db.prepare() is fully enforced.
// ============================================
let _isolationActive = false;
const originalPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  if (_isolationActive) {
    const normalized = sql.trim().toLowerCase();
    const isSelect = normalized.startsWith('select');
    const isInsert = normalized.startsWith('insert');
    const isUpdate = normalized.startsWith('update');
    const isDelete = normalized.startsWith('delete');
    const requiresIsolation = isSelect || isInsert || isUpdate || isDelete;
    if (requiresIsolation) {
      const hasCompanyId  = normalized.includes('company_id');
      const isLoginQuery  = normalized.includes('from users')     ||
                            normalized.includes('sqlite_master')  ||
                            normalized.includes('pragma')         ||
                            normalized.includes('audit_log');       // audit_log is cross-company by design
      if (!hasCompanyId && !isLoginQuery) {
        console.error('[ISOLATION BLOCKED]', sql.trim().slice(0, 150));
        throw new Error('Multi-company isolation violation: company_id missing');
      }
    }
  }
  return originalPrepare(sql);
};

function activateIsolation() {
  _isolationActive = true;
  console.log('[ISOLATION GUARD] Hard multi-company isolation ACTIVE — all queries must include company_id');
}

module.exports = { db, originalPrepare, activateIsolation };
