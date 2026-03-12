'use strict';
const router = require('express').Router();
const { db } = require('../database');

// ============================================
// TREASURY API (READ-ONLY + COMPUTED)
// ============================================

router.get('/balance', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const ob = db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(cid, bid);
    const ledger = db.prepare('SELECT * FROM treasury_ledger WHERE company_id = ? AND branch_id = ?').all(cid, bid);
    let cash = parseFloat(ob?.cash || 0), bank = parseFloat(ob?.bank || 0);
    ledger.forEach(e => { const amt = parseFloat(e.amount || 0); if (e.type === 'وارد') { if (e.account === 'الصندوق') cash += amt; else bank += amt; } else { if (e.account === 'الصندوق') cash -= amt; else bank -= amt; } });
    res.json({ cash, bank, total: cash + bank });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/movements', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { from_date, to_date, account, limit } = req.query;
    let sql = 'SELECT * FROM treasury_ledger WHERE company_id = ? AND branch_id = ?', params = [cid, bid];
    if (from_date) { sql += ' AND date >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND date <= ?'; params.push(to_date); }
    if (account) { sql += ' AND account = ?'; params.push(account); }
    sql += ' ORDER BY date DESC, created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/summary', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const ob = db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(cid, bid);
    const ledger = db.prepare('SELECT * FROM treasury_ledger WHERE company_id = ? AND branch_id = ?').all(cid, bid);
    const checksPortfolio = db.prepare(`SELECT SUM(amount) as total FROM checks_portfolio WHERE status = 'معلق' AND used_for_payment = 0 AND company_id = ? AND branch_id = ?`).get(cid, bid);
    let cash = parseFloat(ob?.cash || 0), bank = parseFloat(ob?.bank || 0), cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    ledger.forEach(e => { const amt = parseFloat(e.amount || 0); if (e.type === 'وارد') { if (e.account === 'الصندوق') { cash += amt; cashIn += amt; } else { bank += amt; bankIn += amt; } } else { if (e.account === 'الصندوق') { cash -= amt; cashOut += amt; } else { bank -= amt; bankOut += amt; } } });
    res.json({ cash: { balance: cash, in: cashIn, out: cashOut }, bank: { balance: bank, in: bankIn, out: bankOut }, checksUnderCollection: parseFloat(checksPortfolio?.total || 0), totalLiquid: cash + bank + parseFloat(checksPortfolio?.total || 0) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
