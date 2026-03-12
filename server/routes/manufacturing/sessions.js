'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { _recalcSession } = require('./helpers');
const { resolveBranchId } = require('../../utils');

// ============================================
// ERP-v15: MANUFACTURING SESSIONS API
// Workflow: Deliver combinations → Artisan works → Supervisor receives KG
// Status flow: OPEN → CLOSED (inventory committed on close)
// line_status: in_progress | completed | cancelled | transferred
// Labor: kg_produced × rate_per_kg (completed lines only)
// ============================================

// ── helpers ──────────────────────────────────────────────────────────────────

// Find the inventory row for a color_master entry in a given stage.
// Uses the color linkage chain: color_master.color_id → colors → color_codes → inventory
function _findInventoryByColor(colorMasterId, stage, cid) {
  return db.prepare(`
    SELECT i.id, i.quantity, i.unit_cost, i.warehouse_id, i.product_type_id
    FROM inventory i
    JOIN color_codes cc ON cc.id = i.color_code_id AND cc.company_id = i.company_id
    JOIN color_master cm ON cm.color_id = cc.color_id AND cm.company_id = i.company_id
    WHERE cm.id = ? AND i.inventory_stage = ? AND i.company_id = ?
    LIMIT 1
  `).get(colorMasterId, stage, cid);
}

// Find or create a wholesale_kg inventory row for a color_master entry.
function _ensureWholesaleInventory(colorMasterId, cid) {
  let inv = _findInventoryByColor(colorMasterId, 'wholesale_kg', cid);
  if (inv) return inv;

  const wholesaleWh = db.prepare(
    `SELECT id FROM warehouses WHERE inventory_stage = 'wholesale_kg' AND company_id = ? LIMIT 1`
  ).get(cid);
  if (!wholesaleWh) return null;

  const colorCode = db.prepare(`
    SELECT cc.id FROM color_codes cc
    JOIN color_master cm ON cm.color_id = cc.color_id AND cm.company_id = cc.company_id
    WHERE cm.id = ? AND cc.company_id = ? LIMIT 1
  `).get(colorMasterId, cid);
  if (!colorCode) return null;

  const defaultPt = db.prepare(`SELECT id FROM product_types WHERE company_id = ? LIMIT 1`).get(cid);
  if (!defaultPt) return null;

  const ins = db.prepare(`
    INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, inventory_stage, quantity, unit_cost, unit_price, company_id)
    VALUES (?, ?, ?, 'wholesale_kg', 0, 0, 0, ?)
  `).run(wholesaleWh.id, defaultPt.id, colorCode.id, cid);
  return { id: ins.lastInsertRowid, quantity: 0, unit_cost: 0, warehouse_id: wholesaleWh.id };
}

// Find an open session for an artisan on a given date + branch, or create one.
// excludeId: session ID to exclude from the search (used when closing a session to avoid finding itself)
function _findOrCreateSession(artisanId, branchId, sessionDate, cid, excludeId = null) {
  const existing = excludeId
    ? db.prepare(`
        SELECT id FROM production_sessions
        WHERE artisan_id = ? AND branch_id = ? AND session_date = ? AND status = 'OPEN' AND company_id = ? AND id != ?
        LIMIT 1
      `).get(artisanId, branchId, sessionDate, cid, excludeId)
    : db.prepare(`
        SELECT id FROM production_sessions
        WHERE artisan_id = ? AND branch_id = ? AND session_date = ? AND status = 'OPEN' AND company_id = ?
        LIMIT 1
      `).get(artisanId, branchId, sessionDate, cid);
  if (existing) return { id: existing.id, created: false };

  const r = db.prepare(`
    INSERT INTO production_sessions (session_date, artisan_id, branch_id, status, company_id)
    VALUES (?, ?, ?, 'OPEN', ?)
  `).run(sessionDate, artisanId, branchId, cid);
  return { id: r.lastInsertRowid, created: true };
}

