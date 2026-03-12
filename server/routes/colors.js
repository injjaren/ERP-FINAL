'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { crudWithAudit, logAudit, MASTER_COLOR_WRITE_BRANCH } = require('../utils');

// crudWithAudit instance for legacy color codes
const colorCodes = crudWithAudit('color_codes');

// ============================================
// API ENDPOINTS - CANONICAL COLORS (v11)
// ============================================

router.get('/colors', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(`
      SELECT c.*, cf.family_name_ar
      FROM colors c
      JOIN color_families cf ON cf.id = c.family_id AND cf.company_id = c.company_id
      WHERE c.company_id = ?
      ORDER BY cf.display_order ASC, c.name_ar ASC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/colors', (req, res) => {
  try {
    const cid = req.company_id;
    const { family_id, name_ar, hex_code } = req.body;
    if (!family_id || !name_ar) return res.status(400).json({ error: 'family_id و name_ar مطلوبان' });
    const r = db.prepare(
      `INSERT INTO colors (family_id, name_ar, hex_code, company_id) VALUES (?, ?, ?, ?)`
    ).run(family_id, name_ar.trim(), hex_code || null, cid);
    res.status(201).json({ id: r.lastInsertRowid, family_id, name_ar: name_ar.trim(), hex_code: hex_code || null, company_id: cid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/colors/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { family_id, name_ar, hex_code } = req.body;
    const row = db.prepare(`SELECT id FROM colors WHERE id = ? AND company_id = ?`).get(req.params.id, cid);
    if (!row) return res.status(404).json({ error: 'اللون غير موجود' });
    db.prepare(`
      UPDATE colors SET
        family_id = COALESCE(?, family_id),
        name_ar   = COALESCE(?, name_ar),
        hex_code  = ?
      WHERE id = ? AND company_id = ?
    `).run(family_id ?? null, name_ar ?? null, hex_code ?? null, req.params.id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/colors/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const inUse = db.prepare(`SELECT COUNT(*) AS cnt FROM color_codes WHERE color_id = ? AND company_id = ?`).get(req.params.id, cid);
    if (inUse.cnt > 0) return res.status(400).json({ error: 'لا يمكن الحذف — مستخدم في أكواد ألوان' });
    db.prepare(`DELETE FROM colors WHERE id = ? AND company_id = ?`).run(req.params.id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// COLOR FAMILIES HIERARCHY (v11 — 2-tier)
// Returns: families → supplier_codes (with raw_bobbin + other inventory quantities)
// The intermediate `colors` table is internal only; not exposed in UI.
// ============================================
router.get('/color-families/hierarchy', (req, res) => {
  try {
    const cid = req.company_id;

    // 1. Families
    const families = db.prepare(
      `SELECT * FROM color_families WHERE company_id = ? ORDER BY display_order ASC, id ASC`
    ).all(cid);

    // 2. Supplier codes (color_master), resolved to family via color_id → colors.family_id
    const supplierCodes = db.prepare(`
      SELECT cm.id, cm.supplier_color_code AS code,
             cm.internal_ar_name, cm.hex_code, cm.shade_note, cm.active,
             cm.supplier_id, cm.color_id,
             s.name AS supplier_name,
             COALESCE(c.family_id, 0) AS family_id
      FROM color_master cm
      LEFT JOIN colors c ON c.id = cm.color_id AND c.company_id = cm.company_id
      LEFT JOIN suppliers s ON s.id = cm.supplier_id AND s.company_id = cm.company_id
      WHERE cm.company_id = ?
      ORDER BY cm.internal_ar_name ASC
    `).all(cid);

    // 3. Inventory quantities per color_id (raw_bobbin + other stages)
    const invRows = db.prepare(`
      SELECT cc.color_id,
             SUM(CASE WHEN inv.inventory_stage = 'raw_bobbin' THEN inv.quantity ELSE 0 END) AS raw_bobbin_qty,
             SUM(CASE WHEN inv.inventory_stage != 'raw_bobbin' THEN inv.quantity ELSE 0 END) AS other_qty
      FROM color_codes cc
      JOIN inventory inv ON inv.color_code_id = cc.id AND inv.company_id = cc.company_id
      WHERE cc.company_id = ?
      GROUP BY cc.color_id
    `).all(cid);

    const invMap = {};
    invRows.forEach(r => { if (r.color_id) invMap[r.color_id] = r; });

    // Assemble: supplier codes → families (by family_id)
    const scMap = {};
    supplierCodes.forEach(sc => {
      const inv = invMap[sc.color_id] || {};
      sc.raw_bobbin_qty = inv.raw_bobbin_qty || 0;
      sc.other_qty      = inv.other_qty      || 0;
      const famId = sc.family_id || 0;
      if (!scMap[famId]) scMap[famId] = [];
      scMap[famId].push(sc);
    });

    res.json(families.map(f => ({ ...f, supplier_codes: scMap[f.id] || [] })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - COLOR CODES
// ============================================

router.get('/color-codes', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(`
      SELECT cc.*, c.name_ar AS color_name_ar, cf.family_name_ar
      FROM color_codes cc
      LEFT JOIN colors c ON c.id = cc.color_id AND c.company_id = cc.company_id
      LEFT JOIN color_families cf ON cf.id = c.family_id AND cf.company_id = c.company_id
      WHERE cc.company_id = ?
      ORDER BY cc.code ASC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/color-codes', (req, res) => {
  try {
    // ── Color-control gate: only الجملة branch may create legacy color_codes entries ──
    if (req.body.branch !== MASTER_COLOR_WRITE_BRANCH) {
      return res.status(403).json({
        error: `الفرع "${req.body.branch || '(غير محدد)'}" لا يملك صلاحية إنشاء رموز ألوان — مسموح لفرع "${MASTER_COLOR_WRITE_BRANCH}" فقط`,
        allowed_branch: MASTER_COLOR_WRITE_BRANCH,
        provided_branch: req.body.branch || null
      });
    }
    const result = colorCodes.create(req.body, req.body.user || 'system', req.company_id);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/color-codes/:id', (req, res) => {
  try {
    colorCodes.update(req.params.id, req.body, req.body.user || 'system', req.body.reason, req.company_id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/color-codes/:id', (req, res) => {
  try {
    colorCodes.delete(req.params.id, req.body.user || 'system', req.body.reason, req.company_id);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// API ENDPOINTS - MASTER COLOR CATALOG v6
// Global catalog scoped by company_id.
// CREATE restricted to branch "الجملة".
// UPDATE triggers per-field audit log for shade_name / color_family / hex_code / is_active.
// ============================================

// MASTER_COLOR_WRITE_BRANCH is defined at top-level (see COLOR CONTROL POLICY block)

// GET /api/master-colors — list (optionally filter by is_active)
router.get('/master-colors', (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = `SELECT * FROM master_colors WHERE company_id = ?`;
    const params = [req.company_id];
    if (is_active !== undefined) {
      sql += ` AND is_active = ?`;
      params.push(Number(is_active));
    }
    sql += ` ORDER BY color_family, shade_name`;
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/master-colors/:id — single record
router.get('/master-colors/:id', (req, res) => {
  try {
    const row = db.prepare(
      `SELECT * FROM master_colors WHERE id = ? AND company_id = ?`
    ).get(req.params.id, req.company_id);
    if (!row) return res.status(404).json({ error: 'اللون غير موجود' });
    res.json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/master-colors — CREATE (only branch "الجملة" is authorized)
router.post('/master-colors', (req, res) => {
  try {
    const { color_code, color_family, shade_name, hex_code, is_active, user, branch } = req.body;

    // ── Branch authorization guard ─────────────────────────────────────────
    if (branch !== MASTER_COLOR_WRITE_BRANCH) {
      return res.status(403).json({
        error: `الفرع "${branch || '(غير محدد)'}" لا يملك صلاحية إضافة ألوان رئيسية — مسموح لفرع "${MASTER_COLOR_WRITE_BRANCH}" فقط`,
        allowed_branch: MASTER_COLOR_WRITE_BRANCH,
        provided_branch: branch || null
      });
    }

    // ── Required-field validation ──────────────────────────────────────────
    if (!color_code || !color_family || !shade_name) {
      return res.status(400).json({ error: 'color_code و color_family و shade_name إلزامية' });
    }

    const result = db.prepare(`
      INSERT INTO master_colors (color_code, color_family, shade_name, hex_code, is_active, company_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      color_code.trim().toUpperCase(),
      color_family.trim(),
      shade_name.trim(),
      hex_code  || null,
      is_active ?? 1,
      req.company_id
    );

    logAudit('master_colors', result.lastInsertRowid, 'create', null,
      { color_code, color_family, shade_name, hex_code, is_active, branch },
      user || 'system');

    res.status(201).json({
      id:           result.lastInsertRowid,
      color_code:   color_code.trim().toUpperCase(),
      color_family: color_family.trim(),
      shade_name:   shade_name.trim(),
      hex_code:     hex_code || null,
      is_active:    is_active ?? 1,
      company_id:   req.company_id
    });
  } catch (err) {
    // UNIQUE constraint violation produces a helpful message
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: `رمز اللون "${req.body.color_code}" موجود مسبقاً في هذه الشركة` });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/master-colors/:id — UPDATE with per-field audit log
// Write-gated: only MASTER_COLOR_WRITE_BRANCH may mutate the color catalog
router.put('/master-colors/:id', (req, res) => {
  try {
    const { color_family, shade_name, hex_code, is_active, user, reason, branch } = req.body;

    // ── Branch authorization guard ─────────────────────────────────────────
    if (branch !== MASTER_COLOR_WRITE_BRANCH) {
      return res.status(403).json({
        error: `الفرع "${branch || '(غير محدد)'}" لا يملك صلاحية تعديل الألوان الرئيسية — مسموح لفرع "${MASTER_COLOR_WRITE_BRANCH}" فقط`,
        allowed_branch: MASTER_COLOR_WRITE_BRANCH,
        provided_branch: branch || null
      });
    }

    const old = db.prepare(
      `SELECT * FROM master_colors WHERE id = ? AND company_id = ?`
    ).get(req.params.id, req.company_id);
    if (!old) return res.status(404).json({ error: 'اللون غير موجود' });

    // ── Build dynamic SET clause ───────────────────────────────────────────
    const updates = [];
    const vals    = [];
    if (color_family !== undefined) { updates.push('color_family = ?'); vals.push(color_family); }
    if (shade_name   !== undefined) { updates.push('shade_name   = ?'); vals.push(shade_name);   }
    if (hex_code     !== undefined) { updates.push('hex_code     = ?'); vals.push(hex_code);     }
    if (is_active    !== undefined) { updates.push('is_active    = ?'); vals.push(is_active);    }
    if (updates.length === 0) return res.status(400).json({ error: 'لا توجد حقول للتحديث' });

    updates.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(req.params.id, req.company_id);

    db.prepare(
      `UPDATE master_colors SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`
    ).run(...vals);

    // ── Field-level audit: only log the 4 tracked fields when they actually change ──
    const AUDITED = ['shade_name', 'color_family', 'hex_code', 'is_active'];
    const changes = {};
    AUDITED.forEach(f => {
      if (req.body[f] !== undefined && String(req.body[f]) !== String(old[f])) {
        changes[f] = { from: old[f], to: req.body[f] };
      }
    });
    if (Object.keys(changes).length > 0) {
      logAudit('master_colors', req.params.id, 'update',
        old,
        { changes, updated_by: user || 'system' },
        user || 'system',
        reason || '');
    }

    res.json({ id: Number(req.params.id), ...old, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/master-colors/:id — hard delete, admin only
router.delete('/master-colors/:id', (req, res) => {
  try {
    const { user, reason } = req.body;
    if (user !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const old = db.prepare(
      `SELECT * FROM master_colors WHERE id = ? AND company_id = ?`
    ).get(req.params.id, req.company_id);
    if (!old) return res.status(404).json({ error: 'اللون غير موجود' });

    db.prepare(
      `DELETE FROM master_colors WHERE id = ? AND company_id = ?`
    ).run(req.params.id, req.company_id);

    logAudit('master_colors', req.params.id, 'delete', old, null, user, reason || '');
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// ERP-v9: COLOR FAMILIES API
// ============================================
router.get('/color-families', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(
      `SELECT * FROM color_families WHERE company_id = ? ORDER BY display_order ASC, id ASC`
    ).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/color-families', (req, res) => {
  try {
    const cid = req.company_id;
    const { family_name_ar, display_order = 0, active = 1 } = req.body;
    if (!family_name_ar) return res.status(400).json({ error: 'family_name_ar required' });
    const r = db.prepare(
      `INSERT INTO color_families (family_name_ar, display_order, active, company_id) VALUES (?,?,?,?)`
    ).run(family_name_ar.trim(), display_order, active, cid);
    res.json({ id: r.lastInsertRowid, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/color-families/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const { family_name_ar, display_order, active } = req.body;
    const row = db.prepare(`SELECT id FROM color_families WHERE id = ? AND company_id = ?`).get(id, cid);
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.prepare(
      `UPDATE color_families SET family_name_ar = COALESCE(?,family_name_ar),
       display_order = COALESCE(?,display_order), active = COALESCE(?,active) WHERE id = ? AND company_id = ?`
    ).run(family_name_ar ?? null, display_order ?? null, active ?? null, id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/color-families/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    // Check color_master legacy FK
    const usedByCM = db.prepare(
      `SELECT COUNT(*) AS cnt FROM color_master WHERE family_id = ? AND company_id = ?`
    ).get(id, cid);
    if (usedByCM.cnt > 0) return res.status(400).json({ error: 'لا يمكن الحذف — مستخدمة في أكواد ألوان' });
    // Check canonical colors table (v11 FK)
    const usedByColors = db.prepare(
      `SELECT COUNT(*) AS cnt FROM colors WHERE family_id = ? AND company_id = ?`
    ).get(id, cid);
    if (usedByColors.cnt > 0) return res.status(400).json({ error: 'لا يمكن الحذف — توجد ألوان مرتبطة بهذه العائلة. احذف الأكواد أولاً.' });
    db.prepare(`DELETE FROM color_families WHERE id = ? AND company_id = ?`).run(id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// ERP-v9: COLOR MASTER API
// ============================================
router.get('/color-master', (req, res) => {
  try {
    const cid = req.company_id;
    const { q, family_id, active } = req.query;
    let sql = `
      SELECT cm.*, cf.family_name_ar, s.name AS supplier_name
      FROM color_master cm
      LEFT JOIN color_families cf ON cf.id = cm.family_id AND cf.company_id = cm.company_id
      LEFT JOIN suppliers s ON s.id = cm.supplier_id AND s.company_id = cm.company_id
      WHERE cm.company_id = ?
    `;
    const params = [cid];
    if (family_id) { sql += ` AND cm.family_id = ?`; params.push(family_id); }
    if (active !== undefined) { sql += ` AND cm.active = ?`; params.push(active); }
    if (q) {
      sql += ` AND (cm.internal_ar_name LIKE ? OR cm.supplier_color_code LIKE ? OR cm.shade_note LIKE ?)`;
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ` ORDER BY cf.display_order ASC, cm.internal_ar_name ASC`;
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/color-master', (req, res) => {
  try {
    const cid = req.company_id;
    const { supplier_id, supplier_color_code, internal_ar_name, shade_note, family_id, hex_code, active = 1 } = req.body;
    let { color_id } = req.body;
    if (!supplier_color_code || !internal_ar_name) {
      return res.status(400).json({ error: 'supplier_color_code و internal_ar_name مطلوبان' });
    }
    // Auto-create/find canonical colors entry if family_id provided but no color_id
    if (!color_id && family_id) {
      let colRow = db.prepare(
        'SELECT id FROM colors WHERE name_ar = ? AND family_id = ? AND company_id = ?'
      ).get(internal_ar_name.trim(), family_id, cid);
      if (!colRow) {
        const cr = db.prepare(
          'INSERT INTO colors (family_id, name_ar, hex_code, company_id) VALUES (?, ?, ?, ?)'
        ).run(parseInt(family_id), internal_ar_name.trim(), hex_code || null, cid);
        color_id = cr.lastInsertRowid;
      } else {
        color_id = colRow.id;
      }
    }
    const r = db.prepare(`
      INSERT INTO color_master (supplier_id, supplier_color_code, internal_ar_name, shade_note, family_id, hex_code, active, company_id, color_id)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(supplier_id || null, supplier_color_code.trim(), internal_ar_name.trim(),
           shade_note || null, family_id || null, hex_code || null, active, cid, color_id || null);

    // Also ensure a color_codes entry exists (for inventory.color_code_id linkage)
    let ccRow = db.prepare('SELECT id FROM color_codes WHERE code = ? AND company_id = ?').get(supplier_color_code.trim(), cid);
    if (!ccRow) {
      const ccr = db.prepare(
        `INSERT INTO color_codes (code, main_color, shade, active, company_id, color_id) VALUES (?, ?, ?, 1, ?, ?)`
      ).run(supplier_color_code.trim(), internal_ar_name.trim(), shade_note || null, cid, color_id || null);
      ccRow = { id: ccr.lastInsertRowid };
    }

    res.json({ id: r.lastInsertRowid, color_code_id: ccRow.id, success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود اللون موجود مسبقاً لهذا المورد' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/color-master/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const row = db.prepare(`SELECT id FROM color_master WHERE id = ? AND company_id = ?`).get(id, cid);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { supplier_id, supplier_color_code, internal_ar_name, shade_note, family_id, hex_code, active } = req.body;
    db.prepare(`
      UPDATE color_master SET
        supplier_id         = COALESCE(?, supplier_id),
        supplier_color_code = COALESCE(?, supplier_color_code),
        internal_ar_name    = COALESCE(?, internal_ar_name),
        shade_note          = ?,
        family_id           = COALESCE(?, family_id),
        hex_code            = ?,
        active              = COALESCE(?, active)
      WHERE id = ? AND company_id = ?
    `).run(supplier_id ?? null, supplier_color_code ?? null, internal_ar_name ?? null,
           shade_note ?? null, family_id ?? null, hex_code ?? null, active ?? null, id, cid);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'كود اللون موجود مسبقاً لهذا المورد' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/color-master/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { id } = req.params;
    const inUse = db.prepare(
      `SELECT COUNT(*) AS cnt FROM production_lines WHERE color_id = ? AND company_id = ?`
    ).get(id, cid);
    if (inUse.cnt > 0) return res.status(400).json({ error: 'لا يمكن الحذف — مستخدم في جلسات إنتاج' });
    db.prepare(`DELETE FROM color_master WHERE id = ? AND company_id = ?`).run(id, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
