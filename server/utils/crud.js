'use strict';
const { db, originalPrepare } = require('../database');
const { logAudit } = require('./audit');

// Generic CRUD with audit
function crudWithAudit(table) {
  // Fields to exclude from database insertion (used for audit only)
  const excludeFields = ['id', 'user', 'reason'];

  // Detect company_id column once at init
  const _tableHasCompany = originalPrepare(`PRAGMA table_info(${table})`)
    .all().some(c => c.name === 'company_id');

  // Detect branch_id column once at init
  const _tableHasBranch = originalPrepare(`PRAGMA table_info(${table})`)
    .all().some(c => c.name === 'branch_id');

  return {
    // all: filter by company_id and branch_id
    all: (company_id, branch_id) => {
      let sql = `SELECT * FROM ${table}`;
      const conds = []; const args = [];
      if (_tableHasCompany && company_id != null) { conds.push('company_id = ?'); args.push(company_id); }
      if (_tableHasBranch && branch_id != null) { conds.push('branch_id = ?'); args.push(branch_id); }
      if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
      return db.prepare(sql).all(...args);
    },

    // get: scope by company_id and branch_id
    get: (id, company_id, branch_id) => {
      let sql = `SELECT * FROM ${table} WHERE id = ?`;
      const args = [id];
      if (_tableHasCompany && company_id != null) { sql += ' AND company_id = ?'; args.push(company_id); }
      if (_tableHasBranch && branch_id != null) { sql += ' AND branch_id = ?'; args.push(branch_id); }
      return db.prepare(sql).get(...args);
    },

    // create: inject company_id and branch_id into data
    create: (data, user, company_id, branch_id) => {
      const enriched = { ...data };
      if (_tableHasCompany && company_id != null) enriched.company_id = company_id;
      if (_tableHasBranch && branch_id != null) enriched.branch_id = branch_id;
      
      const keys = Object.keys(enriched).filter(k => !excludeFields.includes(k));
      const vals = keys.map(k => enriched[k]);
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const result = db.prepare(sql).run(...vals);
      logAudit(table, result.lastInsertRowid, 'create', null, enriched, user);
      return result;
    },

    // update: scope WHERE to company_id and branch_id
    update: (id, data, user, reason, company_id, branch_id) => {
      let selectSql = `SELECT * FROM ${table} WHERE id = ?`;
      let updateSql = `UPDATE ${table} SET `;
      const getArgs = [id];
      const whereConds = []; const whereArgs = [];
      
      if (_tableHasCompany && company_id != null) {
        selectSql += ' AND company_id = ?'; getArgs.push(company_id);
        whereConds.push('company_id = ?'); whereArgs.push(company_id);
      }
      if (_tableHasBranch && branch_id != null) {
        selectSql += ' AND branch_id = ?'; getArgs.push(branch_id);
        whereConds.push('branch_id = ?'); whereArgs.push(branch_id);
      }

      const old = db.prepare(selectSql).get(...getArgs);
      
      const keys = Object.keys(data).filter(k => !excludeFields.includes(k));
      const vals = keys.map(k => data[k]);
      
      updateSql += keys.map(k => `${k} = ?`).join(',') + ' WHERE id = ?';
      const runArgs = [...vals, id];
      if (whereConds.length) { updateSql += ' AND ' + whereConds.join(' AND '); runArgs.push(...whereArgs); }
      
      const result = db.prepare(updateSql).run(...runArgs);
      logAudit(table, id, 'update', old, data, user, reason);
      return result;
    },

    // delete: scope WHERE to company_id and branch_id
    delete: (id, user, reason, company_id, branch_id) => {
      let selectSql = `SELECT * FROM ${table} WHERE id = ?`;
      let delSql = `DELETE FROM ${table} WHERE id = ?`;
      const args = [id];
      const getArgs = [id];

      if (_tableHasCompany && company_id != null) {
        selectSql += ' AND company_id = ?'; getArgs.push(company_id);
        delSql += ' AND company_id = ?'; args.push(company_id);
      }
      if (_tableHasBranch && branch_id != null) {
        selectSql += ' AND branch_id = ?'; getArgs.push(branch_id);
        delSql += ' AND branch_id = ?'; args.push(branch_id);
      }

      const old = db.prepare(selectSql).get(...getArgs);
      const result = db.prepare(delSql).run(...args);
      logAudit(table, id, 'delete', old, null, user, reason);
      return result;
    }
  };
}

module.exports = { crudWithAudit };
