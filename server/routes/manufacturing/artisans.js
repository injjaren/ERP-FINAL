'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { generateCode, logAudit } = require('../../utils');

// ============================================
// ARTISAN MANAGEMENT (v13)
// Full CRUD with branch assignment, active/inactive,
// and artisan rates for production sessions.
// ============================================

// GET /api/artisans — full fields including branch name and v9 rate
router.get('/artisans', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(`
      SELECT
        a.id, a.code, a.name, a.phone, a.address,
        a.craft_type, a.artisan_type,
        a.daily_expense, a.weekly_expense,
        a.account_balance, a.active,
        a.branch_id, b.name AS branch_name,
        ar.rate_per_kg, ar.rate_per_combination
      FROM artisans a
      LEFT JOIN branches b     ON b.id = a.branch_id
      LEFT JOIN artisan_rates ar ON ar.artisan_id = a.id AND ar.company_id = a.company_id
      WHERE a.company_id = ?
      ORDER BY a.active DESC, a.name ASC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/artisans — create with branch assignment
router.post('/artisans', (req, res) => {
  try {
    const cid = req.company_id;
    const { name, phone, address, craft_type, branch_id, daily_expense, weekly_expense } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الحرفي مطلوب' });
    const code = generateCode('artisans', cid);
    const result = db.prepare(`
      INSERT INTO artisans
        (code, name, phone, address, craft_type, branch_id, daily_expense, weekly_expense, active, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      code, name,
      phone    || null,
      address  || null,
      craft_type || null,
      branch_id  ? parseInt(branch_id) : null,
      daily_expense  ? parseFloat(daily_expense)  : null,
      weekly_expense ? parseFloat(weekly_expense) : null,
      cid
    );
    logAudit('artisans', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PUT /api/artisans/:id — update including branch assignment and active flag
router.put('/artisans/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { name, phone, address, craft_type, branch_id, daily_expense, weekly_expense, active } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الحرفي مطلوب' });
    db.prepare(`
      UPDATE artisans
      SET name=?, phone=?, address=?, craft_type=?, branch_id=?,
          daily_expense=?, weekly_expense=?, active=?
      WHERE id=? AND company_id=?
    `).run(
      name,
      phone    || null,
      address  || null,
      craft_type || null,
      branch_id  ? parseInt(branch_id) : null,
      daily_expense  ? parseFloat(daily_expense)  : null,
      weekly_expense ? parseFloat(weekly_expense) : null,
      active !== undefined ? parseInt(active) : 1,
      req.params.id, cid
    );
    logAudit('artisans', req.params.id, 'update', null, req.body, req.body.user || 'system');
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/artisans/:id/toggle-active — quick active/inactive toggle
router.patch('/artisans/:id/toggle-active', (req, res) => {
  try {
    const cid = req.company_id;
    const artisan = db.prepare('SELECT id, active FROM artisans WHERE id=? AND company_id=?').get(req.params.id, cid);
    if (!artisan) return res.status(404).json({ error: 'الحرفي غير موجود' });
    const newActive = artisan.active ? 0 : 1;
    db.prepare('UPDATE artisans SET active=? WHERE id=? AND company_id=?').run(newActive, req.params.id, cid);
    logAudit('artisans', req.params.id, newActive ? 'activate' : 'deactivate', null, null, req.body.user || 'system');
    res.json({ id: req.params.id, active: newActive });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/artisans/:id — soft delete (set active=0)
router.delete('/artisans/:id', (req, res) => {
  try {
    const cid = req.company_id;
    db.prepare('UPDATE artisans SET active=0 WHERE id=? AND company_id=?').run(req.params.id, cid);
    logAudit('artisans', req.params.id, 'delete', null, null, req.body.user || 'system');
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// ARTISAN RATES (v14: rate_per_kg — labor = kg × rate)
// ============================================

router.get('/artisan-rates', (req, res) => {
  try {
    const cid = req.company_id;
    const rows = db.prepare(`
      SELECT ar.id, ar.artisan_id, ar.rate_per_kg, ar.updated_at,
             a.name AS artisan_name, a.code AS artisan_code
      FROM artisan_rates ar
      JOIN artisans a ON a.id = ar.artisan_id AND a.company_id = ar.company_id
      WHERE ar.company_id = ?
      ORDER BY a.name ASC
    `).all(cid);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/artisan-rates', (req, res) => {
  try {
    const cid = req.company_id;
    const { artisan_id, rate_per_kg } = req.body;
    if (!artisan_id || rate_per_kg === undefined) {
      return res.status(400).json({ error: 'artisan_id و rate_per_kg مطلوبان' });
    }
    const rateVal = parseFloat(rate_per_kg);
    const r = db.prepare(`
      INSERT INTO artisan_rates (artisan_id, rate_per_kg, rate_per_combination, company_id, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(artisan_id, company_id) DO UPDATE SET
        rate_per_kg          = excluded.rate_per_kg,
        rate_per_combination = excluded.rate_per_combination,
        updated_at           = CURRENT_TIMESTAMP
    `).run(artisan_id, rateVal, rateVal, cid);
    res.json({ id: r.lastInsertRowid, success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/artisan-rates/:artisan_id', (req, res) => {
  try {
    const cid = req.company_id;
    const { artisan_id } = req.params;
    const { rate_per_kg } = req.body;
    if (rate_per_kg === undefined) return res.status(400).json({ error: 'rate_per_kg مطلوب' });
    const rateVal = parseFloat(rate_per_kg);
    db.prepare(`
      INSERT INTO artisan_rates (artisan_id, rate_per_kg, rate_per_combination, company_id, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(artisan_id, company_id) DO UPDATE SET
        rate_per_kg          = excluded.rate_per_kg,
        rate_per_combination = excluded.rate_per_combination,
        updated_at           = CURRENT_TIMESTAMP
    `).run(artisan_id, rateVal, rateVal, cid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
