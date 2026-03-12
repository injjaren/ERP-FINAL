'use strict';
const router = require('express').Router();
const { db } = require('../../database');
const { addTreasuryEntry, postJournal, logAudit, validateInventoryStage, STAGE_BRANCH_RULES, KG_TO_OZ } = require('../../utils');

// ============================================
// SALES ROUTES
// ============================================

router.get('/sales', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id;
    const { from_date, to_date, client_id, period } = req.query;

    let dateFilter = '';
    const params = [cid, bid]; // company_id then branch_id

    if (period === 'daily') {
      dateFilter = `AND date(s.date) = date('now')`;
    } else if (period === 'weekly') {
      dateFilter = `AND date(s.date) >= date('now', '-7 days')`;
    } else if (period === 'monthly') {
      dateFilter = `AND date(s.date) >= date('now', '-30 days')`;
    } else if (from_date && to_date) {
      dateFilter = `AND s.date BETWEEN ? AND ?`;
      params.push(from_date, to_date);
    }

    if (client_id) {
      dateFilter += ` AND s.client_id = ?`;
      params.push(client_id);
    }

    const sales = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.company_id = ? AND s.branch_id = ? ${dateFilter}
      ORDER BY s.date DESC
    `).all(...params);

    // Prepare a single statement used for every sale's latest revision lookup.
    // Fetches artisan_rate (frozen cost) alongside unit_price (sale price) and artisan_id.
    const stmtLatestRev = db.prepare(`
      SELECT iri.quantity, iri.unit_price, iri.artisan_id,
             iri.artisan_rate, iri.service_type_id
      FROM invoice_revision_items iri
      WHERE iri.company_id = ? AND iri.revision_id = (
        SELECT id FROM invoice_revisions
        WHERE invoice_id = ? AND company_id = ?
        ORDER BY revision_number DESC
        LIMIT 1
      )
    `);

    // Get items and payments for each sale
    sales.forEach(sale => {
      sale.items = db.prepare(`
        SELECT si.*, i.unit_cost
        FROM sales_items si
        LEFT JOIN inventory i ON si.inventory_id = i.id AND i.company_id = si.company_id
        WHERE si.sale_id = ? AND si.company_id = ?
      `).all(sale.id, cid);

      sale.payments = db.prepare(`SELECT * FROM sales_payments WHERE sale_id = ? AND company_id = ?`).all(sale.id, cid);

      // total_paid = actual received money only (cash/check/transfer/TPE)
      // Legacy آجل records are excluded so remaining reflects true unpaid balance
      sale.total_paid = sale.payments.filter(p => p.payment_type !== 'آجل').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.remaining  = parseFloat(sale.final_amount || 0) - sale.total_paid;

      // ── Profit calculation ──────────────────────────────────────────────
      // Revenue = sale.final_amount  (what the client pays, kept current by revision endpoint)
      // Cost    = SUM(quantity × artisan_rate) for service items (artisan_id IS NOT NULL)
      //           artisan_rate is the FROZEN rate stored at revision creation time.
      //           unit_price is the SALE PRICE — it is NOT used in cost calculation.
      //
      // For product items (artisan_id NULL, inventory_id present), cost comes from
      // inventory.unit_cost via sales_items — only in the legacy fallback path.
      // We do NOT double-count: service items never touch inventory.
      const revItems = stmtLatestRev.all(cid, sale.id, cid);

      if (revItems.length > 0) {
        // Revision path: cost = SUM(quantity × artisan_rate) for items with an artisan.
        // artisan_rate = 0 for backfilled historical items (safe default, no retroactive change).
        sale.total_cost = revItems.reduce((sum, ri) => {
          if (ri.artisan_id) {
            return sum + (parseFloat(ri.quantity || 0) * parseFloat(ri.artisan_rate || 0));
          }
          return sum;
        }, 0);
        sale.profit        = parseFloat(sale.final_amount || 0) - sale.total_cost;
        sale.profit_source = 'revision';
      } else {
        // Legacy fallback — no revisions exist at all (should not happen after backfill migration,
        // but kept as a safe guard for any edge-case sales created after a server crash mid-migration).
        sale.total_cost = sale.items.reduce((sum, item) =>
          sum + (parseFloat(item.unit_cost || 0) * parseFloat(item.quantity || 0)), 0);
        sale.profit        = parseFloat(sale.final_amount || 0) - sale.total_cost;
        sale.profit_source = 'sales_items';
      }
    });

    // Calculate payment breakdown for each sale
    sales.forEach(sale => {
      sale.cash_paid = sale.payments.filter(p => p.payment_type === 'نقدي').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.check_paid = sale.payments.filter(p => p.payment_type === 'شيك').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      sale.transfer_paid = sale.payments.filter(p => p.payment_type === 'تحويل').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      // Credit = dynamic remaining (not from آجل payment records)
      sale.credit_amount = Math.max(0, parseFloat(sale.final_amount || 0) - sale.total_paid);

      // Build payment summary string (actual payments only, no آجل)
      const paymentParts = [];
      if (sale.cash_paid > 0) paymentParts.push(`نقدي: ${sale.cash_paid}`);
      if (sale.check_paid > 0) paymentParts.push(`شيك: ${sale.check_paid}`);
      if (sale.transfer_paid > 0) paymentParts.push(`تحويل: ${sale.transfer_paid}`);
      sale.payment_summary = paymentParts.length > 0 ? paymentParts.join(' | ') : 'لم يدفع';
    });

    // Calculate KPIs with payment type breakdown
    const kpis = {
      total_sales: sales.reduce((sum, s) => sum + parseFloat(s.final_amount || 0), 0),
      total_paid: sales.reduce((sum, s) => sum + parseFloat(s.total_paid || 0), 0),
      total_remaining: sales.reduce((sum, s) => sum + parseFloat(s.remaining || 0), 0),
      total_profit: sales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0),
      total_cost: sales.reduce((sum, s) => sum + parseFloat(s.total_cost || 0), 0),
      count: sales.length,
      // Payment breakdown KPIs
      total_cash: sales.reduce((sum, s) => sum + parseFloat(s.cash_paid || 0), 0),
      total_checks: sales.reduce((sum, s) => sum + parseFloat(s.check_paid || 0), 0),
      total_transfers: sales.reduce((sum, s) => sum + parseFloat(s.transfer_paid || 0), 0),
      total_credit: sales.reduce((sum, s) => sum + parseFloat(s.credit_amount || 0), 0)
    };

    res.json({ sales, kpis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/pos/sale', (req, res) => {
  try {
    const { invoice_number, date, client_id, client_name, client_phone, items, payments,
            discount_percent, discount_amount, notes, user, branch_id } = req.body;
    const cid = req.company_id;
    // Auto-resolve branch: explicit > derive from first item's inventory warehouse > default 1
    let bid = branch_id;
    if (!bid && items?.length > 0 && items[0].inventory_id) {
      const invWh = db.prepare('SELECT w.branch_id FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.id = ? AND i.company_id = ?').get(items[0].inventory_id, cid);
      if (invWh) bid = invWh.branch_id;
    }
    bid = bid || 1;

    // ── Validation (fast-fail before opening a transaction) ───────────────────
    // آجل is banned as a payment type — remaining is computed automatically, never stored
    if (payments.some(p => p.payment_type === 'آجل'))
      return res.status(400).json({ error: 'آجل غير مسموح كطريقة دفع — الدين يُحسب تلقائياً' });
    if (user !== 'admin' && discount_percent > 5)
      return res.status(400).json({ error: 'الخصم الأقصى للمستخدم العادي هو 5%' });

    const subtotal    = items.reduce((sum, item) => sum + item.total_price, 0);
    const final_amount = subtotal - (discount_amount || 0);
    const totalPaid   = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const debtAmount  = final_amount - totalPaid;

    // Server-side guard: phone required if any amount remains unpaid
    if (debtAmount > 0.01 && !client_phone)
      return res.status(400).json({ error: 'رقم الهاتف إجباري للبيع بالدين' });

    // ── Atomic transaction ────────────────────────────────────────────────────
    const doSale = db.transaction(() => {

      // ── 1. Master sale row ─────────────────────────────────────────────────
      const saleResult = db.prepare(`
        INSERT INTO sales (invoice_number, date, client_id, client_name, client_phone,
          subtotal, discount_percent, discount_amount, final_amount, notes,
          created_by, status, company_id, branch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
      `).run(invoice_number, date, client_id, client_name, client_phone,
             subtotal, discount_percent || 0, discount_amount || 0, final_amount,
             notes, user || 'system', cid, bid);
      const saleId = saleResult.lastInsertRowid;

      // ── 2. Prepared statements (compiled once, executed per item) ──────────
      const insertSalesItem = db.prepare(`
        INSERT INTO sales_items (sale_id, inventory_id, product_name, color_code_id,
          quantity, unit_price, total_price, is_special_order, special_order_id, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertSaleItem = db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, branch_id, quantity,
          sell_price, unit_cost, total_price, total_cost, company_id,
          inventory_stage, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const getCost   = db.prepare(`SELECT unit_cost, inventory_stage FROM inventory WHERE id = ? AND company_id = ?`);
      const deductInv = db.prepare(`UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND company_id = ?`);
      const insertMov = db.prepare(`
        INSERT INTO inventory_movements (inventory_id, movement_type, quantity,
          reference_type, reference_id, created_by, company_id)
        VALUES (?, 'out', ?, 'sale', ?, ?, ?)
      `);

      // ── 3. Line items ──────────────────────────────────────────────────────
      let totalCost = 0; // Accumulate COGS for accounting entry
      items.forEach(item => {
        // Legacy sales_items row (used by existing reporting queries)
        insertSalesItem.run(
          saleId, item.inventory_id, item.product_name, item.color_code_id,
          item.quantity, item.unit_price, item.total_price,
          item.is_special_order || 0, item.special_order_id || null, cid
        );

        // Cost engine: fetch unit_cost + stage from inventory row
        let unit_cost = 0;
        let invStage = item.inventory_stage || null;
        if (item.inventory_id) {
          const inv = getCost.get(item.inventory_id, cid);
          if (inv) {
            // With stage-aligned POS (v10), retail_oz inventory already has per-ounce cost
            unit_cost = inv.unit_cost;
            if (!invStage) invStage = inv.inventory_stage;
          }
        }
        const itemUnit = invStage === 'retail_oz' ? 'oz' : 'kg';
        const sell_price  = item.unit_price;
        const total_price = sell_price * item.quantity;
        const total_cost  = unit_cost  * item.quantity;
        totalCost += total_cost;

        // Profit-analysis row in sale_items
        insertSaleItem.run(
          saleId, item.inventory_id || 0, bid, item.quantity,
          sell_price, unit_cost, total_price, total_cost, cid,
          invStage, itemUnit
        );

        // Inventory deduction + movement log (skip for special orders)
        if (!item.is_special_order && item.inventory_id) {
          deductInv.run(item.quantity, item.inventory_id, cid);
          insertMov.run(item.inventory_id, item.quantity, saleId, user || 'system', cid);
        }
      });

      // ── 4. Payments ────────────────────────────────────────────────────────
      const insertPayment = db.prepare(`
        INSERT INTO sales_payments (sale_id, payment_type, amount, check_number,
          check_date, check_due_date, bank, company_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      // All payments are actual (cash/check/transfer/TPE/كمبيالة) — no آجل
      payments.forEach(p => {
        insertPayment.run(
          saleId, p.payment_type, p.amount,
          p.check_number || null, p.check_date || null,
          p.check_due_date || p.traite_due_date || null,
          p.bank || null, cid
        );

        // Cash payment → Treasury (cash box)
        if (p.payment_type === 'نقدي')
          addTreasuryEntry(date, 'وارد', `مبيعات - فاتورة ${invoice_number}`, p.amount, 'الصندوق', 'sale', saleId, user, cid);
        // Bank transfer → Treasury (bank)
        if (p.payment_type === 'تحويل')
          addTreasuryEntry(date, 'وارد', `مبيعات (تحويل) - فاتورة ${invoice_number}`, p.amount, 'البنك', 'sale', saleId, user, cid);
        // TPE → Treasury (bank)
        if (p.payment_type === 'TPE')
          addTreasuryEntry(date, 'وارد', `مبيعات (TPE) - فاتورة ${invoice_number}`, p.amount, 'البنك', 'sale', saleId, user, cid);
        // Check → Portfolio for collection
        if (p.payment_type === 'شيك') {
          db.prepare(`
            INSERT INTO checks_portfolio (check_number, date, from_client, amount,
              due_date, bank, status, source, company_id)
            VALUES (?, ?, ?, ?, ?, ?, 'معلق', 'مبيعات', ?)
          `).run(p.check_number, date, client_name || 'عميل عابر', p.amount,
                 p.check_due_date, p.bank, cid);
        }
        // Promissory note (كمبيالة) → auto-create traite linked to this sale
        if (p.payment_type === 'كمبيالة') {
          const dueDate = p.traite_due_date || p.check_due_date || date;
          db.prepare(`
            INSERT INTO traites (reference, client_id, amount, due_date, status, notes, company_id, branch_id)
            VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
          `).run(
            p.traite_ref || invoice_number,
            client_id || null,
            parseFloat(p.amount),
            dueDate,
            `كمبيالة من فاتورة ${invoice_number}`,
            cid,
            bid
          );
        }
      });

      // ── 5. Client balance adjustment ─────────────────────────────────────
      // new_debt = previous_debt + invoice_total - paid_amount
      // debtAmount = final_amount - totalPaid (can be negative if overpaid)
      // Positive debtAmount → add to balance (new debt from this invoice)
      // Negative debtAmount → subtract from balance (overpayment reduces previous debt)
      if (client_id && Math.abs(debtAmount) > 0.001) {
        db.prepare('UPDATE clients SET balance = balance + ? WHERE id = ? AND company_id = ?')
          .run(debtAmount, client_id, cid);
      }

      // ── 6. ACCOUNTING ENTRIES ──────────────────────────────────────────────
      // Entry A: Sale revenue — Dr AR / Cr Sales
      if (final_amount > 0.001) {
        postJournal({
          entry_date: date, reference_type: 'sale', reference_id: saleId,
          description: `مبيعات - فاتورة ${invoice_number}`,
          company_id: cid,
          lines: [
            { account_code: '1104', debit: final_amount, credit: 0 },
            { account_code: '4100', debit: 0, credit: final_amount }
          ]
        });
      }

      // Entry B: COGS — Dr COGS / Cr Inventory
      if (totalCost > 0.001) {
        postJournal({
          entry_date: date, reference_type: 'sale_cogs', reference_id: saleId,
          description: `تكلفة مبيعات - فاتورة ${invoice_number}`,
          company_id: cid,
          lines: [
            { account_code: '5101', debit: totalCost, credit: 0 },
            { account_code: '1105', debit: 0, credit: totalCost }
          ]
        });
      }

      // Entry C: Payment received — Dr Cash/Bank/Checks / Cr AR
      // كمبيالة is excluded from this journal entry: it is a future-collection instrument
      // tracked in the traites table. Client balance is already reduced by debtAmount above.
      const cashReceived = payments
        .filter(p => p.payment_type !== 'كمبيالة')
        .reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      if (cashReceived > 0.001) {
        let cashTotal = 0, bankTotal = 0, checkTotal = 0;
        payments.forEach(p => {
          const amt = parseFloat(p.amount) || 0;
          if (p.payment_type === 'نقدي') cashTotal += amt;
          else if (p.payment_type === 'تحويل' || p.payment_type === 'TPE') bankTotal += amt;
          else if (p.payment_type === 'شيك') checkTotal += amt;
        });
        const receiptLines = [];
        if (cashTotal > 0.001)  receiptLines.push({ account_code: '1101', debit: cashTotal, credit: 0 });
        if (bankTotal > 0.001)  receiptLines.push({ account_code: '1102', debit: bankTotal, credit: 0 });
        if (checkTotal > 0.001) receiptLines.push({ account_code: '1103', debit: checkTotal, credit: 0 });
        receiptLines.push({ account_code: '1104', debit: 0, credit: cashReceived });

        postJournal({
          entry_date: date, reference_type: 'sale_receipt', reference_id: saleId,
          description: `تحصيل مبيعات - فاتورة ${invoice_number}`,
          company_id: cid,
          lines: receiptLines
        });
      }

      return saleId;
    });

    const saleId = doSale();
    logAudit('sales', saleId, 'create', null, req.body, user || 'system');
    res.status(201).json({ id: saleId, invoice_number, subtotal, discount_amount, final_amount });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/sales/:id', (req, res) => {
  try {
    const cid = req.company_id;
    const bid = req.branch_id;
    const { user, reason } = req.body;
    if (user !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND company_id = ? AND branch_id = ?').get(req.params.id, cid, bid);
    if (!sale) return res.status(404).json({ error: 'فاتورة غير موجودة أو لا تتبع للفرع الحالي' });

    db.prepare('DELETE FROM sales_items WHERE sale_id = ? AND company_id = ?').run(req.params.id, cid);
    db.prepare('DELETE FROM sales_payments WHERE sale_id = ? AND company_id = ?').run(req.params.id, cid);
    db.prepare('DELETE FROM sales WHERE id = ? AND company_id = ? AND branch_id = ?').run(req.params.id, cid, bid);
    logAudit('sales', req.params.id, 'delete', sale, null, user, reason);
    res.status(204).send();
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
