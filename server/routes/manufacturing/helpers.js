'use strict';
const { db } = require('../../database');

const JAAB_KG_PER_BAG = 26;

// ── Branch-safety helper ──────────────────────────────────────────────────────
// Returns the الجملة branch row for the company, or sends 403 and returns null.
// Admins without an assigned branch are allowed (operate on behalf of الجملة).
// Users with an explicit branch that is NOT الجملة receive 403.
function requireJomlaBranch(req, res) {
  const cid     = req.company_id;
  const session = req.session && req.session.user;
  const userBranchId = session ? session.branch_id : null;

  const jomla = db.prepare(
    `SELECT id, name, code, branch_type FROM branches WHERE code = 'BR-JOMLA' AND company_id = ?`
  ).get(cid);

  if (!jomla) {
    res.status(403).json({ error: 'الجملة branch not configured for this company' });
    return null;
  }

  // If user has an explicit branch assigned, it must be الجملة
  if (userBranchId && userBranchId !== jomla.id) {
    res.status(403).json({ error: 'Manufacturing is restricted to الجملة branch only' });
    return null;
  }

  return jomla;
}

// ── Batch cost recalculator ───────────────────────────────────────────────────
// Recomputes totals from entries + material usage and updates production_batches.
function recalcBatchCosts(batchId, cid) {
  const totalKg = db.prepare(
    `SELECT COALESCE(SUM(produced_kg), 0) AS kg FROM production_entries WHERE batch_id = ? AND company_id = ?`
  ).get(batchId, cid).kg;

  const laborCost = db.prepare(
    `SELECT COALESCE(SUM(labor_cost), 0) AS lc FROM production_entries WHERE batch_id = ? AND company_id = ?`
  ).get(batchId, cid).lc;

  const materialCost = db.prepare(
    `SELECT COALESCE(SUM(cost_used), 0) AS mc FROM production_material_usage WHERE batch_id = ? AND company_id = ?`
  ).get(batchId, cid).mc;

  const jaabCost = db.prepare(
    `SELECT COALESCE(jaab_cost, 0) AS jc FROM production_batches WHERE id = ? AND company_id = ?`
  ).get(batchId, cid).jc;

  const totalDirect = materialCost + laborCost + jaabCost;

  db.prepare(`
    UPDATE production_batches
    SET total_produced_kg    = ?,
        direct_labor_cost    = ?,
        direct_material_cost = ?,
        total_direct_cost    = ?
    WHERE id = ? AND company_id = ?
  `).run(totalKg, laborCost, materialCost, totalDirect, batchId, cid);

  return { totalKg, laborCost, materialCost, jaabCost, totalDirect };
}

// Helper: recalculate session totals
// Labor formula (v16): labor = SUM(completed_line.actual_kg_produced × line.rate_per_kg)
// total_combinations = active lines (excludes cancelled + transferred)
// total_kg_produced  = completed lines only (actual_kg_produced confirmed by supervisor)
function _recalcSession(sessionId, cid) {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN line_status NOT IN ('cancelled','transferred') THEN combinations ELSE 0 END), 0)                     AS total_combinations,
      COALESCE(SUM(CASE WHEN line_status='completed' THEN actual_kg_produced ELSE 0 END), 0)                                      AS total_kg_produced,
      COALESCE(SUM(CASE WHEN line_status='completed' THEN actual_kg_produced * rate_per_kg ELSE 0 END), 0)                        AS calculated_labor_cost
    FROM production_lines WHERE session_id = ? AND company_id = ?
  `).get(sessionId, cid);
  const totalComb  = totals.total_combinations;
  const totalKg    = Math.round(totals.total_kg_produced * 1000) / 1000;
  const calcLabor  = Math.round(totals.calculated_labor_cost * 100) / 100;
  db.prepare(`
    UPDATE production_sessions SET
      total_combinations    = ?,
      total_kg_produced     = ?,
      calculated_labor_cost = ?,
      final_labor_cost      = CASE WHEN labor_modified = 0 THEN ? ELSE final_labor_cost END
    WHERE id = ? AND company_id = ?
  `).run(totalComb, totalKg, calcLabor, calcLabor, sessionId, cid);
}

module.exports = { JAAB_KG_PER_BAG, requireJomlaBranch, recalcBatchCosts, _recalcSession };