// ── LIST sessions ─────────────────────────────────────────────────────────────
router.get('/manufacturing/sessions', (req, res) => {
  try {
    const cid = req.company_id;
    const { status, artisan_id, from, to } = req.query;
    let sql = `
      SELECT ps.*, a.name AS artisan_name, a.code AS artisan_code, b.name AS branch_name
      FROM production_sessions ps
      JOIN artisans a ON a.id = ps.artisan_id AND a.company_id = ps.company_id
      JOIN branches b ON b.id = ps.branch_id AND b.company_id = ps.company_id
      WHERE ps.company_id = ?
    `;
    const params = [cid];
    if (status)     { sql += ` AND ps.status = ?`;       params.push(status); }
    if (artisan_id) { sql += ` AND ps.artisan_id = ?`;   params.push(artisan_id); }
    if (from)       { sql += ` AND ps.session_date >= ?`; params.push(from); }
    if (to)         { sql += ` AND ps.session_date <= ?`; params.push(to); }
    sql += ` ORDER BY ps.session_date DESC, ps.id DESC`;
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CREATE session ────────────────────────────────────────────────────────────
router.post('/manufacturing/sessions', (req, res) => {
  try {
    const cid = req.company_id;
    const { session_date, artisan_id, branch_id, warehouse_id } = req.body;
    if (!session_date || !artisan_id) {
      return res.status(400).json({ error: 'session_date و artisan_id مطلوبة' });
    }
    // Auto-resolve branch
    let bid = resolveBranchId(branch_id, warehouse_id, cid);
    if (!bid) {
      const whBranch = db.prepare(
        `SELECT id FROM branches WHERE branch_type = 'wholesale' AND company_id = ? LIMIT 1`
      ).get(cid);
      bid = whBranch ? whBranch.id : 1;
    }
    // Only wholesale or workshop branches
    const branch = db.prepare(`SELECT id, branch_type FROM branches WHERE id = ? AND company_id = ?`).get(bid, cid);
    if (!branch || !['wholesale', 'workshop'].includes(branch.branch_type)) {
      return res.status(400).json({ error: 'الجلسات الإنتاجية متاحة فقط في فروع الجملة أو الورشة' });
    }
    const artisan = db.prepare(`SELECT id FROM artisans WHERE id = ? AND company_id = ?`).get(artisan_id, cid);
    if (!artisan) return res.status(404).json({ error: 'الحرفي غير موجود' });

    // Safety: prevent duplicate OPEN session for same artisan on same date
    const existingOpen = db.prepare(`
      SELECT id, session_date FROM production_sessions
      WHERE artisan_id = ? AND session_date = ? AND status = 'OPEN' AND company_id = ?
      LIMIT 1
    `).get(artisan_id, session_date, cid);
    if (existingOpen) {
      return res.status(409).json({
        error: 'للحرفي جلسة مفتوحة بالفعل في هذا التاريخ. أغلقها أولاً أو افتح الجلسة الموجودة.',
        existing_session_id: existingOpen.id,
        existing_session_date: existingOpen.session_date
      });
    }

    const r = db.prepare(`
      INSERT INTO production_sessions (session_date, artisan_id, branch_id, status, company_id)
      VALUES (?, ?, ?, 'OPEN', ?)
    `).run(session_date, artisan_id, bid, cid);
    res.json({ id: r.lastInsertRowid, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET session detail ────────────────────────────────────────────────────────
router.get('/manufacturing/sessions/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const session = db.prepare(`
      SELECT ps.*, a.name AS artisan_name, a.code AS artisan_code, b.name AS branch_name,
             ar.rate_per_kg
      FROM production_sessions ps
      JOIN artisans a ON a.id = ps.artisan_id AND a.company_id = ps.company_id
      JOIN branches b ON b.id = ps.branch_id AND b.company_id = ps.company_id
      LEFT JOIN artisan_rates ar ON ar.artisan_id = ps.artisan_id AND ar.company_id = ps.company_id
      WHERE ps.id = ? AND ps.company_id = ?
    `).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const lines = db.prepare(`
      SELECT pl.*, cm.internal_ar_name AS color_name, cm.hex_code, cm.supplier_color_code,
             cf.family_name_ar,
             ts.id AS transfer_target_id,
             ta.name AS transfer_target_artisan
      FROM production_lines pl
      JOIN color_master cm ON cm.id = pl.color_id AND cm.company_id = pl.company_id
      LEFT JOIN color_families cf ON cf.id = cm.family_id AND cf.company_id = cm.company_id
      LEFT JOIN production_sessions ts ON ts.id = pl.transferred_to_session_id AND ts.company_id = pl.company_id
      LEFT JOIN artisans ta ON ta.id = ts.artisan_id AND ta.company_id = pl.company_id
      WHERE pl.session_id = ? AND pl.company_id = ?
      ORDER BY pl.id ASC
    `).all(id, cid);
    res.json({ session, lines });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ADD production line (DELIVERY stage) ─────────────────────────────────────
// v15: Only records the delivery of combinations to the artisan.
// actual_kg_produced is set to 0; use /complete or /partial to record production.
// line_status always starts as 'in_progress'.
router.post('/manufacturing/sessions/:id/lines', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });

    const { color_id, combinations, notes, rate_per_kg, bobbins_consumed } = req.body;
    if (!color_id || combinations === undefined) {
      return res.status(400).json({ error: 'color_id و combinations مطلوبان' });
    }
    const combInt = parseInt(combinations) || 0;
    if (combInt < 1) return res.status(400).json({ error: 'يجب أن يكون عدد التركيبات 1 على الأقل' });

    const color = db.prepare(`SELECT id FROM color_master WHERE id = ? AND company_id = ?`).get(color_id, cid);
    if (!color) return res.status(404).json({ error: 'اللون غير موجود' });

    // Default rate: use artisan's configured rate, fallback to 6
    const artisanRate = db.prepare(
      `SELECT rate_per_kg FROM artisan_rates WHERE artisan_id = (SELECT artisan_id FROM production_sessions WHERE id = ? AND company_id = ?) AND company_id = ?`
    ).get(id, cid, cid);
    const lineRate = parseFloat(rate_per_kg) || (artisanRate ? artisanRate.rate_per_kg : 6) || 6;

    // Bobbins: default = combinations × 4, but allow manual override (e.g. missing bobbins in carton)
    const defaultBobbins = combInt * 4;
    const bobbinsVal = bobbins_consumed !== undefined
      ? Math.max(0, parseInt(bobbins_consumed) || 0)
      : defaultBobbins;

    const r = db.prepare(`
      INSERT INTO production_lines
        (session_id, color_id, combinations, bobbins_consumed, actual_kg_produced, prior_produced_kg, rate_per_kg, line_status, notes, company_id)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'in_progress', ?, ?)
    `).run(id, color_id, combInt, bobbinsVal, lineRate, notes || null, cid);

    _recalcSession(id, cid);
    res.json({ id: r.lastInsertRowid, bobbins_consumed: bobbinsVal, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMPLETE line (RECEIVING stage — full) ────────────────────────────────────
// Supervisor confirms all production KG for this combination.
// Sets line_status = 'completed'. Counts toward session KG + labor totals.
router.post('/manufacturing/sessions/:id/lines/:lid/complete', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });

    const line = db.prepare(
      `SELECT id, combinations, line_status, prior_produced_kg, actual_kg_produced
       FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`
    ).get(lid, id, cid);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    if (line.line_status !== 'in_progress') {
      return res.status(400).json({ error: 'يمكن استلام الأسطر قيد التنفيذ فقط' });
    }

    const { produced_kg } = req.body;
    const kgVal = parseFloat(produced_kg);
    if (!kgVal || kgVal <= 0) return res.status(400).json({ error: 'يجب إدخال كمية منتجة صحيحة (أكبر من صفر)' });

    // Workshop rule: quantities must be in 0.5 kg increments
    if (Math.round(kgVal * 10) % 5 !== 0) {
      return res.status(400).json({ error: 'يجب أن تكون الكمية بمضاعفات 0.5 كجم (مثال: 9، 9.5، 10، 10.5)' });
    }

    // Physical cap: max 11 KG per combination across all artisans; subtract prior + already accumulated
    const alreadyKg   = line.actual_kg_produced || 0;
    const maxKg = line.combinations * 11 - (line.prior_produced_kg || 0) - alreadyKg;
    if (kgVal > maxKg) {
      return res.status(400).json({ error: `الكمية (${kgVal} كجم) تتجاوز الحد الأقصى المتبقي (${maxKg.toFixed(1)} كجم)` });
    }

    // Accumulate (not replace) — prior partial receives are preserved
    db.prepare(`
      UPDATE production_lines SET actual_kg_produced = actual_kg_produced + ?, line_status = 'completed'
      WHERE id = ? AND session_id = ? AND company_id = ?
    `).run(kgVal, lid, id, cid);

    const finalLine = db.prepare(`SELECT actual_kg_produced FROM production_lines WHERE id = ? AND company_id = ?`).get(lid, cid);
    _recalcSession(id, cid);
    res.json({ success: true, added_kg: kgVal, total_kg: finalLine.actual_kg_produced });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PARTIAL RECEIVE line ──────────────────────────────────────────────────────
// Supervisor records partial KG for an in_progress line.
// Line stays in_progress; actual_kg_produced is updated to the accumulated partial.
// Call /complete when the artisan finishes the rest.
router.post('/manufacturing/sessions/:id/lines/:lid/partial', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });

    const line = db.prepare(
      `SELECT id, combinations, line_status, prior_produced_kg FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`
    ).get(lid, id, cid);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    if (line.line_status !== 'in_progress') {
      return res.status(400).json({ error: 'يمكن الاستلام الجزئي للأسطر قيد التنفيذ فقط' });
    }

    const { produced_kg } = req.body;
    const kgVal = parseFloat(produced_kg);
    if (!kgVal || kgVal <= 0) return res.status(400).json({ error: 'يجب إدخال كمية جزئية صحيحة (أكبر من صفر)' });

    // Workshop rule: quantities must be in 0.5 kg increments
    if (Math.round(kgVal * 10) % 5 !== 0) {
      return res.status(400).json({ error: 'يجب أن تكون الكمية بمضاعفات 0.5 كجم (مثال: 9، 9.5، 10، 10.5)' });
    }

    // Accumulate: add new KG to existing value
    db.prepare(`
      UPDATE production_lines SET actual_kg_produced = actual_kg_produced + ?
      WHERE id = ? AND session_id = ? AND company_id = ?
    `).run(kgVal, lid, id, cid);

    const updated = db.prepare(
      `SELECT actual_kg_produced, combinations, prior_produced_kg FROM production_lines WHERE id = ? AND company_id = ?`
    ).get(lid, cid);

    // Suggest completion when accumulated reaches 90% of expected (9.5 kg/combination, rounded to 0.5)
    const AVG_KG_PER_COMB = 9.5;
    const expected = updated.combinations * AVG_KG_PER_COMB - (updated.prior_produced_kg || 0);
    const expectedRounded = Math.round(expected * 2) / 2;
    const suggestedComplete = updated.actual_kg_produced >= expectedRounded * 0.9;

    // Partial lines stay in_progress — do NOT count toward session totals yet
    _recalcSession(id, cid);
    res.json({
      success: true,
      added_kg: kgVal,
      total_kg: updated.actual_kg_produced,
      expected_kg: expectedRounded,
      suggested_complete: suggestedComplete,
      status: 'in_progress'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TRANSFER line to another artisan ─────────────────────────────────────────
// Marks the original line as 'transferred' and creates a new in_progress line
// in the target artisan's session (auto-created if needed, same date + branch).
router.post('/manufacturing/sessions/:id/lines/:lid/transfer', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(`
      SELECT ps.id, ps.status, ps.artisan_id, ps.branch_id, ps.session_date
      FROM production_sessions ps WHERE ps.id = ? AND ps.company_id = ?
    `).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التحويل — الجلسة ليست مفتوحة' });

    const line = db.prepare(
      `SELECT id, color_id, combinations, line_status, actual_kg_produced, prior_produced_kg, rate_per_kg
       FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`
    ).get(lid, id, cid);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    if (line.line_status !== 'in_progress') {
      return res.status(400).json({ error: 'يمكن تحويل الأسطر قيد التنفيذ فقط' });
    }

    const { target_artisan_id } = req.body;
    if (!target_artisan_id) return res.status(400).json({ error: 'target_artisan_id مطلوب' });
    if (parseInt(target_artisan_id) === session.artisan_id) {
      return res.status(400).json({ error: 'لا يمكن التحويل إلى نفس الحرفي' });
    }

    const targetArtisan = db.prepare(`SELECT id FROM artisans WHERE id = ? AND company_id = ?`).get(target_artisan_id, cid);
    if (!targetArtisan) return res.status(404).json({ error: 'الحرفي المستهدف غير موجود' });

    // Accumulated prior KG = original prior_produced_kg + what this artisan already did
    const newPriorKg = (line.prior_produced_kg || 0) + (line.actual_kg_produced || 0);

    db.transaction(() => {
      // Find or create open session for target artisan (same date + branch)
      const { id: targetSessionId, created } = _findOrCreateSession(
        target_artisan_id, session.branch_id, session.session_date, cid
      );

      // Create new line in target session, inheriting prior_produced_kg and rate_per_kg
      const bobbins = line.combinations * 4;
      const newLine = db.prepare(`
        INSERT INTO production_lines
          (session_id, color_id, combinations, bobbins_consumed, actual_kg_produced,
           prior_produced_kg, rate_per_kg, line_status, transferred_from_line_id, company_id)
        VALUES (?, ?, ?, ?, 0, ?, ?, 'in_progress', ?, ?)
      `).run(targetSessionId, line.color_id, line.combinations, bobbins,
             newPriorKg, line.rate_per_kg || 6, lid, cid);

      // Mark original line as transferred
      db.prepare(`
        UPDATE production_lines SET line_status = 'transferred', transferred_to_session_id = ?
        WHERE id = ? AND session_id = ? AND company_id = ?
      `).run(targetSessionId, lid, id, cid);

      _recalcSession(id, cid);
      _recalcSession(targetSessionId, cid);

      // Store result for response
      res._transferResult = { target_session_id: targetSessionId, created, new_line_id: newLine.lastInsertRowid };
    })();

    const result = res._transferResult || {};
    res.json({
      success: true,
      target_session_id: result.target_session_id,
      session_created: result.created,
      new_line_id: result.new_line_id
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CANCEL line ───────────────────────────────────────────────────────────────
router.post('/manufacturing/sessions/:id/lines/:lid/cancel', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });

    const line = db.prepare(
      `SELECT id, line_status FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`
    ).get(lid, id, cid);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    if (!['in_progress'].includes(line.line_status)) {
      return res.status(400).json({ error: 'يمكن إلغاء الأسطر قيد التنفيذ فقط' });
    }

    db.prepare(`
      UPDATE production_lines SET line_status = 'cancelled'
      WHERE id = ? AND session_id = ? AND company_id = ?
    `).run(lid, id, cid);

    _recalcSession(id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── UPDATE production line (combinations + notes only) ────────────────────────
// v15: actual_kg_produced is only set via /complete or /partial endpoints.
router.put('/manufacturing/sessions/:id/lines/:lid', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(
      `SELECT status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });
    const line = db.prepare(
      `SELECT id, combinations, line_status FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`
    ).get(lid, id, cid);
    if (!line) return res.status(404).json({ error: 'Line not found' });
    if (line.line_status !== 'in_progress') {
      return res.status(400).json({ error: 'يمكن تعديل الأسطر قيد التنفيذ فقط' });
    }

    const { combinations, notes } = req.body;
    const combInt = combinations !== undefined ? (parseInt(combinations) || 0) : null;
    const bobbins = combInt !== null ? combInt * 4 : null;
    if (combInt !== null && combInt < 1) return res.status(400).json({ error: 'يجب أن يكون عدد التركيبات 1 على الأقل' });

    db.prepare(`
      UPDATE production_lines SET
        combinations     = COALESCE(?, combinations),
        bobbins_consumed = COALESCE(?, bobbins_consumed),
        notes            = ?
      WHERE id = ? AND session_id = ? AND company_id = ?
    `).run(combInt, bobbins, notes ?? null, lid, id, cid);

    _recalcSession(id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE production line ────────────────────────────────────────────────────
router.delete('/manufacturing/sessions/:id/lines/:lid', (req, res) => {
  try {
    const cid = req.company_id;
    const { id, lid } = req.params;
    const session = db.prepare(
      `SELECT status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'لا يمكن التعديل — الجلسة ليست مفتوحة' });
    db.prepare(`DELETE FROM production_lines WHERE id = ? AND session_id = ? AND company_id = ?`).run(lid, id, cid);
    _recalcSession(id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Override labor cost ───────────────────────────────────────────────────────
router.put('/manufacturing/sessions/:id/labor', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const { final_labor_cost } = req.body;
    if (final_labor_cost === undefined) return res.status(400).json({ error: 'final_labor_cost required' });
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'الجلسة مغلقة أو ملغاة' });
    db.prepare(`
      UPDATE production_sessions SET final_labor_cost = ?, labor_modified = 1 WHERE id = ? AND company_id = ?
    `).run(parseFloat(final_labor_cost), id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FORCE-CLOSE session (admin shortcut) ──────────────────────────────────────
// Used when creating a new session for an artisan who already has an OPEN one.
// Carries forward in_progress lines without committing inventory, then closes.
router.post('/manufacturing/sessions/:id/force-close', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const result = autoCloseSessionSync(parseInt(id), cid);
    res.json({ closed: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AUTO-CLOSE stale sessions (midnight batch) ────────────────────────────────
// Closes all OPEN sessions from before today, carrying forward in_progress lines.
// Safe to call any time; sessions from today are never touched.
router.post('/manufacturing/sessions/auto-close-stale', (req, res) => {
  try {
    const cid = req.company_id;
    const today = new Date().toISOString().split('T')[0];
    const stale = db.prepare(`
      SELECT id FROM production_sessions
      WHERE status = 'OPEN' AND session_date < ? AND company_id = ?
    `).all(today, cid);

    const results = [];
    for (const s of stale) {
      try {
        const r = autoCloseSessionSync(s.id, cid);
        results.push({ session_id: s.id, ...r });
      } catch (e) {
        results.push({ session_id: s.id, error: e.message });
      }
    }
    res.json({ closed_count: results.filter(r => !r.error).length, sessions: results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── CLOSE session ─────────────────────────────────────────────────────────────
// v15 carry-forward: in_progress lines auto-moved to a new session.
// Only completed lines commit inventory (deduct raw_bobbin, add wholesale_kg).
router.post('/manufacturing/sessions/:id/close', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const session = db.prepare(`
      SELECT ps.*, ar.rate_per_kg, b.branch_type
      FROM production_sessions ps
      JOIN branches b ON b.id = ps.branch_id AND b.company_id = ps.company_id
      LEFT JOIN artisan_rates ar ON ar.artisan_id = ps.artisan_id AND ar.company_id = ps.company_id
      WHERE ps.id = ? AND ps.company_id = ?
    `).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'OPEN') return res.status(400).json({ error: 'يمكن إغلاق الجلسات المفتوحة فقط' });

    const lines = db.prepare(`
      SELECT pl.*, cm.internal_ar_name AS color_name
      FROM production_lines pl
      LEFT JOIN color_master cm ON cm.id = pl.color_id AND cm.company_id = pl.company_id
      WHERE pl.session_id = ? AND pl.company_id = ?
    `).all(id, cid);

    const completedLines  = lines.filter(l => l.line_status === 'completed');
    const inProgressLines = lines.filter(l => l.line_status === 'in_progress');

    const user = req.body?.user || req.session?.user?.username || 'system';
    const isWholesale = session.branch_type === 'wholesale';

    let carryForwardSessionId = null;
    let carryForwardCount = 0;

    db.transaction(() => {
      // ── Step 1: Carry forward in_progress lines ──────────────────────────
      if (inProgressLines.length > 0) {
        // Exclude the current session (id) so we don't carry-forward into ourselves
        const cf = _findOrCreateSession(
          session.artisan_id, session.branch_id, session.session_date, cid, id
        );
        carryForwardSessionId = cf.id;

        for (const line of inProgressLines) {
          const bobbins    = line.combinations * 4;
          const newPriorKg = (line.prior_produced_kg || 0) + (line.actual_kg_produced || 0);
          const newLine = db.prepare(`
            INSERT INTO production_lines
              (session_id, color_id, combinations, bobbins_consumed, actual_kg_produced,
               prior_produced_kg, rate_per_kg, line_status, transferred_from_line_id, company_id)
            VALUES (?, ?, ?, ?, 0, ?, ?, 'in_progress', ?, ?)
          `).run(carryForwardSessionId, line.color_id, line.combinations, bobbins,
                 newPriorKg, line.rate_per_kg || 6, line.id, cid);

          db.prepare(`
            UPDATE production_lines SET line_status = 'transferred', transferred_to_session_id = ?
            WHERE id = ? AND session_id = ? AND company_id = ?
          `).run(carryForwardSessionId, line.id, id, cid);
        }
        carryForwardCount = inProgressLines.length;
        _recalcSession(carryForwardSessionId, cid);
      }

      // ── Step 2: Commit inventory for completed lines ──────────────────────
      for (const line of completedLines) {
        // Deduct raw_bobbin inventory
        const rawInv = _findInventoryByColor(line.color_id, 'raw_bobbin', cid);
        if (rawInv) {
          const newQty = rawInv.quantity - line.bobbins_consumed;
          if (!isWholesale && newQty < 0) {
            throw new Error(`مخزون البكرات غير كافٍ للون: ${line.color_name || line.color_id} (متاح: ${rawInv.quantity}, مطلوب: ${line.bobbins_consumed})`);
          }
          db.prepare(`UPDATE inventory SET quantity = ? WHERE id = ? AND company_id = ?`)
            .run(newQty, rawInv.id, cid);
          db.prepare(`
            INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by, company_id)
            VALUES (?, 'out', ?, 0, 'session_close', ?, ?, ?, ?)
          `).run(rawInv.id, line.bobbins_consumed, id, `إغلاق جلسة #${id} — خصم ${line.bobbins_consumed} بكرة (${line.color_name})`, user, cid);
        }

        // Add wholesale_kg
        if (line.actual_kg_produced > 0) {
          const whInv = _ensureWholesaleInventory(line.color_id, cid);
          if (whInv) {
            db.prepare(`UPDATE inventory SET quantity = quantity + ? WHERE id = ? AND company_id = ?`)
              .run(line.actual_kg_produced, whInv.id, cid);
            db.prepare(`
              INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, notes, created_by, company_id)
              VALUES (?, 'in', ?, 0, 'session_close', ?, ?, ?, ?)
            `).run(whInv.id, line.actual_kg_produced, id, `إغلاق جلسة #${id} — إضافة ${line.actual_kg_produced} كجم (${line.color_name})`, user, cid);
          }
        }
      }

      // ── Step 3: Finalize and close ────────────────────────────────────────
      const calcLabor  = session.calculated_labor_cost;
      const finalLabor = session.labor_modified ? session.final_labor_cost : calcLabor;
      db.prepare(`
        UPDATE production_sessions SET status = 'CLOSED', final_labor_cost = ?, closed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND company_id = ?
      `).run(finalLabor, id, cid);
    })();

    const msg = carryForwardCount > 0
      ? `تم الإغلاق — نُقلت ${carryForwardCount} تركيبة إلى جلسة #${carryForwardSessionId}`
      : 'تم إغلاق الجلسة وتحديث المخزون';

    res.json({
      success: true,
      message: msg,
      carry_forward_session_id: carryForwardSessionId,
      carry_forward_count: carryForwardCount,
      committed_count: completedLines.length
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── APPROVE endpoint — removed in v14 ────────────────────────────────────────
router.post('/manufacturing/sessions/:id/approve', (req, res) => {
  res.status(410).json({ error: 'الاعتماد تمت إزالته — إغلاق الجلسة يعتمد المخزون تلقائياً' });
});

// ── CANCEL session ────────────────────────────────────────────────────────────
// OPEN → delete session + lines (no inventory impact)
// CLOSED → blocked
router.post('/manufacturing/sessions/:id/cancel', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const session = db.prepare(
      `SELECT id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (session.status === 'CLOSED') {
      return res.status(400).json({ error: 'لا يمكن إلغاء جلسة مغلقة — المخزون تم تحديثه بالفعل' });
    }
    if (session.status === 'CANCELLED') {
      return res.status(400).json({ error: 'الجلسة ملغاة بالفعل' });
    }

    db.transaction(() => {
      db.prepare(`DELETE FROM production_lines WHERE session_id = ? AND company_id = ?`).run(id, cid);
      db.prepare(`DELETE FROM production_sessions WHERE id = ? AND company_id = ?`).run(id, cid);
    })();

    res.json({ success: true, message: 'تم حذف الجلسة وأسطرها' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── autoCloseSessionSync ──────────────────────────────────────────────────────
// Internal helper: carry-forward in_progress lines then mark session CLOSED.
// Does NOT commit inventory (no bobbins/KG movement) — use /close for that.
// Called by force-close route and midnight scheduler.
function autoCloseSessionSync(sessionId, cid) {
  const session = db.prepare(
    `SELECT id, artisan_id, branch_id, session_date FROM production_sessions WHERE id = ? AND company_id = ? AND status = 'OPEN'`
  ).get(sessionId, cid);
  if (!session) throw new Error(`Session ${sessionId} not found or not OPEN`);

  const inProgressLines = db.prepare(
    `SELECT * FROM production_lines WHERE session_id = ? AND company_id = ? AND line_status = 'in_progress'`
  ).all(sessionId, cid);

  let carryForwardSessionId = null;
  let carryForwardCount = 0;

  db.transaction(() => {
    if (inProgressLines.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const cf = _findOrCreateSession(session.artisan_id, session.branch_id, today, cid, sessionId);
      carryForwardSessionId = cf.id;

      for (const line of inProgressLines) {
        const bobbins    = line.combinations * 4;
        const newPriorKg = (line.prior_produced_kg || 0) + (line.actual_kg_produced || 0);
        db.prepare(`
          INSERT INTO production_lines
            (session_id, color_id, combinations, bobbins_consumed, actual_kg_produced,
             prior_produced_kg, rate_per_kg, line_status, transferred_from_line_id, company_id)
          VALUES (?, ?, ?, ?, 0, ?, ?, 'in_progress', ?, ?)
        `).run(carryForwardSessionId, line.color_id, line.combinations, bobbins,
               newPriorKg, line.rate_per_kg || 6, line.id, cid);
        db.prepare(`
          UPDATE production_lines SET line_status = 'transferred', transferred_to_session_id = ?
          WHERE id = ? AND session_id = ? AND company_id = ?
        `).run(carryForwardSessionId, line.id, sessionId, cid);
      }
      carryForwardCount = inProgressLines.length;
      _recalcSession(carryForwardSessionId, cid);
    }

    db.prepare(
      `UPDATE production_sessions SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`
    ).run(sessionId, cid);
  })();

  return { carry_forward_count: carryForwardCount, carry_forward_session_id: carryForwardSessionId };
}

module.exports = { router, autoCloseSessionSync };
