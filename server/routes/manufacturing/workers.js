'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { _recalcSession } = require('./helpers');

// ============================================================
// PHASE 6: MANUFACTURING PRODUCTION FLOW
// Extends the v9 session engine with:
//   - session/start  (one-open-per-worker guard)
//   - session/close  (body-based close, records closed_at)
//   - entries        (simple kg-per-color entry → MANUFACTURING_OUTPUT movement)
//   - settlement     (close + pay worker → worker_transactions)
//   - today          (dashboard snapshot)
//   - worker/:id     (per-worker summary)
// Isolation: every query uses company_id (+ branch_id where needed)
// ============================================================

// POST /api/manufacturing/session/start
// Creates a new OPEN session. Enforces only one OPEN session per worker.
router.post('/manufacturing/session/start', (req, res) => {
  try {
    const cid = req.company_id;
    const { worker_id, branch_id, session_date } = req.body;
    if (!worker_id) return res.status(400).json({ error: 'worker_id مطلوب' });

    const worker = db.prepare(
      `SELECT id, name FROM artisans WHERE id = ? AND company_id = ?`
    ).get(worker_id, cid);
    if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });

    // Enforce one open session per worker
    const existing = db.prepare(
      `SELECT id FROM production_sessions WHERE artisan_id = ? AND company_id = ? AND status = 'OPEN'`
    ).get(worker_id, cid);
    if (existing) {
      return res.status(409).json({
        error: 'يوجد جلسة مفتوحة بالفعل لهذا العامل',
        session_id: existing.id
      });
    }

    // Resolve branch: explicit > wholesale branch > fallback 1
    let bid = branch_id ? parseInt(branch_id) : null;
    if (!bid) {
      const whBranch = db.prepare(
        `SELECT id FROM branches WHERE branch_type = 'wholesale' AND company_id = ? LIMIT 1`
      ).get(cid);
      bid = whBranch ? whBranch.id : 1;
    }

    const date = session_date || new Date().toISOString().split('T')[0];
    const now  = new Date().toISOString();

    const r = db.prepare(`
      INSERT INTO production_sessions (session_date, artisan_id, branch_id, status, started_at, company_id)
      VALUES (?, ?, ?, 'OPEN', ?, ?)
    `).run(date, worker_id, bid, now, cid);

    res.status(201).json({
      id: r.lastInsertRowid,
      worker_id,
      worker_name: worker.name,
      branch_id: bid,
      session_date: date,
      started_at: now,
      status: 'OPEN'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/manufacturing/session/close
// Closes a session referenced by session_id in request body.
router.post('/manufacturing/session/close', (req, res) => {
  try {
    const cid = req.company_id;
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id مطلوب' });

    const session = db.prepare(`
      SELECT ps.*, ar.rate_per_combination
      FROM production_sessions ps
      LEFT JOIN artisan_rates ar ON ar.artisan_id = ps.artisan_id AND ar.company_id = ps.company_id
      WHERE ps.id = ? AND ps.company_id = ?
    `).get(session_id, cid);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'يمكن إغلاق الجلسات المفتوحة فقط' });
    }

    const now        = new Date().toISOString();
    const finalLabor = session.labor_modified ? session.final_labor_cost : session.calculated_labor_cost;

    db.prepare(`
      UPDATE production_sessions
      SET status = 'CLOSED', final_labor_cost = ?, closed_at = ?
      WHERE id = ? AND company_id = ?
    `).run(finalLabor, now, session_id, cid);

    res.json({ success: true, session_id, status: 'CLOSED', closed_at: now });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/manufacturing/entries
// Adds a production entry (kg per color) to an open session.
// Creates a MANUFACTURING_OUTPUT inventory movement immediately.
// Maps internally to production_lines (session + color + kg).
router.post('/manufacturing/entries', (req, res) => {
  try {
    const cid = req.company_id;
    const { session_id, worker_id, color_id, kg } = req.body;
    if (!session_id || !color_id || kg == null) {
      return res.status(400).json({ error: 'session_id و color_id و kg مطلوبة' });
    }
    const kgVal = parseFloat(kg);
    if (kgVal <= 0) return res.status(400).json({ error: 'kg يجب أن يكون أكبر من صفر' });

    const session = db.prepare(
      `SELECT id, artisan_id, branch_id, status FROM production_sessions WHERE id = ? AND company_id = ?`
    ).get(session_id, cid);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session.status !== 'OPEN') {
      return res.status(400).json({ error: 'الجلسة ليست مفتوحة — لا يمكن إضافة إنتاج' });
    }

    // If worker_id supplied it must match the session's worker
    if (worker_id && parseInt(worker_id) !== session.artisan_id) {
      return res.status(403).json({ error: 'worker_id لا يطابق عامل الجلسة' });
    }

    const color = db.prepare(
      `SELECT id, internal_ar_name FROM color_master WHERE id = ? AND company_id = ?`
    ).get(color_id, cid);
    if (!color) return res.status(404).json({ error: 'اللون غير موجود في color_master' });

    const result = db.transaction(() => {
      // Insert production line (combinations = 0 for direct-kg entries)
      const lineR = db.prepare(`
        INSERT INTO production_lines
          (session_id, color_id, combinations, bobbins_consumed, actual_kg_produced, company_id)
        VALUES (?, ?, 0, 0, ?, ?)
      `).run(session_id, color_id, kgVal, cid);

      // Recalculate session totals
      _recalcSession(session_id, cid);

      // Find or create wholesale_kg inventory row for this color and create movement
      const wholesaleWh = db.prepare(
        `SELECT id FROM warehouses WHERE inventory_stage = 'wholesale_kg' AND company_id = ? LIMIT 1`
      ).get(cid);

      let inventoryId = null;
      if (wholesaleWh) {
        const colorDesc = color.internal_ar_name || `color_master:${color_id}`;
        let inv = db.prepare(`
          SELECT id FROM inventory
          WHERE warehouse_id = ? AND inventory_stage = 'wholesale_kg'
            AND color_description = ? AND company_id = ?
        `).get(wholesaleWh.id, colorDesc, cid);

        if (!inv) {
          const defaultPt = db.prepare(
            `SELECT id FROM product_types WHERE company_id = ? LIMIT 1`
          ).get(cid);
          if (defaultPt) {
            const ins = db.prepare(`
              INSERT INTO inventory
                (warehouse_id, product_type_id, color_description, inventory_stage,
                 quantity, unit_cost, unit_price, company_id)
              VALUES (?, ?, ?, 'wholesale_kg', 0, 0, 0, ?)
            `).run(wholesaleWh.id, defaultPt.id, colorDesc, cid);
            inv = { id: ins.lastInsertRowid };
          }
        }

        if (inv) {
          db.prepare(`UPDATE inventory SET quantity = quantity + ? WHERE id = ? AND company_id = ?`)
            .run(kgVal, inv.id, cid);
          db.prepare(`
            INSERT INTO inventory_movements
              (inventory_id, movement_type, quantity, reference_type, reference_id, notes, created_by, company_id)
            VALUES (?, 'MANUFACTURING_OUTPUT', ?, 'production_entry', ?, ?, 'system', ?)
          `).run(inv.id, kgVal, lineR.lastInsertRowid,
                 `إنتاج جلسة #${session_id} — ${colorDesc}`, cid);
          inventoryId = inv.id;
        }
      }

      return { line_id: lineR.lastInsertRowid, inventory_id: inventoryId };
    })();

    res.status(201).json({ success: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/manufacturing/settlement
// Closes the session (if open), calculates total kg × rate,
// records a worker_transaction, and updates artisan account_balance.
router.post('/manufacturing/settlement', (req, res) => {
  try {
    const cid = req.company_id;
    const { session_id, rate_override } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id مطلوب' });

    const session = db.prepare(`
      SELECT ps.*, ar.rate_per_combination, a.name AS worker_name
      FROM production_sessions ps
      LEFT JOIN artisan_rates ar ON ar.artisan_id = ps.artisan_id AND ar.company_id = ps.company_id
      LEFT JOIN artisans a       ON a.id = ps.artisan_id AND a.company_id = ps.company_id
      WHERE ps.id = ? AND ps.company_id = ?
    `).get(session_id, cid);
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session.status === 'APPROVED') {
      return res.status(400).json({ error: 'الجلسة معتمدة بالفعل — لا يمكن التسوية' });
    }

    // Total kg from all production lines in this session
    const totalKg = db.prepare(`
      SELECT COALESCE(SUM(actual_kg_produced), 0) AS total_kg
      FROM production_lines WHERE session_id = ? AND company_id = ?
    `).get(session_id, cid).total_kg;

    const rate         = rate_override != null ? parseFloat(rate_override) : (session.rate_per_combination || 0);
    const totalPayment = parseFloat((totalKg * rate).toFixed(2));
    const now          = new Date().toISOString();

    db.transaction(() => {
      // Close session if still open
      if (session.status === 'OPEN') {
        db.prepare(`
          UPDATE production_sessions
          SET status = 'CLOSED', closed_at = ?
          WHERE id = ? AND company_id = ?
        `).run(now, session_id, cid);
      }

      // Record worker transaction
      if (totalPayment > 0) {
        db.prepare(`
          INSERT INTO worker_transactions
            (worker_id, session_id, type, kg, rate, amount, description,
             reference_type, reference_id, company_id, branch_id)
          VALUES (?, ?, 'earning', ?, ?, ?, ?, 'production_settlement', ?, ?, ?)
        `).run(
          session.artisan_id, session_id,
          totalKg, rate, totalPayment,
          `تسوية جلسة #${session_id} — ${session.worker_name || 'عامل'}`,
          session_id, cid, session.branch_id
        );

        // Update artisan running balance
        db.prepare(`
          UPDATE artisans SET account_balance = account_balance + ? WHERE id = ? AND company_id = ?
        `).run(totalPayment, session.artisan_id, cid);
      }
    })();

    res.json({
      success: true,
      session_id,
      worker_id:     session.artisan_id,
      worker_name:   session.worker_name,
      total_kg:      totalKg,
      rate,
      total_payment: totalPayment,
      status:        'CLOSED'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/manufacturing/today
// Today's production dashboard: total kg, active workers, per-color breakdown.
router.get('/manufacturing/today', (req, res) => {
  try {
    const cid   = req.company_id;
    const today = new Date().toISOString().split('T')[0];

    const totalKg = db.prepare(`
      SELECT COALESCE(SUM(pl.actual_kg_produced), 0) AS total_kg
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      WHERE pl.company_id = ? AND ps.session_date = ?
    `).get(cid, today).total_kg;

    const activeWorkers = db.prepare(`
      SELECT COUNT(DISTINCT artisan_id) AS cnt
      FROM production_sessions
      WHERE company_id = ? AND session_date = ? AND status = 'OPEN'
    `).get(cid, today).cnt;

    const perColor = db.prepare(`
      SELECT
        cm.id                                    AS color_id,
        cm.supplier_color_code,
        cm.internal_ar_name                      AS color_name,
        COALESCE(cf.family_name_ar, '—')         AS family_name,
        ROUND(SUM(pl.actual_kg_produced), 3)     AS kg_today
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      JOIN color_master cm        ON cm.id = pl.color_id   AND cm.company_id = pl.company_id
      LEFT JOIN color_families cf ON cf.id = cm.family_id  AND cf.company_id = cm.company_id
      WHERE pl.company_id = ? AND ps.session_date = ?
      GROUP BY pl.color_id
      ORDER BY kg_today DESC
    `).all(cid, today);

    const sessionSummary = db.prepare(`
      SELECT status, COUNT(*) AS cnt
      FROM production_sessions
      WHERE company_id = ? AND session_date = ?
      GROUP BY status
    `).all(cid, today);

    res.json({
      date:           today,
      total_kg:       totalKg,
      active_workers: activeWorkers,
      per_color:      perColor,
      sessions:       sessionSummary
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/manufacturing/worker/:id
// Per-worker summary: open session, today's kg, recent sessions, transactions.
router.get('/manufacturing/worker/:id', (req, res) => {
  try {
    const cid   = req.company_id;
    const { id } = req.params;
    const today = new Date().toISOString().split('T')[0];

    const worker = db.prepare(
      `SELECT id, name, code, account_balance, active FROM artisans WHERE id = ? AND company_id = ?`
    ).get(id, cid);
    if (!worker) return res.status(404).json({ error: 'العامل غير موجود' });

    const openSession = db.prepare(`
      SELECT id, session_date, total_combinations, calculated_labor_cost, final_labor_cost, started_at
      FROM production_sessions
      WHERE artisan_id = ? AND company_id = ? AND status = 'OPEN'
      LIMIT 1
    `).get(id, cid);

    const todayKg = db.prepare(`
      SELECT COALESCE(SUM(pl.actual_kg_produced), 0) AS kg
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      WHERE ps.artisan_id = ? AND pl.company_id = ? AND ps.session_date = ?
    `).get(id, cid, today).kg;

    const recentSessions = db.prepare(`
      SELECT
        ps.id, ps.session_date, ps.status,
        ps.total_combinations, ps.final_labor_cost,
        ps.started_at, ps.closed_at,
        COALESCE(SUM(pl.actual_kg_produced), 0) AS total_kg
      FROM production_sessions ps
      LEFT JOIN production_lines pl ON pl.session_id = ps.id AND pl.company_id = ps.company_id
      WHERE ps.artisan_id = ? AND ps.company_id = ?
      GROUP BY ps.id
      ORDER BY ps.session_date DESC, ps.id DESC
      LIMIT 10
    `).all(id, cid);

    const transactions = db.prepare(`
      SELECT * FROM worker_transactions
      WHERE worker_id = ? AND company_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(id, cid);

    res.json({
      worker,
      open_session:    openSession || null,
      today_kg:        todayKg,
      recent_sessions: recentSessions,
      transactions
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
