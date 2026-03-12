'use strict';
const { db } = require('../database');
const { KG_TO_OZ, STAGE_BRANCH_RULES, VALID_STAGES } = require('./constants');

function validateInventoryStage(stage, warehouseId, cid) {
  if (!stage || !VALID_STAGES.includes(stage)) {
    return { ok: false, error: `مرحلة المخزون غير صالحة: ${stage}. المراحل المسموحة: ${VALID_STAGES.join(', ')}` };
  }
  if (!warehouseId) return { ok: true };
  const wh = db.prepare('SELECT id, branch_id, inventory_stage FROM warehouses WHERE id = ? AND company_id = ?').get(warehouseId, cid);
  if (!wh) return { ok: false, error: `المخزن غير موجود: ${warehouseId}` };
  // If warehouse has a fixed stage, it must match
  if (wh.inventory_stage && wh.inventory_stage !== stage) {
    return { ok: false, error: `المخزن مخصص للمرحلة "${wh.inventory_stage}" ولا يقبل "${stage}"` };
  }
  // Validate branch_type compatibility
  if (wh.branch_id) {
    const branch = db.prepare('SELECT branch_type FROM branches WHERE id = ? AND company_id = ?').get(wh.branch_id, cid);
    if (branch && !STAGE_BRANCH_RULES[stage].includes(branch.branch_type)) {
      return { ok: false, error: `مرحلة "${stage}" غير متوافقة مع نوع الفرع "${branch.branch_type}"` };
    }
  }
  return { ok: true };
}

// ============================================
// COLOR AUTO-SYNC: ensure every color entering inventory exists in color system
// ============================================
/**
 * ensureColorInSystem(colorCode, cid, supplierId)
 * If colorCode text is provided and no matching color_codes row exists:
 *   1. Creates color_codes row (code, main_color='auto', company_id)
 *   2. Creates color_master row (supplier_color_code, internal_ar_name, family_id → 'غير مصنف')
 * Returns { color_code_id, color_master_id } or null if no colorCode given.
 * Safe to call inside transactions — all queries are company-scoped.
 */
function ensureColorInSystem(colorCode, cid, supplierId) {
  if (!colorCode || !colorCode.trim()) return null;
  const code = colorCode.trim();

  // 0. Find or create 'غير مصنف' default family
  let defaultFamily = db.prepare(
    `SELECT id FROM color_families WHERE family_name_ar = ? AND company_id = ?`
  ).get('غير مصنف', cid);
  if (!defaultFamily) {
    const fr = db.prepare(
      `INSERT INTO color_families (family_name_ar, display_order, active, company_id) VALUES (?, 999, 1, ?)`
    ).run('غير مصنف', cid);
    defaultFamily = { id: fr.lastInsertRowid };
  }

  // 1. canonical colors: find or create
  let colorRow = db.prepare('SELECT id FROM colors WHERE name_ar = ? AND company_id = ?').get(code, cid);
  if (!colorRow) {
    const cr = db.prepare(
      `INSERT INTO colors (family_id, name_ar, hex_code, company_id) VALUES (?, ?, NULL, ?)`
    ).run(defaultFamily.id, code, cid);
    colorRow = { id: cr.lastInsertRowid };
  }

  // 2. color_codes: find or create (link to canonical colors)
  let ccRow = db.prepare('SELECT id FROM color_codes WHERE code = ? AND company_id = ?').get(code, cid);
  if (!ccRow) {
    const r = db.prepare(
      `INSERT INTO color_codes (code, main_color, shade, active, company_id, color_id) VALUES (?, ?, NULL, 1, ?, ?)`
    ).run(code, code, cid, colorRow.id);
    ccRow = { id: r.lastInsertRowid };
  } else if (!ccRow.color_id) {
    db.prepare('UPDATE color_codes SET color_id = ? WHERE id = ?').run(colorRow.id, ccRow.id);
  }

  // 3. color_master: find or create (keyed by supplier_color_code + company_id), link to canonical colors
  let cmRow = db.prepare(
    `SELECT id FROM color_master WHERE supplier_color_code = ? AND COALESCE(supplier_id,0) = COALESCE(?,0) AND company_id = ?`
  ).get(code, supplierId || null, cid);

  if (!cmRow) {
    const cmr = db.prepare(`
      INSERT INTO color_master (supplier_id, supplier_color_code, internal_ar_name, family_id, active, company_id, color_id)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(supplierId || null, code, code, defaultFamily.id, cid, colorRow.id);
    cmRow = { id: cmr.lastInsertRowid };
  } else if (!cmRow.color_id) {
    db.prepare('UPDATE color_master SET color_id = ? WHERE id = ?').run(colorRow.id, cmRow.id);
  }

  return { color_code_id: ccRow.id, color_master_id: cmRow.id };
}

// ============================================
// BRANCH AUTO-RESOLVE: derive branch_id from warehouse_id
// ============================================
function resolveBranchId(branch_id, warehouse_id, cid) {
  if (branch_id) return branch_id;
  if (!warehouse_id) return null;
  const wh = db.prepare('SELECT branch_id FROM warehouses WHERE id = ? AND company_id = ?').get(warehouse_id, cid);
  return wh ? wh.branch_id : null;
}

module.exports = { validateInventoryStage, ensureColorInSystem, resolveBranchId };
