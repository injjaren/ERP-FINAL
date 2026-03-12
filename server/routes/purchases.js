'use strict';
const router = require('express').Router();
const { db } = require('../database');
const { addTreasuryEntry, postJournal, createJournalEntry, logAudit, ensureColorInSystem } = require('../utils');

// ============================================
// API ENDPOINTS - PURCHASES
// ============================================

// Helper: compute dynamic supplier balance (positive = we owe, negative = supplier credit)
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

router.get('/purchases', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id;
    const { from_date, to_date, supplier_id, period } = req.query;

    let dateFilter = '';
    const params = [cid, bid]; // company_id then branch_id

    if (period === 'daily') {
      dateFilter = `AND date(p.date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(p.date) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(p.date) >= date('now', '-30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND p.date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (supplier_id) {
      dateFilter += ` AND p.supplier_id = ?`;
      params.push(supplier_id);
    }

    const purchases = db.prepare(`
      SELECT p.*, s.name as supplier_name_resolved
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.company_id = ? AND p.branch_id = ? ${dateFilter}
      ORDER BY p.date DESC
    `).all(...params);

    const getItems    = db.prepare(`
      SELECT pi.*,
             pt.name  AS product_name,
             pt.unit  AS product_unit,
             i.color_description
      FROM   purchases_items pi
      LEFT JOIN inventory     i  ON pi.inventory_id   = i.id AND i.company_id = pi.company_id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      WHERE  pi.purchase_id = ? AND pi.company_id = ?
    `);
    const getPayments = db.prepare(`SELECT * FROM purchases_payments WHERE purchase_id = ? AND company_id = ?`);

    // Cache supplier balances to avoid redundant queries
    const supplierBalanceCache = {};

    purchases.forEach(purchase => {
      purchase.items    = getItems.all(purchase.id, cid);
      purchase.payments = getPayments.all(purchase.id, cid);

      // Computed fields (dynamic, never rely on stored totals)
      const total_paid  = purchase.payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const applied_credit = parseFloat(purchase.applied_credit || 0);
      const remaining   = Math.max(0, purchase.total_amount - applied_credit - total_paid);

      purchase.total_paid     = total_paid;
      purchase.applied_credit = applied_credit;
      purchase.remaining      = remaining;
      // Re-sync status dynamically (source of truth is the equation)
      purchase.status         = remaining <= 0 ? 'CLOSED' : 'OPEN';

      if (purchase.supplier_id) {
        if (supplierBalanceCache[purchase.supplier_id] === undefined) {
          supplierBalanceCache[purchase.supplier_id] = getSupplierBalance(purchase.supplier_id, cid);
        }
        purchase.supplier_balance = supplierBalanceCache[purchase.supplier_id];
      } else {
        purchase.supplier_balance = 0;
      }
    });

    const kpis = {
      total_purchases: purchases.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
      total_paid:      purchases.reduce((sum, p) => sum + parseFloat(p.total_paid   || 0), 0),
      total_remaining: purchases.reduce((sum, p) => sum + parseFloat(p.remaining    || 0), 0),
      count: purchases.length
    };

    res.json({ purchases, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Distinct free-text color descriptions already in inventory — for purchase form datalist suggestions
router.get('/purchases/color-suggestions', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT LOWER(TRIM(color_description)) AS color_description
      FROM inventory
      WHERE color_description IS NOT NULL AND TRIM(color_description) != '' AND company_id = ?
      ORDER BY color_description
    `).all(req.company_id);
    res.json(rows.map(r => r.color_description));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/purchases', (req, res) => {
  try {
    const { invoice_number, date, supplier_id, supplier_name, warehouse_id, items, payments, notes, user } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!warehouse_id) return res.status(400).json({ error: 'المخزن مطلوب' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items provided' });
    for (const item of items) {
      if (!item.product_type_id) return res.status(400).json({ error: 'المنتج مطلوب لكل عنصر' });
      if (!item.quantity || parseFloat(item.quantity) <= 0) return res.status(400).json({ error: 'Invalid item quantity' });
      if (!item.unit_cost || parseFloat(item.unit_cost) <= 0) return res.status(400).json({ error: 'Invalid item cost' });
    }

    // Guard duplicate (product_type, normalizedColor) pairs before entering transaction
    const itemKeys = items.map(item => `${item.product_type_id}:${(item.color_input || '').trim().toLowerCase()}`);
    if (new Set(itemKeys).size !== itemKeys.length) return res.status(400).json({ error: 'منتجات مكررة في نفس الفاتورة (نفس المنتج ونفس اللون)' });

    const total_amount = items.reduce((sum, item) => sum + parseFloat(item.total_cost), 0);
    if (total_amount <= 0) return res.status(400).json({ error: 'Invalid total amount' });

    const cid = req.company_id;
    const bid = req.branch_id || 1;
    const createPurchase = db.transaction(() => {
      const createdInventoryIds = [];

      // ── 0. Resolve inventory rows ─────────────────────────────────────
      // Inherit inventory_stage from warehouse configuration (e.g. raw_bobbin for bobbin warehouses)
      const whRow = db.prepare('SELECT inventory_stage FROM warehouses WHERE id = ? AND company_id = ?').get(parseInt(warehouse_id), cid);
      const warehouseStage = whRow?.inventory_stage || 'wholesale_kg';

      // Color auto-sync: every color entering inventory is registered in color system
      const resolvedItems = items.map(item => {
        const normalizedColor = item.color_input
          ? item.color_input.trim().toLowerCase()
          : null;

        // Auto-sync: ensure color exists in color_codes + color_master + color_families
        const colorSync = ensureColorInSystem(normalizedColor, cid, supplier_id || null);
        const resolvedColorCodeId = colorSync ? colorSync.color_code_id : null;

        // Search existing row: warehouse + product + color_code_id (company-scoped)
        let invRow = db.prepare(`
          SELECT id, quantity, unit_cost FROM inventory
          WHERE warehouse_id = ?
            AND product_type_id = ?
            AND company_id = ?
            AND COALESCE(color_code_id, 0) = COALESCE(?, 0)
        `).get(parseInt(warehouse_id), parseInt(item.product_type_id), cid, resolvedColorCodeId || 0);

        if (!invRow) {
          // Row does not exist → create with color_code_id linked, using warehouse's inventory_stage
          const r = db.prepare(`
            INSERT INTO inventory (warehouse_id, product_type_id, color_code_id, color_description, quantity, unit_cost, company_id, inventory_stage)
            VALUES (?, ?, ?, ?, 0, ?, ?, ?)
          `).run(parseInt(warehouse_id), parseInt(item.product_type_id), resolvedColorCodeId, normalizedColor, parseFloat(item.unit_cost), cid, warehouseStage);
          createdInventoryIds.push(r.lastInsertRowid);
          invRow = { id: r.lastInsertRowid, quantity: 0, unit_cost: parseFloat(item.unit_cost) };
        } else if (resolvedColorCodeId && !db.prepare('SELECT color_code_id FROM inventory WHERE id = ? AND company_id = ?').get(invRow.id, cid)?.color_code_id) {
          // Backfill color_code_id on existing rows that were created before auto-sync
          db.prepare('UPDATE inventory SET color_code_id = ? WHERE id = ? AND company_id = ?')
            .run(resolvedColorCodeId, invRow.id, cid);
        }

        return { ...item, inventory_id: invRow.id };
      });

      // Safety: after resolution two different color strings could still resolve to the same row
      const allInvIds = resolvedItems.map(i => i.inventory_id);
      if (new Set(allInvIds).size !== allInvIds.length) throw new Error('منتجات مكررة في نفس الفاتورة (نفس صف المخزون)');

      // ── 1. Supplier credit (unchanged logic) ──────────────────────────
      let applied_credit = 0;
      if (supplier_id) {
        const balanceBefore = getSupplierBalance(supplier_id, cid);
        // balanceBefore < 0 means supplier owes us (credit available)
        const credit_available = balanceBefore < 0 ? Math.abs(balanceBefore) : 0;
        if (credit_available > 0) {
          applied_credit = Math.min(credit_available, total_amount);
        }
      }

      // ── 2. Determine status ───────────────────────────────────────────
      const payments_total = (payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const remaining_after = Math.max(0, total_amount - applied_credit - payments_total);
      const status = remaining_after <= 0 ? 'CLOSED' : 'OPEN';

      // ── 3. Insert purchase header ─────────────────────────────────────
      const purchaseResult = db.prepare(`
        INSERT INTO purchases (invoice_number, date, supplier_id, supplier_name, warehouse_id, total_amount, notes, status, applied_credit, company_id, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(invoice_number, date, supplier_id || null, supplier_name || null, parseInt(warehouse_id), total_amount, notes || null, status, applied_credit, cid, bid);
      const purchaseId = purchaseResult.lastInsertRowid;

      // ── 4. Items + WAC + movement log (WAC formula unchanged) ─────────
      const insertItem = db.prepare(`INSERT INTO purchases_items (purchase_id, inventory_id, quantity, unit_cost, total_cost, company_id) VALUES (?, ?, ?, ?, ?, ?)`);
      const getInvRow  = db.prepare(`SELECT quantity, unit_cost FROM inventory WHERE id = ? AND company_id = ?`);

      resolvedItems.forEach(item => {
        insertItem.run(purchaseId, item.inventory_id, item.quantity, item.unit_cost, item.total_cost, cid);

        // Weighted Average Cost (unchanged)
        const current       = getInvRow.get(item.inventory_id, cid);
        const old_quantity  = parseFloat(current.quantity)  || 0;
        const old_unit_cost = parseFloat(current.unit_cost) || 0;
        const purchased_qty = parseFloat(item.quantity);
        const purchase_cost = parseFloat(item.unit_cost);
        const new_quantity  = old_quantity + purchased_qty;
        const new_unit_cost = old_quantity > 0
          ? (old_quantity * old_unit_cost + purchased_qty * purchase_cost) / new_quantity
          : purchase_cost;

        console.log('[WAC DEBUG]', { inventory_id: item.inventory_id, old_quantity, old_unit_cost, purchased_qty, purchase_cost, new_unit_cost });

        // unit_price updated ONLY when explicitly provided; otherwise left unchanged
        db.prepare(`UPDATE inventory SET quantity = ?, unit_cost = ?, unit_price = COALESCE(?, unit_price) WHERE id = ? AND company_id = ?`)
          .run(new_quantity, new_unit_cost, item.unit_price || null, item.inventory_id, cid);

        db.prepare(`INSERT INTO inventory_movements (inventory_id, movement_type, quantity, unit_cost, reference_type, reference_id, created_by, company_id) VALUES (?, 'IN', ?, ?, 'purchase', ?, ?, ?)`)
          .run(item.inventory_id, purchased_qty, purchase_cost, purchaseId, user || 'system', cid);
      });

      // ── 5. Payments + treasury (unchanged) ───────────────────────────
      const insertPayment = db.prepare(`INSERT INTO purchases_payments (purchase_id, payment_type, amount, check_number, check_date, check_due_date, bank, source_check_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      (payments || []).forEach(p => {
        if (!p.amount || parseFloat(p.amount) <= 0) return;
        insertPayment.run(purchaseId, p.payment_type, p.amount, p.check_number || null, p.check_date || null, p.check_due_date || null, p.bank || null, p.source_check_id || null, cid);

        if (p.payment_type === 'نقدي') {
          addTreasuryEntry(date, 'صادر', `مشتريات - فاتورة ${invoice_number}`, p.amount, 'الصندوق', 'purchase', purchaseId, user, cid);
        } else if (p.payment_type === 'تحويل' || p.payment_type === 'TPE') {
          addTreasuryEntry(date, 'صادر', `مشتريات (${p.payment_type}) - فاتورة ${invoice_number}`, p.amount, 'البنك', 'purchase', purchaseId, user, cid);
        }

        if (p.payment_type === 'شيك' || p.payment_type === 'شيك_مظهر') {
          db.prepare(`INSERT INTO checks_issued (check_number, date, to_supplier, amount, due_date, bank, type, source_check_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(p.check_number, date, supplier_name, p.amount, p.check_due_date, p.bank, p.payment_type === 'شيك_مظهر' ? 'مظهّر' : 'شيكاتي', p.source_check_id || null, cid);
          if (p.source_check_id) {
            db.prepare(`UPDATE checks_portfolio SET used_for_payment = 1, status = 'مظهّر', endorsed_to = ?, endorsed_date = ? WHERE id = ? AND company_id = ?`).run(supplier_name, date, p.source_check_id, cid);
          }
        }
      });

      // ── 6. ACCOUNTING ENTRIES ──────────────────────────────────────────
      // Entry A: Purchase — Dr Inventory / Cr AP
      if (total_amount > 0.001) {
        postJournal({
          entry_date: date, reference_type: 'purchase', reference_id: purchaseId,
          description: `مشتريات - فاتورة ${invoice_number}`,
          company_id: cid,
          lines: [
            { account_code: '1105', debit: total_amount, credit: 0 },
            { account_code: '2101', debit: 0, credit: total_amount }
          ]
        });
      }

      // Entry B: Initial payment — Dr AP / Cr Cash|Bank|Checks
      if (payments_total > 0.001) {
        let cashOut = 0, bankOut = 0, checkOut = 0;
        (payments || []).forEach(p => {
          const amt = parseFloat(p.amount) || 0;
          if (amt <= 0) return;
          if (p.payment_type === 'نقدي') cashOut += amt;
          else if (p.payment_type === 'تحويل' || p.payment_type === 'TPE') bankOut += amt;
          else if (p.payment_type === 'شيك' || p.payment_type === 'شيك_مظهر') checkOut += amt;
        });
        const payLines = [{ account_code: '2101', debit: payments_total, credit: 0 }];
        if (cashOut > 0.001)  payLines.push({ account_code: '1101', debit: 0, credit: cashOut });
        if (bankOut > 0.001)  payLines.push({ account_code: '1102', debit: 0, credit: bankOut });
        if (checkOut > 0.001) payLines.push({ account_code: '1103', debit: 0, credit: checkOut });

        postJournal({
          entry_date: date, reference_type: 'purchase_payment_initial', reference_id: purchaseId,
          description: `دفع مشتريات - فاتورة ${invoice_number}`,
          company_id: cid,
          lines: payLines
        });
      }

      return { purchaseId, total_amount, applied_credit, status, createdInventoryIds };
    });

    const result = createPurchase();
    logAudit('purchases', result.purchaseId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: result.purchaseId, invoice_number, total_amount: result.total_amount, applied_credit: result.applied_credit, status: result.status, created_inventory_ids: result.createdInventoryIds });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Dedicated product list for the purchases dropdown
// Returns ALL inventory items — no quantity filter, no warehouse filter,
// no service-type rows (inventory table only contains stockable items)
router.get('/purchases/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        i.id,
        i.quantity,
        i.unit_cost,
        i.master_color_id,
        w.name  AS warehouse_name,
        pt.name AS product_name,
        pt.unit,
        COALESCE(cc.code, i.color_description, 'بدون') AS display_color,
        mc.color_code   AS mc_color_code,
        mc.color_family AS color_family,
        mc.shade_name   AS shade_name,
        mc.hex_code     AS hex_code
      FROM inventory i
      LEFT JOIN warehouses    w  ON i.warehouse_id    = w.id
      LEFT JOIN product_types pt ON i.product_type_id = pt.id
      LEFT JOIN color_codes   cc ON i.color_code_id   = cc.id
      LEFT JOIN master_colors mc ON i.master_color_id = mc.id
      WHERE i.company_id = ?
      ORDER BY pt.name, w.name, display_color
    `).all(req.company_id);
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add payment to an existing purchase
router.post('/purchases/:id/payment', (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id);
    const { payment_type, amount, check_number, check_date, check_due_date, bank, source_check_id, user } = req.body;

    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid payment amount' });
    if (!payment_type) return res.status(400).json({ error: 'Payment type is required' });

    const cid = req.company_id;
    const payPurchase = db.transaction(() => {
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND company_id = ?').get(purchaseId, cid);
      if (!purchase) throw new Error('Purchase not found');

      const payDate = new Date().toISOString().split('T')[0];

      // Insert payment record
      const payResult = db.prepare(`
        INSERT INTO purchases_payments (purchase_id, payment_type, amount, check_number, check_date, check_due_date, bank, source_check_id, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseId, payment_type, parseFloat(amount), check_number || null, check_date || null, check_due_date || null, bank || null, source_check_id || null, cid);
      const payId = payResult.lastInsertRowid;

      // Treasury entry
      if (payment_type === 'نقدي') {
        addTreasuryEntry(payDate, 'صادر', `دفع مشتريات - فاتورة ${purchase.invoice_number}`, parseFloat(amount), 'الصندوق', 'purchase', purchaseId, user, cid);
      } else if (payment_type === 'تحويل' || payment_type === 'TPE') {
        addTreasuryEntry(payDate, 'صادر', `دفع مشتريات (${payment_type}) - فاتورة ${purchase.invoice_number}`, parseFloat(amount), 'البنك', 'purchase', purchaseId, user, cid);
      }

      if (payment_type === 'شيك' || payment_type === 'شيك_مظهر') {
        db.prepare(`INSERT INTO checks_issued (check_number, date, to_supplier, amount, due_date, bank, type, source_check_id, company_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          check_number, payDate, purchase.supplier_name, parseFloat(amount), check_due_date, bank,
          payment_type === 'شيك_مظهر' ? 'مظهّر' : 'شيكاتي', source_check_id || null, cid
        );
        if (source_check_id) {
          db.prepare(`UPDATE checks_portfolio SET used_for_payment = 1, status = 'مظهّر', endorsed_to = ?, endorsed_date = ? WHERE id = ? AND company_id = ?`).run(purchase.supplier_name, payDate, source_check_id, cid);
        }
      }

      // Recompute remaining and auto-update status (no negative stored)
      const totalPaid = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM purchases_payments WHERE purchase_id = ? AND company_id = ?`).get(purchaseId, cid).total;
      const remaining = Math.max(0, purchase.total_amount - parseFloat(purchase.applied_credit || 0) - totalPaid);
      const newStatus = remaining <= 0 ? 'CLOSED' : 'OPEN';

      db.prepare(`UPDATE purchases SET status = ? WHERE id = ? AND company_id = ?`).run(newStatus, purchaseId, cid);

      // STEP 3: Payment journal entry — Dr 2101 (الموردون) / Cr cash or bank or cheques
      // Account mapping:
      //   نقدي                          → Cr 1101 (الصندوق)
      //   تحويل / تحويل بنكي / TPE      → Cr 1102 (البنك)
      //   شيك / شيك شخصي / شيك_مظهر    → Cr 1103 (محفظة الشيكات)
      //   source_check_id (endorsed)    → Cr 1103 (محفظة الشيكات)
      const creditAccount =
        source_check_id                                                          ? '1103' :
        payment_type === 'نقدي'                                                  ? '1101' :
        (payment_type === 'تحويل' || payment_type === 'تحويل بنكي' ||
         payment_type === 'TPE')                                                  ? '1102' :
        (payment_type === 'شيك'   || payment_type === 'شيك شخصي' ||
         payment_type === 'شيك_مظهر')                                            ? '1103' :
        '1101'; // fallback to cash

      createJournalEntry({
        entry_date:     payDate,
        reference_type: 'purchase_payment',
        reference_id:   payId,
        description:    `Payment for Purchase #${purchase.invoice_number}`,
        company_id:     cid,
        lines: [
          { account_code: '2101',         debit: parseFloat(amount), credit: 0                  },  // Dr الموردون
          { account_code: creditAccount,  debit: 0,                  credit: parseFloat(amount) }   // Cr cash/bank/cheques
        ]
      });

      return { total_paid: totalPaid, remaining, status: newStatus };
    });

    const result = payPurchase();
    logAudit('purchases_payments', purchaseId, 'payment', null, req.body, user || 'system');
    res.json({ success: true, purchase_id: purchaseId, ...result });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ============================================
// POST /api/purchases/:id/status
// Handles purchase invoice_status transitions: Draft → Confirmed (one-way lock).
// When status → Confirmed: creates journal entry (Dr 1105 / Cr 2101).
// Idempotent: skips journal creation if entry already exists for this purchase.
// ============================================
router.post('/purchases/:id/status', (req, res) => {
  try {
    const purchaseId = parseInt(req.params.id);
    const { status, user } = req.body;

    const VALID_STATUSES = ['Draft', 'Confirmed'];
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `حالة غير صالحة. المسموح به: ${VALID_STATUSES.join(', ')}` });
    }

    const cid = req.company_id;
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ? AND company_id = ?').get(purchaseId, cid);
    if (!purchase) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

    const oldStatus = purchase.invoice_status || 'Draft';

    // STEP 1: Lock — Confirmed cannot revert to Draft
    if (oldStatus === 'Confirmed' && status === 'Draft') {
      return res.status(400).json({
        error: 'Confirmed purchases cannot return to Draft. Use reversal instead.'
      });
    }

    // STEP 2: Confirmed transition — update + journal entry (atomic)
    if (status === 'Confirmed') {
      const confirmTx = db.transaction(() => {
        db.prepare(`UPDATE purchases SET invoice_status = ? WHERE id = ? AND company_id = ?`).run(status, purchaseId, cid);
        logAudit('purchases', purchaseId, 'status_change',
          { invoice_status: oldStatus }, { invoice_status: status }, user || 'system');

        // Idempotency guard — skip if already journalled for this purchase
        const existing = db.prepare(
          "SELECT id FROM journal_entries WHERE reference_type = 'purchase' AND reference_id = ? AND company_id = ?"
        ).get(purchaseId, cid);

        if (!existing) {
          const amount = parseFloat(purchase.total_amount) || 0;
          createJournalEntry({
            entry_date:     purchase.date,
            reference_type: 'purchase',
            reference_id:   purchaseId,
            description:    `Purchase #${purchase.invoice_number}`,
            company_id:     cid,
            lines: [
              { account_code: '1105', debit: amount, credit: 0      },  // Dr المخزون
              { account_code: '2101', debit: 0,       credit: amount }   // Cr الموردون
            ]
          });
        }
      });
      confirmTx();
    } else {
      // Draft (from Draft — no-op transition allowed, just update)
      db.prepare(`UPDATE purchases SET invoice_status = ? WHERE id = ? AND company_id = ?`).run(status, purchaseId, cid);
      logAudit('purchases', purchaseId, 'status_change',
        { invoice_status: oldStatus }, { invoice_status: status }, user || 'system');
    }

    res.json({ id: purchaseId, old_status: oldStatus, new_status: status });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

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
