'use strict';
const router = require('express').Router();
const { db } = require('../../database');

// Colors below zero inventory report (wholesale only)
router.get('/manufacturing/colors-below-zero', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(`
      SELECT i.id, i.quantity, i.product_type_id,
             pt.name AS product_name,
             cm.internal_ar_name AS color_name, cm.supplier_color_code, cm.hex_code,
             cf.family_name_ar,
             w.name AS warehouse_name
      FROM inventory i
      JOIN warehouses w      ON w.id = i.warehouse_id AND w.company_id = i.company_id
      JOIN product_types pt  ON pt.id = i.product_type_id AND pt.company_id = i.company_id
      LEFT JOIN color_master cm ON cm.id = i.color_code_id AND cm.company_id = i.company_id
      LEFT JOIN color_families cf ON cf.id = cm.family_id AND cf.company_id = cm.company_id
      WHERE i.company_id = ? AND i.quantity < 0
      ORDER BY i.quantity ASC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// ERP-v9: UNIFIED COLOR INVENTORY OVERVIEW (v2 — extended)
// GET /api/manufacturing/colors-overview
// total_kg    = sum of actual_kg_produced from CLOSED sessions
// reserved_kg = sum of actual_kg_produced from OPEN sessions
// available_kg = total_kg - reserved_kg
// status: in_production | active | idle | dead
// ============================================================
const _COV_ALLOWED_SORTS = new Set([
  'supplier_color_code', 'arabic_name', 'family_name',
  'total_kg', 'reserved_kg', 'available_kg',
  'bobbins_purchased', 'bobbins_consumed', 'bobbins_remaining',
  'kg_produced', 'kg_sold', 'kg_remaining',
  'days_since_activity', 'status', 'last_session_date', 'is_low_stock'
]);
const _COV_LOW_STOCK_KG = 5;

router.get('/manufacturing/colors-overview', (req, res) => {
  try {
    const cid = req.company_id;

    // ── query params ────────────────────────────────────────
    const q        = (req.query.q || '').trim();
    const sortRaw  = req.query.sort || 'available_kg';
    const sort     = _COV_ALLOWED_SORTS.has(sortRaw) ? sortRaw : 'available_kg';
    const order    = (req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const page     = Math.max(1, parseInt(req.query.page)    || 1);
    const perPage  = Math.min(200, Math.max(10, parseInt(req.query.per_page) || 50));
    const offset   = (page - 1) * perPage;
    const daysRaw  = parseInt(req.query.days) || 0;
    const days     = [30, 60, 90, 180, 365].includes(daysRaw) ? daysRaw : 0;
    const statusF  = ['active', 'idle', 'dead', 'in_production'].includes(req.query.status)
                     ? req.query.status : '';
    const branchId = parseInt(req.query.branch_id) || 0;

    // ── CTE: aggregate session stock per color ───────────────
    // v14: CLOSED sessions are the committed state (APPROVED removed)
    const cteSql = `
      WITH session_stock AS (
        SELECT
          pl.color_id,
          pl.company_id,
          SUM(CASE WHEN ps.status='CLOSED' AND pl.line_status='completed' THEN COALESCE(pl.actual_kg_produced,0) ELSE 0 END) AS total_kg,
          SUM(CASE WHEN ps.status='OPEN'   AND pl.line_status='completed' THEN COALESCE(pl.actual_kg_produced,0) ELSE 0 END) AS reserved_kg,
          SUM(CASE WHEN ps.status IN ('OPEN','CLOSED') THEN COALESCE(pl.bobbins_consumed,0) ELSE 0 END)                      AS bobbins_consumed,
          MAX(CASE WHEN ps.status='OPEN' THEN 1 ELSE 0 END) AS has_open_session,
          MAX(ps.session_date) AS last_session_date
        FROM production_lines pl
        JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
        WHERE pl.company_id = ?${branchId ? ' AND ps.branch_id = ?' : ''}
        GROUP BY pl.color_id, pl.company_id
      )`;
    const cteParams = branchId ? [cid, branchId] : [cid];

    // ── base WHERE (q + days, no status filter) ──────────────
    const baseWhereParts  = ['cm.company_id = ?', 'cm.active = 1'];
    const baseWhereParams = [cid];
    if (q) {
      baseWhereParts.push('(cm.supplier_color_code LIKE ? OR cm.internal_ar_name LIKE ? OR cf.family_name_ar LIKE ?)');
      const like = `%${q}%`;
      baseWhereParams.push(like, like, like);
    }
    if (days > 0) {
      baseWhereParts.push(`ss.last_session_date IS NOT NULL AND (julianday('now')-julianday(ss.last_session_date)) <= ?`);
      baseWhereParams.push(days);
    }

    // ── status filter parts (no extra SQL params) ─────────────
    // v14: in_production = OPEN session exists; active = closed recently
    const statusWhereParts = [];
    if (statusF === 'in_production') {
      statusWhereParts.push(`COALESCE(ss.has_open_session,0) = 1`);
    } else if (statusF === 'active') {
      statusWhereParts.push(`COALESCE(ss.has_open_session,0)=0 AND ss.last_session_date IS NOT NULL AND (julianday('now')-julianday(ss.last_session_date))<=30`);
    } else if (statusF === 'idle') {
      statusWhereParts.push(`COALESCE(ss.has_open_session,0)=0 AND ss.last_session_date IS NOT NULL AND (julianday('now')-julianday(ss.last_session_date))>30`);
    } else if (statusF === 'dead') {
      statusWhereParts.push(`ss.last_session_date IS NULL`);
    }

    const baseWhere = baseWhereParts.join(' AND ');
    const fullWhere = [...baseWhereParts, ...statusWhereParts].join(' AND ');

    const joins = `
      FROM color_master cm
      LEFT JOIN color_families cf ON cf.id = cm.family_id AND cf.company_id = cm.company_id
      LEFT JOIN session_stock ss  ON ss.color_id = cm.id AND ss.company_id = cm.company_id`;

    // ── summary query (base filter only — counts all statuses) ─
    const summarySql = `
      ${cteSql}
      SELECT
        SUM(CASE WHEN COALESCE(ss.has_open_session,0)=1 THEN 1 ELSE 0 END) AS in_production_count,
        SUM(CASE WHEN COALESCE(ss.has_open_session,0)=0 AND ss.last_session_date IS NOT NULL
                  AND (julianday('now')-julianday(ss.last_session_date))<=30 THEN 1 ELSE 0 END) AS active_count,
        SUM(CASE WHEN COALESCE(ss.has_open_session,0)=0 AND ss.last_session_date IS NOT NULL
                  AND (julianday('now')-julianday(ss.last_session_date))>30  THEN 1 ELSE 0 END) AS idle_count,
        SUM(CASE WHEN ss.last_session_date IS NULL THEN 1 ELSE 0 END) AS dead_count,
        ROUND(SUM(COALESCE(ss.total_kg,0)-COALESCE(ss.reserved_kg,0)),3) AS total_available_kg,
        SUM(CASE WHEN (COALESCE(ss.total_kg,0)-COALESCE(ss.reserved_kg,0)) < ${_COV_LOW_STOCK_KG}
                  AND COALESCE(ss.total_kg,0)>0 THEN 1 ELSE 0 END) AS low_stock_count
      ${joins}
      WHERE ${baseWhere}`;

    // ── count query (full filter incl. status) ────────────────
    const countSql = `${cteSql} SELECT COUNT(*) AS cnt ${joins} WHERE ${fullWhere}`;

    // ── data query — Rule 10: 6 color intelligence metrics ───────────────────
    // bobbins_purchased: SUM from inventory (raw_bobbin stage) via color linkage
    // bobbins_consumed:  SUM from production_lines (completed sessions)
    // bobbins_remaining: purchased - consumed
    // kg_produced:       SUM from closed session lines
    // kg_sold:           SUM from sales_items (by color_code_id linkage)
    // kg_remaining:      kg_produced - kg_sold
    const dataSql = `
      ${cteSql}
      SELECT
        cm.id,
        cm.supplier_color_code,
        cm.internal_ar_name                                            AS arabic_name,
        cm.hex_code,
        COALESCE(cf.family_name_ar,'—')                               AS family_name,
        ROUND(COALESCE(ss.total_kg,0),3)                              AS total_kg,
        ROUND(COALESCE(ss.reserved_kg,0),3)                           AS reserved_kg,
        ROUND(COALESCE(ss.total_kg,0)-COALESCE(ss.reserved_kg,0),3)  AS available_kg,
        COALESCE(ss.has_open_session,0)                               AS has_open_session,
        ss.last_session_date,
        CASE WHEN ss.last_session_date IS NULL THEN NULL
             ELSE CAST(julianday('now')-julianday(ss.last_session_date) AS INTEGER)
        END AS days_since_activity,
        CASE
          WHEN COALESCE(ss.has_open_session,0)=1 THEN 'in_production'
          WHEN ss.last_session_date IS NOT NULL AND (julianday('now')-julianday(ss.last_session_date))<=30 THEN 'active'
          WHEN ss.last_session_date IS NOT NULL THEN 'idle'
          ELSE 'dead'
        END AS status,
        CASE WHEN (COALESCE(ss.total_kg,0)-COALESCE(ss.reserved_kg,0)) < ${_COV_LOW_STOCK_KG}
                  AND COALESCE(ss.total_kg,0)>0 THEN 1 ELSE 0 END AS is_low_stock,
        -- Rule 10: 6 metrics
        COALESCE((
          SELECT ROUND(SUM(i.quantity + COALESCE(im_out.qty_out,0)),3)
          FROM inventory i
          JOIN color_codes cc ON cc.id = i.color_code_id AND cc.company_id = i.company_id
          LEFT JOIN (
            SELECT inventory_id, SUM(quantity) AS qty_out
            FROM inventory_movements WHERE movement_type='out' AND reference_type='session_close' AND company_id=cm.company_id
            GROUP BY inventory_id
          ) im_out ON im_out.inventory_id = i.id
          WHERE i.inventory_stage='raw_bobbin' AND i.company_id=cm.company_id
            AND cc.color_id = cm.color_id
        ),0)                                                           AS bobbins_purchased,
        ROUND(COALESCE(ss.bobbins_consumed,0),0)                      AS bobbins_consumed,
        COALESCE((
          SELECT ROUND(SUM(i.quantity + COALESCE(im_out.qty_out,0)),3) - COALESCE(ss.bobbins_consumed,0)
          FROM inventory i
          JOIN color_codes cc ON cc.id = i.color_code_id AND cc.company_id = i.company_id
          LEFT JOIN (
            SELECT inventory_id, SUM(quantity) AS qty_out
            FROM inventory_movements WHERE movement_type='out' AND reference_type='session_close' AND company_id=cm.company_id
            GROUP BY inventory_id
          ) im_out ON im_out.inventory_id = i.id
          WHERE i.inventory_stage='raw_bobbin' AND i.company_id=cm.company_id
            AND cc.color_id = cm.color_id
        ),0)                                                           AS bobbins_remaining,
        ROUND(COALESCE(ss.total_kg,0),3)                              AS kg_produced,
        COALESCE((
          SELECT ROUND(SUM(si.quantity),3)
          FROM sales_items si
          JOIN color_codes cc ON cc.id = si.color_code_id AND cc.company_id = si.company_id
          WHERE si.company_id=cm.company_id AND cc.color_id = cm.color_id
        ),0)                                                           AS kg_sold,
        ROUND(COALESCE(ss.total_kg,0) - COALESCE((
          SELECT SUM(si.quantity) FROM sales_items si
          JOIN color_codes cc ON cc.id = si.color_code_id AND cc.company_id = si.company_id
          WHERE si.company_id=cm.company_id AND cc.color_id = cm.color_id
        ),0),3)                                                        AS kg_remaining
      ${joins}
      WHERE ${fullWhere}
      ORDER BY ${sort} ${order}, cm.supplier_color_code ASC
      LIMIT ? OFFSET ?`;

    const summaryParams = [...cteParams, ...baseWhereParams];
    const countParams   = [...cteParams, ...baseWhereParams];
    const dataParams    = [...cteParams, ...baseWhereParams, perPage, offset];

    const summary = db.prepare(summarySql).get(...summaryParams);
    const total   = db.prepare(countSql).get(...countParams).cnt;
    const data    = db.prepare(dataSql).all(...dataParams);

    res.json({
      data, total, page,
      per_page: perPage,
      pages: Math.ceil(total / perPage),
      sort, order,
      summary: {
        active_count:        summary.active_count        || 0,
        idle_count:          summary.idle_count          || 0,
        dead_count:          summary.dead_count          || 0,
        in_production_count: summary.in_production_count || 0,
        total_available_kg:  summary.total_available_kg  || 0,
        low_stock_count:     summary.low_stock_count     || 0
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// PRODUCTION REPORTS
// GET /api/manufacturing/reports/by-worker
// GET /api/manufacturing/reports/by-color
// Both support ?from=&to= date filters (YYYY-MM-DD)
// Only APPROVED sessions are counted (official production).
// ============================================================

router.get('/manufacturing/reports/by-worker', (req, res) => {
  try {
    const cid = req.company_id;
    const { from, to } = req.query;
    let where = `ps.company_id = ? AND ps.status = 'CLOSED'`;
    const params = [cid];
    if (from) { where += ` AND ps.session_date >= ?`; params.push(from); }
    if (to)   { where += ` AND ps.session_date <= ?`; params.push(to); }

    const rows = db.prepare(`
      SELECT
        a.id              AS artisan_id,
        a.name            AS artisan_name,
        a.code            AS artisan_code,
        COUNT(DISTINCT ps.id)                                                                         AS total_sessions,
        SUM(COALESCE(pl.combinations, 0))                                                             AS total_combinations,
        SUM(CASE WHEN pl.line_status='completed' THEN COALESCE(pl.actual_kg_produced, 0) ELSE 0 END) AS total_kg,
        ROUND(SUM(CASE WHEN pl.line_status='completed' THEN COALESCE(pl.actual_kg_produced, 0) ELSE 0 END) / NULLIF(COUNT(DISTINCT ps.session_date), 0), 2) AS avg_kg_per_day,
        SUM(COALESCE(ps.final_labor_cost, 0))                                                         AS total_labor_cost
      FROM production_sessions ps
      JOIN artisans a        ON a.id = ps.artisan_id AND a.company_id = ps.company_id
      JOIN production_lines pl ON pl.session_id = ps.id AND pl.company_id = ps.company_id
      WHERE ${where}
      GROUP BY a.id, a.name, a.code
      ORDER BY total_kg DESC
    `).all(...params);

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/manufacturing/reports/by-color', (req, res) => {
  try {
    const cid = req.company_id;
    const { from, to } = req.query;
    let where = `ps.company_id = ? AND ps.status = 'CLOSED'`;
    const params = [cid];
    if (from) { where += ` AND ps.session_date >= ?`; params.push(from); }
    if (to)   { where += ` AND ps.session_date <= ?`; params.push(to); }

    const rows = db.prepare(`
      SELECT
        cm.id             AS color_id,
        cm.supplier_color_code,
        cm.internal_ar_name AS color_name,
        cm.hex_code,
        cf.family_name_ar,
        COUNT(DISTINCT ps.id)                                                                              AS total_sessions,
        SUM(COALESCE(pl.combinations, 0))                                                                  AS total_combinations,
        ROUND(SUM(CASE WHEN pl.line_status='completed' THEN COALESCE(pl.actual_kg_produced, 0) ELSE 0 END), 3) AS total_kg
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      JOIN color_master cm  ON cm.id = pl.color_id AND cm.company_id = pl.company_id
      LEFT JOIN color_families cf ON cf.id = cm.family_id AND cf.company_id = cm.company_id
      WHERE ${where}
      GROUP BY cm.id, cm.supplier_color_code, cm.internal_ar_name, cm.hex_code, cf.family_name_ar
      ORDER BY total_kg DESC
    `).all(...params);

    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// PRODUCTION DASHBOARD
// GET /api/manufacturing/dashboard
// Aggregates production totals (today / this week / this month)
// v14: uses CLOSED sessions (APPROVED removed from workflow)
// ============================================================
router.get('/manufacturing/dashboard', (req, res) => {
  try {
    const cid = req.company_id;

    // ── Period totals ────────────────────────────────────────
    const totals = db.prepare(`
      SELECT
        ROUND(SUM(CASE WHEN ps.session_date = DATE('now')                             THEN COALESCE(pl.actual_kg_produced,0) ELSE 0 END),2) AS today_kg,
        ROUND(SUM(CASE WHEN ps.session_date >= DATE('now','-6 days')                  THEN COALESCE(pl.actual_kg_produced,0) ELSE 0 END),2) AS week_kg,
        ROUND(SUM(CASE WHEN ps.session_date >= DATE('now','start of month')            THEN COALESCE(pl.actual_kg_produced,0) ELSE 0 END),2) AS month_kg,
        ROUND(SUM(COALESCE(pl.actual_kg_produced,0)),2)                                AS total_kg,
        COUNT(DISTINCT ps.id)                                                          AS total_sessions
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      WHERE pl.company_id = ? AND ps.status = 'CLOSED' AND pl.line_status = 'completed'
    `).get(cid);

    // ── Open sessions count ─────────────────────────────────
    const openCount = db.prepare(`
      SELECT COUNT(*) AS cnt FROM production_sessions
      WHERE company_id = ? AND status = 'OPEN'
    `).get(cid)?.cnt || 0;

    // ── Top 5 workers this month ────────────────────────────
    const topWorkers = db.prepare(`
      SELECT
        a.name                                                    AS artisan_name,
        a.code                                                    AS artisan_code,
        ROUND(SUM(COALESCE(pl.actual_kg_produced,0)),2)          AS month_kg,
        SUM(COALESCE(pl.combinations,0))                         AS month_combinations,
        COUNT(DISTINCT ps.id)                                    AS session_count
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      JOIN artisans a              ON a.id  = ps.artisan_id AND a.company_id  = ps.company_id
      WHERE pl.company_id = ? AND ps.status = 'CLOSED' AND pl.line_status = 'completed'
        AND ps.session_date >= DATE('now','start of month')
      GROUP BY a.id, a.name, a.code
      ORDER BY month_kg DESC
      LIMIT 5
    `).all(cid);

    // ── Top 5 colors this month ─────────────────────────────
    const topColors = db.prepare(`
      SELECT
        cm.supplier_color_code                                    AS color_code,
        cm.internal_ar_name                                       AS color_name,
        COALESCE(cm.hex_code,'')                                  AS hex_code,
        COALESCE(cf.family_name_ar,'—')                          AS family_name,
        ROUND(SUM(COALESCE(pl.actual_kg_produced,0)),2)          AS month_kg,
        SUM(COALESCE(pl.combinations,0))                         AS month_combinations
      FROM production_lines pl
      JOIN production_sessions ps ON ps.id = pl.session_id AND ps.company_id = pl.company_id
      JOIN color_master cm         ON cm.id = pl.color_id   AND cm.company_id = pl.company_id
      LEFT JOIN color_families cf  ON cf.id = cm.family_id  AND cf.company_id = cm.company_id
      WHERE pl.company_id = ? AND ps.status = 'CLOSED' AND pl.line_status = 'completed'
        AND ps.session_date >= DATE('now','start of month')
      GROUP BY cm.id, cm.supplier_color_code, cm.internal_ar_name, cm.hex_code, cf.family_name_ar
      ORDER BY month_kg DESC
      LIMIT 5
    `).all(cid);

    res.json({
      today_kg:        totals?.today_kg        || 0,
      week_kg:         totals?.week_kg         || 0,
      month_kg:        totals?.month_kg        || 0,
      total_kg:        totals?.total_kg        || 0,
      total_sessions:  totals?.total_sessions  || 0,
      open_sessions:   openCount,
      top_workers:     topWorkers,
      top_colors:      topColors
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
