'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { logAudit, addTreasuryEntry } = require('../utils');

// ============================================
// Expenses endpoint
// (server.js lines 1614-1627)
// ============================================

router.get('/expenses', (req, res) => { try { res.json(db.prepare('SELECT * FROM expenses WHERE company_id = ? AND branch_id = ? ORDER BY date DESC').all(req.company_id, req.branch_id || 1)); } catch (err) { res.status(500).json({ error: err.message }); } });

router.post('/expenses', (req, res) => {
  try {
    const { date, category, description, amount, payment_method, user } = req.body;
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const result = db.prepare(`INSERT INTO expenses (date, category, description, amount, payment_method, company_id, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(date, category, description, amount, payment_method, cid, bid);
    const expenseId = result.lastInsertRowid;
    if (payment_method === 'نقدي') addTreasuryEntry(date, 'صادر', `${category} - ${description}`, amount, 'الصندوق', 'expense', expenseId, user, cid, bid);
    else if (payment_method === 'بنك') addTreasuryEntry(date, 'صادر', `${category} - ${description}`, amount, 'البنك', 'expense', expenseId, user, cid, bid);
    logAudit('expenses', expenseId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: expenseId, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// OPENING BALANCES
// (server.js lines 1862-1876)
// ============================================

router.get('/opening-balances', (req, res) => { try { res.json(db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(req.company_id, req.branch_id || 1)); } catch (err) { res.status(500).json({ error: err.message }); } }); 

router.put('/opening-balances', (req, res) => {
  try {
    const { cash, bank, fiscal_year, user } = req.body;
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const old = db.prepare('SELECT * FROM opening_balances WHERE company_id = ? AND branch_id = ? LIMIT 1').get(cid, bid);
    db.prepare(`UPDATE opening_balances SET cash = ?, bank = ?, fiscal_year = ?, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? AND branch_id = ?`).run(cash, bank, fiscal_year, cid, bid);
    logAudit('opening_balances', old ? old.id : 1, 'update', old, req.body, user || 'system');
    res.json(req.body);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// GET /api/ledger/:account_code — General Ledger (دفتر الأستاذ)
// Returns all journal lines for a single account with running balance.
// Query params: from (date), to (date)
// (server.js lines 2654-2712)
// ============================================
router.get('/ledger/:account_code', (req, res) => {
  try {
    const cid = req.company_id;
    const { account_code } = req.params;
    const { from, to } = req.query;

    const account = db.prepare('SELECT * FROM accounts WHERE code = ? AND company_id = ?').get(account_code, cid);
    if (!account) return res.status(404).json({ error: `Account ${account_code} not found in chart of accounts` });

    const bid = req.branch_id || 1;
    const where = ['jl.account_code = ?', 'jl.company_id = ?', 'je.company_id = ?', 'je.branch_id = ?'];
    const params = [account_code, cid, cid, bid];
    if (from) { where.push('je.entry_date >= ?'); params.push(from); }
    if (to)   { where.push('je.entry_date <= ?'); params.push(to); }

    const rows = db.prepare(`
      SELECT
        je.entry_date,
        je.entry_number,
        je.reference_type,
        je.reference_id,
        je.description,
        jl.debit,
        jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      WHERE ${where.join(' AND ')}
      ORDER BY je.entry_date ASC, je.id ASC
    `).all(...params);

    // Compute running balance: debit increases balance, credit decreases
    let running_balance = 0;
    let total_debit     = 0;
    let total_credit    = 0;
    const opening_balance = 0;  // full history always starts at 0

    const entries = rows.map(row => {
      running_balance += (row.debit || 0) - (row.credit || 0);
      total_debit     += row.debit  || 0;
      total_credit    += row.credit || 0;
      return { ...row, running_balance };
    });

    res.json({
      account_code,
      account_name:    account.name,
      account_type:    account.type,
      opening_balance,
      entries,
      total_debit,
      total_credit,
      closing_balance: opening_balance + running_balance
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// GET /api/trial-balance — Read-only aggregated account balances
// Computes total debit, total credit, and net balance per account
// from all posted journal lines. No query params — always full picture.
// (server.js lines 2714-2743)
// ============================================
router.get('/trial-balance', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const accounts = db.prepare(`
      SELECT
        a.code,
        a.name,
        a.type,
        COALESCE(agg.d, 0) AS total_debit,
        COALESCE(agg.c, 0) AS total_credit,
        COALESCE(agg.d, 0) - COALESCE(agg.c, 0) AS balance
      FROM accounts a
      LEFT JOIN (
        SELECT jl.account_code, SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id
        WHERE je.company_id = ? AND je.branch_id = ?
        GROUP BY jl.account_code
      ) AS agg ON a.code = agg.account_code
      WHERE a.company_id = ?
      ORDER BY a.code ASC
    `).all(cid, bid, cid);

    const total_debit  = accounts.reduce((s, a) => s + a.total_debit,  0);
    const total_credit = accounts.reduce((s, a) => s + a.total_credit, 0);
    const balanced     = Math.abs(total_debit - total_credit) < 0.001;

    res.json({ accounts, total_debit, total_credit, balanced });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// GET /api/journal — Read-only journal viewer
// Returns all journal entries with their lines, grouped.
// Query params: from (date), to (date), reference_type (string)
// (server.js lines 2745-2800)
// ============================================
router.get('/journal', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { from, to, reference_type } = req.query;
    const where = ['je.company_id = ?', 'je.branch_id = ?'];
    const params = [cid, bid];
    if (from)           { where.push('je.entry_date >= ?'); params.push(from); }
    if (to)             { where.push('je.entry_date <= ?'); params.push(to); }
    if (reference_type) { where.push('je.reference_type = ?'); params.push(reference_type); }
    const whereClause = 'WHERE ' + where.join(' AND ');

    const rows = db.prepare(`
      SELECT
        je.id,
        je.entry_number,
        je.entry_date,
        je.reference_type,
        je.reference_id,
        je.description,
        jl.account_code,
        jl.debit,
        jl.credit
      FROM journal_entries je
      JOIN journal_lines jl ON je.id = jl.journal_entry_id AND jl.company_id = je.company_id
      ${whereClause}
      ORDER BY je.entry_date DESC, je.id DESC, jl.id ASC
    `).all(...params);

    // Group flat rows into entries with nested lines[]
    const map = new Map();
    rows.forEach(row => {
      if (!map.has(row.entry_number)) {
        map.set(row.entry_number, {
          entry_number:   row.entry_number,
          entry_date:     row.entry_date,
          reference_type: row.reference_type,
          reference_id:   row.reference_id,
          description:    row.description,
          lines: []
        });
      }
      map.get(row.entry_number).lines.push({
        account_code: row.account_code,
        debit:        row.debit,
        credit:       row.credit
      });
    });

    res.json(Array.from(map.values()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// POST /api/close-period — Period Summary (Phase 2)
// Body: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
//
// Phase 2: COGS is now recognised in real-time at sale confirmation
// (reference_type = 'sale_cogs'). This endpoint no longer creates inventory
// journal entries. It returns a read-only summary of COGS entries already
// posted in the period.
// (server.js lines 2802-2845)
// ============================================
router.post('/close-period', (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });
    if (from > to)   return res.status(400).json({ error: 'from must be <= to' });

    const cid = req.company_id;
    const bid = req.branch_id || 1;

    // Summarise real-time COGS entries already posted in the period
    const cogsEntries = db.prepare(`
      SELECT je.entry_number, je.entry_date, je.reference_id,
             COALESCE(SUM(jl.debit), 0) AS cogs_amount
      FROM journal_entries je
      JOIN journal_lines jl ON jl.journal_entry_id = je.id
      WHERE je.reference_type = 'sale_cogs'
        AND je.entry_date >= ? AND je.entry_date <= ?
        AND jl.account_code = '5101'
        AND je.company_id = ? AND je.branch_id = ?
      GROUP BY je.id
      ORDER BY je.entry_date ASC
    `).all(from, to, cid, bid);

    const total_cogs = cogsEntries.reduce((s, e) => s + e.cogs_amount, 0);

    res.json({
      message:      'Period summary — COGS recorded in real-time at sale confirmation',
      period_from:  from,
      period_to:    to,
      cogs_entries: cogsEntries.length,
      total_cogs,
      entries:      cogsEntries,
      note:         'No journal entry created. COGS is posted via sale_cogs at confirmation.'
    });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// GET /api/profit-loss — Profit & Loss Statement (Read-only)
// Query params: from (date), to (date)
// Revenue value  = total_credit - total_debit  (net inflow)
// Expense value  = total_debit  - total_credit (net outflow)
// net_profit     = total_revenue - total_expenses
// (server.js lines 2847-2901)
// ============================================
router.get('/profit-loss', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to query params are required' });

    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const rows = db.prepare(`
      SELECT
        a.code,
        a.name,
        a.type,
        COALESCE(agg.d, 0) AS total_debit,
        COALESCE(agg.c, 0) AS total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT jl.account_code, SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id
        WHERE je.company_id = ? AND je.branch_id = ?
          AND je.entry_date >= ? AND je.entry_date <= ?
        GROUP BY jl.account_code
      ) AS agg ON a.code = agg.account_code
      WHERE a.type IN ('REVENUE', 'EXPENSE') AND a.company_id = ?
      GROUP BY a.code, a.name, a.type, agg.d, agg.c
      ORDER BY a.code ASC
    `).all(cid, bid, from, to, cid);

    const revenue  = [];
    const expenses = [];

    rows.forEach(row => {
      if (row.type === 'REVENUE') {
        revenue.push({
          code:  row.code,
          name:  row.name,
          value: row.total_credit - row.total_debit   // credit-normal account
        });
      } else if (row.type === 'EXPENSE') {
        expenses.push({
          code:  row.code,
          name:  row.name,
          value: row.total_debit - row.total_credit   // debit-normal account
        });
      }
    });

    const total_revenue  = revenue.reduce((s, a) => s + a.value, 0);
    const total_expenses = expenses.reduce((s, a) => s + a.value, 0);
    const net_profit     = total_revenue - total_expenses;

    res.json({ from, to, revenue, expenses, total_revenue, total_expenses, net_profit });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// GET /api/balance-sheet — Balance Sheet (Read-only)
// Query params: to (date, defaults to today)
// ASSET    balance = debit - credit
// LIABILITY/EQUITY balance = credit - debit
// net_profit injected into equity dynamically from P&L logic
// (server.js lines 2903-2984)
// ============================================
router.get('/balance-sheet', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const to = req.query.to || new Date().toISOString().slice(0, 10);

    // ── Balance-sheet accounts ──────────────────────────────────────────
    const rows = db.prepare(`
      SELECT
        a.code,
        a.name,
        a.type,
        COALESCE(agg.d, 0) AS total_debit,
        COALESCE(agg.c, 0) AS total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT jl.account_code, SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id
        WHERE je.company_id = ? AND je.branch_id = ? AND je.entry_date <= ?
        GROUP BY jl.account_code
      ) AS agg ON a.code = agg.account_code
      WHERE a.type IN ('ASSET', 'LIABILITY', 'EQUITY') AND a.company_id = ?
      GROUP BY a.code, a.name, a.type, agg.d, agg.c
      ORDER BY a.code ASC
    `).all(cid, bid, to, cid);

    const assets      = [];
    const liabilities = [];
    const equity      = [];

    rows.forEach(row => {
      const entry = { code: row.code, name: row.name };
      if (row.type === 'ASSET') {
        entry.balance = row.total_debit - row.total_credit;
        assets.push(entry);
      } else if (row.type === 'LIABILITY') {
        entry.balance = row.total_credit - row.total_debit;
        liabilities.push(entry);
      } else if (row.type === 'EQUITY') {
        entry.balance = row.total_credit - row.total_debit;
        equity.push(entry);
      }
    });

    // ── Net profit (P&L up to :to, from beginning of time) ─────────────
    const plRows = db.prepare(`
      SELECT
        a.type,
        COALESCE(SUM(agg.d), 0) AS total_debit,
        COALESCE(SUM(agg.c), 0) AS total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT jl.account_code, SUM(jl.debit) as d, SUM(jl.credit) as c
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_entry_id = je.id
        WHERE je.company_id = ? AND je.branch_id = ? AND je.entry_date <= ?
        GROUP BY jl.account_code
      ) AS agg ON a.code = agg.account_code
      WHERE a.type IN ('REVENUE', 'EXPENSE') AND a.company_id = ?
      GROUP BY a.type
    `).all(cid, bid, to, cid);

    let total_revenue  = 0;
    let total_expenses = 0;
    plRows.forEach(r => {
      if (r.type === 'REVENUE') total_revenue  = r.total_credit - r.total_debit;
      if (r.type === 'EXPENSE') total_expenses = r.total_debit  - r.total_credit;
    });
    const net_profit = total_revenue - total_expenses;

    // Inject net_profit as a dynamic equity line
    if (net_profit !== 0) {
      equity.push({ code: 'NET', name: net_profit >= 0 ? 'صافي الربح' : 'صافي الخسارة', balance: net_profit });
    }

    const total_assets      = assets.reduce((s, a) => s + a.balance, 0);
    const total_liabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const total_equity      = equity.reduce((s, a) => s + a.balance, 0);
    const balanced          = Math.abs(total_assets - (total_liabilities + total_equity)) < 0.01;

    res.json({ to, assets, liabilities, equity, total_assets, total_liabilities, total_equity, balanced });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================
// TRAITES (PROMISSORY NOTES)
// Documented in docs/WHOLESALE_SYSTEM.md
// Fields: reference, client_id, amount, due_date, status, notes
// Statuses: PENDING | COLLECTED | UNPAID
// ============================================

router.get('/traites', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { status, client_id, from, to } = req.query;
    let sql = `
      SELECT t.*, c.name AS client_name, c.code AS client_code
      FROM traites t
      LEFT JOIN clients c ON c.id = t.client_id AND c.company_id = t.company_id
      WHERE t.company_id = ? AND t.branch_id = ?
    `;
    const params = [cid, bid];
    if (status)    { sql += ` AND t.status = ?`;        params.push(status); }
    if (client_id) { sql += ` AND t.client_id = ?`;     params.push(client_id); }
    if (from)      { sql += ` AND t.due_date >= ?`;     params.push(from); }
    if (to)        { sql += ` AND t.due_date <= ?`;     params.push(to); }
    sql += ` ORDER BY t.due_date ASC, t.id DESC`;
    res.json(db.prepare(sql).all(...params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/traites', (req, res) => {
  try {
    const cid = req.company_id;
    const { reference, client_id, amount, due_date, notes, branch_id } = req.body;
    if (!amount || !due_date) {
      return res.status(400).json({ error: 'amount و due_date مطلوبان' });
    }
    if (client_id) {
      const cl = db.prepare('SELECT id FROM clients WHERE id = ? AND company_id = ?').get(client_id, cid);
      if (!cl) return res.status(404).json({ error: 'العميل غير موجود' });
    }
    const r = db.prepare(`
      INSERT INTO traites (reference, client_id, amount, due_date, status, notes, company_id, branch_id)
      VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `).run(reference || null, client_id || null, parseFloat(amount), due_date,
           notes || null, cid, branch_id || null);
    res.status(201).json({ id: r.lastInsertRowid, success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/traites/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { id } = req.params;
    const traite = db.prepare('SELECT id FROM traites WHERE id = ? AND company_id = ? AND branch_id = ?').get(id, cid, bid);
    if (!traite) return res.status(404).json({ error: 'السفتجة غير موجودة' });
    const { reference, client_id, amount, due_date, status, notes } = req.body;
    const VALID_STATUSES = ['PENDING', 'COLLECTED', 'UNPAID'];
    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `الحالة غير صالحة. المقبول: ${VALID_STATUSES.join(', ')}` });
    }
    db.prepare(`
      UPDATE traites SET
        reference  = COALESCE(?, reference),
        client_id  = COALESCE(?, client_id),
        amount     = COALESCE(?, amount),
        due_date   = COALESCE(?, due_date),
        status     = COALESCE(?, status),
        notes      = ?
      WHERE id = ? AND company_id = ? AND branch_id = ?
    `).run(reference ?? null, client_id ?? null, amount ? parseFloat(amount) : null,
           due_date ?? null, status ?? null, notes ?? null, id, cid, bid);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/traites/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const { id } = req.params;
    const traite = db.prepare('SELECT id, status FROM traites WHERE id = ? AND company_id = ? AND branch_id = ?').get(id, cid, bid);
    if (!traite) return res.status(404).json({ error: 'السفتجة غير موجودة' });
    if (traite.status === 'COLLECTED') {
      return res.status(400).json({ error: 'لا يمكن حذف سفتجة محصلة' });
    }
    db.prepare('DELETE FROM traites WHERE id = ? AND company_id = ? AND branch_id = ?').run(id, cid, bid);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
