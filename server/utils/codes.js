'use strict';
const { db } = require('../database');
const { CODE_PREFIXES } = require('./constants');

function generateCode(table, cid) {
  const config = CODE_PREFIXES[table];
  if (!config) return null;

  // Use company_id if available to pass isolation guard
  const sql = cid
    ? `SELECT code FROM ${table} WHERE code LIKE '${config.prefix}%' AND company_id = ? ORDER BY id DESC LIMIT 1`
    : `SELECT code FROM ${table} WHERE code LIKE '${config.prefix}%' ORDER BY id DESC LIMIT 1`;
  const lastRecord = cid ? db.prepare(sql).get(cid) : db.prepare(sql).get();

  if (lastRecord && lastRecord.code) {
    const lastNum = parseInt(lastRecord.code.replace(config.prefix, '')) || config.start;
    return `${config.prefix}${lastNum + 1}`;
  }
  return `${config.prefix}${config.start}`;
}

module.exports = { generateCode };
