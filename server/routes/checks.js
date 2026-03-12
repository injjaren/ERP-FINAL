'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { logAudit, addTreasuryEntry } = require('../utils');

// ============================================
// API ENDPOINTS - CHECKS
// ============================================

router.get('/portfolio', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM checks_portfolio WHERE company_id = ? ORDER BY due_date').all(req.company_id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/portfolio/available', (req, res) => {
  try { res.json(db.prepare(`SELECT * FROM checks_portfolio WHERE used_for_payment = 0 AND status = 'معلق' AND company_id = ? ORDER BY due_date`).all(req.company_id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/portfolio', (req, res) => {
  try {
    const { check_number, date, from_client, amount, due_date, bank, notes } = req.body;
    const result = db.prepare(`INSERT INTO checks_portfolio (check_number, date, from_client, amount, due_date, bank, notes, status, source, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, 'معلق', 'مستلم', ?)`).run(check_number, date, from_client, amount, due_date, bank, notes, req.company_id);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/portfolio/:id/deposit', (req, res) => {
  try {
    const cid = req.company_id;
    const check = db.prepare('SELECT * FROM checks_portfolio WHERE id = ? AND company_id = ?').get(req.params.id, cid);
    if (!check) return res.status(404).json({ error: 'Check not found' });
    const depositDate = new Date().toISOString().split('T')[0];
    db.prepare(`UPDATE checks_portfolio SET status = 'محصّل', deposited_date = ? WHERE id = ? AND company_id = ?`).run(depositDate, req.params.id, cid);
    addTreasuryEntry(depositDate, 'وارد', `تحصيل شيك ${check.check_number} من ${check.from_client}`, check.amount, 'البنك', 'check_deposit', req.params.id, req.body.user || 'system');
    res.json({ message: 'Check deposited successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/portfolio/:id', (req, res) => {
  try { db.prepare('DELETE FROM checks_portfolio WHERE id = ? AND company_id = ?').run(req.params.id, req.company_id); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/issued', (req, res) => {
  try {
    const { from_date, to_date, status, period } = req.query;

    let dateFilter = '';
    const params = [];

    if (period === 'daily') {
      dateFilter = `AND date(due_date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(due_date) >= date('now', '-7 days') AND date(due_date) <= date('now', '+7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(due_date) >= date('now', '-30 days') AND date(due_date) <= date('now', '+30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND due_date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (status) {
      dateFilter += ` AND status = ?`;
      params.push(status);
    }

    const checks = db.prepare(`
      SELECT * FROM checks_issued
      WHERE company_id = ? ${dateFilter}
      ORDER BY due_date DESC
    `).all(req.company_id, ...params);

    // Calculate KPIs (scoped to company)
    const allChecks = db.prepare('SELECT * FROM checks_issued WHERE company_id = ?').all(req.company_id);
    const kpis = {
      total_count: allChecks.length,
      total_amount: allChecks.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      pending_count: allChecks.filter(c => c.status === 'معلق').length,
      pending_amount: allChecks.filter(c => c.status === 'معلق').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      paid_count: allChecks.filter(c => c.status === 'مدفوع').length,
      paid_amount: allChecks.filter(c => c.status === 'مدفوع').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0),
      endorsed_count: allChecks.filter(c => c.type === 'مظهّر').length,
      endorsed_amount: allChecks.filter(c => c.type === 'مظهّر').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0)
    };

    res.json({ checks, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add/Update check issued
router.post('/issued', (req, res) => {
  try {
    const { check_number, date, received_date, check_owner, to_supplier, amount, due_date, bank, notes, type } = req.body;
    const result = db.prepare(`
      INSERT INTO checks_issued (check_number, date, received_date, check_owner, to_supplier, amount, due_date, bank, notes, type, status, company_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'معلق', ?)
    `).run(check_number, date, received_date || null, check_owner || null, to_supplier, amount, due_date, bank, notes, type || 'شيكاتي', req.company_id);
    logAudit('checks_issued', result.lastInsertRowid, 'create', null, req.body, req.body.user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/issued/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { status, paid_date, check_owner, received_date } = req.body;
    const checkId = req.params.id;
    const old = db.prepare('SELECT * FROM checks_issued WHERE id = ? AND company_id = ?').get(checkId, cid);

    let updates = [], values = [];
    if (status) { updates.push('status = ?'); values.push(status); }
    if (paid_date) { updates.push('paid_date = ?'); values.push(paid_date); }
    if (check_owner !== undefined) { updates.push('check_owner = ?'); values.push(check_owner); }
    if (received_date !== undefined) { updates.push('received_date = ?'); values.push(received_date); }

    if (updates.length > 0) {
      db.prepare(`UPDATE checks_issued SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`).run(...values, checkId, cid);
    }

    logAudit('checks_issued', checkId, 'update', old, req.body, req.body.user || 'system');
    res.json({ id: checkId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Pay issued check with accounting entry
router.put('/issued/:id/pay', (req, res) => {
  try {
    const { payment_source, paid_date, user } = req.body;
    const checkId = req.params.id;

    // Validate payment source
    if (!payment_source || !['الصندوق', 'البنك'].includes(payment_source)) {
      return res.status(400).json({ error: 'يجب تحديد مصدر الدفع (الصندوق أو البنك)' });
    }

    const cid = req.company_id;
    const check = db.prepare('SELECT * FROM checks_issued WHERE id = ? AND company_id = ?').get(checkId, cid);
    if (!check) return res.status(404).json({ error: 'الشيك غير موجود' });
    if (check.status === 'مدفوع') return res.status(400).json({ error: 'الشيك مدفوع بالفعل' });

    const payDate = paid_date || new Date().toISOString().split('T')[0];

    // Update check status
    db.prepare(`UPDATE checks_issued SET status = 'مدفوع', paid_date = ? WHERE id = ? AND company_id = ?`).run(payDate, checkId, cid);

    // Create treasury entry (debit from cash or bank)
    addTreasuryEntry(
      payDate,
      'صادر',
      `دفع شيك ${check.check_number} - ${check.to_supplier}`,
      check.amount,
      payment_source,
      'check_payment',
      checkId,
      user || 'system'
    );

    logAudit('checks_issued', checkId, 'update', check, { status: 'مدفوع', payment_source, paid_date: payDate }, user || 'system', 'Check paid');
    res.json({ message: 'تم دفع الشيك بنجاح', check_id: checkId, amount: check.amount, source: payment_source });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
