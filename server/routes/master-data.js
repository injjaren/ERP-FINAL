'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { crudWithAudit, generateCode, logAudit } = require('../utils');

// ============================================
// API ENDPOINTS - WAREHOUSES & PRODUCT TYPES
// ============================================

const warehouses   = crudWithAudit('warehouses');
const productTypes = crudWithAudit('product_types');

router.get('/warehouses', (req, res) => {
  try { res.json(warehouses.all(req.company_id, req.branch_id)); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/warehouses', (req, res) => {
  try {
    const code = generateCode('warehouses', req.company_id);
    const data = { ...req.body, code };
    const result = warehouses.create(data, req.body.user || 'system', req.company_id, req.branch_id);
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/warehouses/:id', (req, res) => {
  try {
    warehouses.update(req.params.id, req.body, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/warehouses/:id', (req, res) => {
  try {
    warehouses.delete(req.params.id, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/product-types', (req, res) => {
  try {
    const cid = req.company_id;
    res.json(db.prepare('SELECT * FROM product_types WHERE company_id = ?').all(cid));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/product-types', (req, res) => {
  try {
    const code = generateCode('product_types', req.company_id);
    const data = { ...req.body, code };
    const result = productTypes.create(data, req.body.user || 'system', req.company_id, req.branch_id);
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/product-types/:id', (req, res) => {
  try {
    productTypes.update(req.params.id, req.body, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id);
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/product-types/:id', (req, res) => {
  try {
    productTypes.delete(req.params.id, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// SIMPLE CRUD TABLES
// ============================================

// Special endpoints for clients with calculated debt — branch-isolated
router.get('/clients', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id;
    // If branch_id is set in session, filter to this branch only
    const clients = bid
      ? db.prepare(`
          SELECT c.*,
            COALESCE(c.balance, 0) as balance
          FROM clients c
          WHERE c.company_id = ? AND c.branch_id = ?
          ORDER BY c.name
        `).all(cid, bid)
      : db.prepare(`
          SELECT c.*,
            COALESCE(c.balance, 0) as balance
          FROM clients c
          WHERE c.company_id = ?
          ORDER BY c.name
        `).all(cid);
    res.json(clients);
  } catch (err) { res.status(500).json({ error: err.message }); }
});;

router.post('/clients', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id || null;
    // Inline company-scoped code generation (generateCode() is broken by isolation guard)
    const lastClient = db.prepare(`SELECT code FROM clients WHERE code LIKE 'CLI%' AND company_id = ? ORDER BY id DESC LIMIT 1`).get(cid);
    let nextNum = 1000;
    if (lastClient && lastClient.code) { const m = lastClient.code.match(/CLI(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
    const code = `CLI${nextNum}`;
    const { name, phone, address, allow_credit, user } = req.body;
    const result = db.prepare(`
      INSERT INTO clients (code, name, phone, address, balance, allow_credit, company_id, branch_id)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `).run(code, name, phone, address, allow_credit !== undefined ? allow_credit : 1, cid, bid);
    logAudit('clients', result.lastInsertRowid, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});;

router.put('/clients/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const { name, phone, address, allow_credit, user } = req.body;
    const old = db.prepare('SELECT * FROM clients WHERE id = ? AND company_id = ?').get(req.params.id, cid);
    db.prepare(`UPDATE clients SET name = ?, phone = ?, address = ?, allow_credit = ? WHERE id = ? AND company_id = ?`)
      .run(name, phone, address, allow_credit, req.params.id, cid);
    logAudit('clients', req.params.id, 'update', old, req.body, user || 'system');
    res.json({ id: req.params.id, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/clients/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const old = db.prepare('SELECT * FROM clients WHERE id = ? AND company_id = ?').get(req.params.id, cid);
    db.prepare('DELETE FROM clients WHERE id = ? AND company_id = ?').run(req.params.id, cid);
    logAudit('clients', req.params.id, 'delete', old, null, req.body.user || 'system');
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================================
// CLIENT ACCOUNT STATEMENT
// GET /api/clients/:id/statement?from=&to=
// Returns client info + chronological list of invoices and
// payments with running balance.
// ============================================================
router.get('/clients/:id/statement', (req, res) => {
  try {
    const cid = req.company_id;
    const clientId = parseInt(req.params.id);
    const { from, to } = req.query;

    const client = db.prepare(
      'SELECT id, code, name, phone, address, balance FROM clients WHERE id = ? AND company_id = ?'
    ).get(clientId, cid);
    if (!client) return res.status(404).json({ error: 'العميل غير موجود' });

    // Build date filter clause (applied to both legs of the UNION)
    let dateFilter = '';
    const filterParams = [];
    if (from) { dateFilter += ' AND txn_date >= ?'; filterParams.push(from); }
    if (to)   { dateFilter += ' AND txn_date <= ?'; filterParams.push(to); }

    // UNION: invoices (debit) + payments (credit), sorted chronologically
    const rows = db.prepare(`
      SELECT txn_type, txn_id, txn_date, reference, note, amount
      FROM (
        -- Invoices: positive amount = debit (client owes)
        SELECT
          'invoice'             AS txn_type,
          s.id                  AS txn_id,
          s.date                AS txn_date,
          s.invoice_number      AS reference,
          s.status              AS note,
          s.final_amount        AS amount
        FROM sales s
        WHERE s.client_id = ? AND s.company_id = ?
          AND s.status NOT IN ('credit_note','adjustment')

        UNION ALL

        -- Payments: negative amount = credit (reduces balance)
        SELECT
          'payment'             AS txn_type,
          sp.id                 AS txn_id,
          DATE(sp.created_at)   AS txn_date,
          sp.payment_type       AS reference,
          s.invoice_number      AS note,
          -sp.amount            AS amount
        FROM sales_payments sp
        JOIN sales s ON s.id = sp.sale_id AND s.company_id = sp.company_id
        WHERE s.client_id = ? AND sp.company_id = ?
      )
      WHERE 1=1 ${dateFilter}
      ORDER BY txn_date ASC, txn_id ASC
    `).all(clientId, cid, clientId, cid, ...filterParams);

    // Compute running balance (opening = 0 for the filtered range)
    let running = 0;
    const transactions = rows.map(r => {
      running += parseFloat(r.amount) || 0;
      return { ...r, running_balance: Math.round(running * 1000) / 1000 };
    });

    res.json({ client, transactions, closing_balance: running });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// SUPPLIER ACCOUNT STATEMENT
// GET /api/suppliers/:id/statement?from=&to=
// Returns supplier info + chronological list of purchases and
// payments with running balance (positive = we owe supplier).
// ============================================================
router.get('/suppliers/:id/statement', (req, res) => {
  try {
    const cid = req.company_id;
    const supplierId = parseInt(req.params.id);
    const { from, to } = req.query;

    const supplier = db.prepare(
      'SELECT id, code, name, phone, address FROM suppliers WHERE id = ? AND company_id = ?'
    ).get(supplierId, cid);
    if (!supplier) return res.status(404).json({ error: 'المورد غير موجود' });

    let dateFilter = '';
    const filterParams = [];
    if (from) { dateFilter += ' AND txn_date >= ?'; filterParams.push(from); }
    if (to)   { dateFilter += ' AND txn_date <= ?'; filterParams.push(to); }

    const rows = db.prepare(`
      SELECT txn_type, txn_id, txn_date, reference, note, amount
      FROM (
        -- Purchases: positive amount = debit (we owe supplier)
        SELECT
          'purchase'            AS txn_type,
          p.id                  AS txn_id,
          p.date                AS txn_date,
          p.invoice_number      AS reference,
          p.notes               AS note,
          p.total_amount        AS amount
        FROM purchases p
        WHERE p.supplier_id = ? AND p.company_id = ?

        UNION ALL

        -- Payments: negative amount = credit (reduces what we owe)
        SELECT
          'payment'             AS txn_type,
          pp.id                 AS txn_id,
          DATE(pp.created_at)   AS txn_date,
          pp.payment_type       AS reference,
          p.invoice_number      AS note,
          -pp.amount            AS amount
        FROM purchases_payments pp
        JOIN purchases p ON p.id = pp.purchase_id AND p.company_id = pp.company_id
        WHERE p.supplier_id = ? AND pp.company_id = ?
      )
      WHERE 1=1 ${dateFilter}
      ORDER BY txn_date ASC, txn_id ASC
    `).all(supplierId, cid, supplierId, cid, ...filterParams);

    let running = 0;
    const transactions = rows.map(r => {
      running += parseFloat(r.amount) || 0;
      return { ...r, running_balance: Math.round(running * 1000) / 1000 };
    });

    res.json({ supplier, transactions, closing_balance: running });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Dedicated GET /suppliers — branch-isolated, single source of truth for balance.
router.get('/suppliers', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id;
    const suppliers = bid
      ? db.prepare('SELECT * FROM suppliers WHERE company_id = ? AND branch_id = ?').all(cid, bid)
      : db.prepare('SELECT * FROM suppliers WHERE company_id = ?').all(cid);
    const result = suppliers.map(s => ({
      ...s,
      computed_balance: getSupplierBalance(s.id, cid)
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});;

// Tables with auto-generated codes — suppliers get branch_id stamped on create
const autoCodeTables = ['suppliers', 'employees', 'partners'];
autoCodeTables.forEach(table => {
  const crud = crudWithAudit(table);
  // GET is handled by dedicated routes above for suppliers (registered first)
  router.get(`/${table}`, (req, res) => { try { res.json(crud.all(req.company_id, req.branch_id)); } catch (err) { res.status(500).json({ error: err.message }); } });
  router.post(`/${table}`, (req, res) => {
    try {
      const code = generateCode(table, req.company_id);
      // Stamp branch_id for suppliers so they are correctly isolated
      const data = table === 'suppliers'
        ? { ...req.body, code, branch_id: req.branch_id || null }
        : { ...req.body, code };
      const result = crud.create(data, req.body.user || 'system', req.company_id, req.branch_id);
      res.status(201).json({ id: result.lastInsertRowid, code, ...req.body });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  router.put(`/${table}/:id`, (req, res) => { try { crud.update(req.params.id, req.body, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id); res.json({ id: req.params.id, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  router.delete(`/${table}/:id`, (req, res) => { try { crud.delete(req.params.id, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); } });
});;

// Tables without auto-generated codes
const simpleTables = ['vehicle_tours'];
simpleTables.forEach(table => {
  const crud = crudWithAudit(table);
  router.get(`/${table}`, (req, res) => { try { res.json(crud.all(req.company_id, req.branch_id)); } catch (err) { res.status(500).json({ error: err.message }); } });
  router.post(`/${table}`, (req, res) => { try { const result = crud.create(req.body, req.body.user || 'system', req.company_id, req.branch_id); res.status(201).json({ id: result.lastInsertRowid, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  router.put(`/${table}/:id`, (req, res) => { try { crud.update(req.params.id, req.body, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id); res.json({ id: req.params.id, ...req.body }); } catch (err) { res.status(400).json({ error: err.message }); } });
  router.delete(`/${table}/:id`, (req, res) => { try { crud.delete(req.params.id, req.body.user || 'system', req.body.reason, req.company_id, req.branch_id); res.status(204).send(); } catch (err) { res.status(400).json({ error: err.message }); } });
});

// ============================================
// SUPPLIER BALANCE HELPERS
// ============================================

// Local helper — computes live balance from purchases + payments.
function getSupplierBalance(supplierId, company_id) {
  const cid = company_id || 1;
  const totalInvoiced = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ? AND company_id = ?`).get(supplierId, cid).total;
  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(pp.amount), 0) as total
    FROM purchases_payments pp
    INNER JOIN purchases pur ON pp.purchase_id = pur.id AND pur.company_id = ?
    WHERE pur.supplier_id = ?
  `).get(cid, supplierId).total;
  return totalInvoiced - totalPaid;
}

// Dynamic supplier balance
router.get('/suppliers/:id/balance', (req, res) => {
  try {
    const cid = req.company_id;
    const supplierId = parseInt(req.params.id);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ? AND company_id = ?').get(supplierId, cid);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const totalInvoiced = db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM purchases WHERE supplier_id = ? AND company_id = ?`).get(supplierId, cid).total;
    const totalPaid = db.prepare(`
      SELECT COALESCE(SUM(pp.amount), 0) as total
      FROM purchases_payments pp
      INNER JOIN purchases pur ON pp.purchase_id = pur.id AND pur.company_id = ?
      WHERE pur.supplier_id = ?
    `).get(cid, supplierId).total;

    const balance = totalInvoiced - totalPaid;  // positive = we owe, negative = supplier credit
    const supplier_credit = balance < 0 ? Math.abs(balance) : 0;

    res.json({
      supplier_id: supplierId,
      supplier_name: supplier.name,
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      balance,          // positive = we owe supplier, negative = supplier owes us
      supplier_credit   // amount supplier owes us (available to apply to next invoice)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
